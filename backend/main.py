import asyncio
import json
import os
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request as URLRequest, urlopen

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pwdlib import PasswordHash
from pydantic import BaseModel, Field
from starlette.responses import FileResponse

load_dotenv(Path(__file__).with_name(".env"))

app = FastAPI(title="essiq API")
allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncIOMotorClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))
db = client[os.getenv("DB_NAME", "essiq")]
password_hasher = PasswordHash.recommended()
OPEN_CHARGE_MAP_URL = "https://api.openchargemap.io/v3/poi/"
CHARGER_STATUS_FRESHNESS = timedelta(minutes=15)
AUTH_DATABASE_PATH = Path(__file__).parent / "data" / "essiq_auth.sqlite3"
AUTH_DATABASE_PATH = Path(
    os.getenv("AUTH_DATABASE_PATH", str(AUTH_DATABASE_PATH))
)
FRONTEND_DIST = Path(
    os.getenv("FRONTEND_DIST", str(Path(__file__).parent.parent / "frontend" / "dist"))
)


@contextmanager
def auth_database():
    AUTH_DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(AUTH_DATABASE_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS trip_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            origin TEXT NOT NULL,
            destination TEXT NOT NULL,
            distance_km REAL NOT NULL,
            duration_minutes REAL NOT NULL,
            vehicle_range_km REAL NOT NULL,
            battery_percent INTEGER NOT NULL,
            suggested_stops INTEGER NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS charger_search_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            location_label TEXT NOT NULL,
            source TEXT NOT NULL,
            stations TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """
    )
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


class Vehicle(BaseModel):
    name: str
    year: int
    battery_kwh: float


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TripHistoryRequest(BaseModel):
    origin: str = Field(min_length=1, max_length=300)
    destination: str = Field(min_length=1, max_length=300)
    distance_km: float = Field(gt=0, le=50000)
    duration_minutes: float = Field(ge=0, le=100000)
    vehicle_range_km: float = Field(gt=0, le=5000)
    battery_percent: int = Field(ge=1, le=100)
    suggested_stops: int = Field(ge=0, le=100)


class ChargingPointHistoryRequest(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    operator: str | None = Field(default=None, max_length=200)
    address: str | None = Field(default=None, max_length=500)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class ChargerSearchHistoryRequest(BaseModel):
    location_label: str = Field(min_length=1, max_length=300)
    source: str = Field(min_length=1, max_length=80)
    stations: list[ChargingPointHistoryRequest] = Field(min_length=1, max_length=50)


async def require_db() -> None:
    try:
        await db.command("ping")
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


async def require_authenticated_user(request: Request) -> dict:
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="Sign in to access your profile history.")

    with auth_database() as connection:
        user = connection.execute(
            """
            SELECT users.id AS _id, users.name, users.email
            FROM sessions JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
            """,
            (token,),
        ).fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")

    return dict(user)


@app.get("/")
async def root():
    index_file = FRONTEND_DIST / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    return {"status": "essiq API is running"}


@app.get("/health", include_in_schema=False)
async def health_check():
    return {"status": "ok"}


@app.get("/battery/health")
async def battery_health():
    return {
        "soh_percent": 87.4,
        "data_basis": "Demo data",
        "note": "Placeholder value. Real estimates will come from the NASA dataset.",
    }


def _parse_utc_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


def _format_charger(item: dict, now: datetime) -> dict:
    address = item.get("AddressInfo") or {}
    status = item.get("StatusType") or {}
    status_updated_at = _parse_utc_timestamp(item.get("DateLastStatusUpdate"))
    is_status_fresh = bool(
        status_updated_at
        and timedelta(seconds=-120) <= now - status_updated_at <= CHARGER_STATUS_FRESHNESS
    )
    raw_connections = item.get("Connections") or []
    connectors = []

    for connection in raw_connections:
        connection_status = connection.get("StatusType") or {}
        quantity = connection.get("Quantity")
        connectors.append(
            {
                "type": (connection.get("ConnectionType") or {}).get("Title"),
                "quantity": quantity if isinstance(quantity, int) and quantity > 0 else 1,
                "power_kw": connection.get("PowerKW"),
                "status": connection_status.get("Title"),
                "is_operational": connection_status.get("IsOperational"),
            }
        )

    connector_statuses_known = all(
        connector["is_operational"] is not None for connector in connectors
    )
    working_connectors = (
        sum(
            connector["quantity"]
            for connector in connectors
            if connector["is_operational"] is True
        )
        if is_status_fresh and connectors and connector_statuses_known
        else None
    )

    return {
        "id": item.get("ID"),
        "name": address.get("Title") or "Charging station",
        "operator": (item.get("OperatorInfo") or {}).get("Title"),
        "latitude": address.get("Latitude"),
        "longitude": address.get("Longitude"),
        "address": ", ".join(
            part
            for part in (
                address.get("AddressLine1"),
                address.get("Town"),
                address.get("StateOrProvince"),
                address.get("Country", {}).get("Title")
                if isinstance(address.get("Country"), dict)
                else None,
            )
            if part
        ),
        "status": status.get("Title"),
        "is_operational": status.get("IsOperational"),
        "status_updated_at": status_updated_at.isoformat() if status_updated_at else None,
        "is_status_fresh": is_status_fresh,
        "working_connectors": working_connectors,
        "connectors": connectors,
        "usage_cost": item.get("UsageCost"),
    }


@app.get("/chargers")
async def find_chargers(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    distance_km: float = Query(default=15, gt=0, le=100),
    max_results: int = Query(default=50, ge=1, le=100),
):
    api_key = os.getenv("OPEN_CHARGE_MAP_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Open Charge Map is not configured. Add its API key to backend/.env.",
        )

    query = urlencode(
        {
            "output": "json",
            "latitude": latitude,
            "longitude": longitude,
            "distance": distance_km,
            "distanceunit": "KM",
            "maxresults": max_results,
            "key": api_key,
        }
    )
    request = URLRequest(
        f"{OPEN_CHARGE_MAP_URL}?{query}",
        headers={"User-Agent": "essiq EV trip planner/1.0", "Accept": "application/json"},
    )

    try:
        response_body = await asyncio.to_thread(_fetch_open_charge_map, request)
        records = json.loads(response_body)
    except HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Open Charge Map returned HTTP {exc.code}. Check the API key and try again.",
        ) from exc
    except (URLError, TimeoutError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not reach Open Charge Map. Please try again later.",
        ) from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail="Open Charge Map returned an invalid response.",
        ) from exc

    if not isinstance(records, list):
        raise HTTPException(
            status_code=502,
            detail="Open Charge Map returned an unexpected response.",
        )

    now = datetime.now(timezone.utc)
    chargers = [
        _format_charger(record, now)
        for record in records
        if isinstance(record, dict)
    ]
    return {
        "source": "Open Charge Map",
        "retrieved_at": now.isoformat(),
        "chargers": chargers,
    }


def _fetch_open_charge_map(request: URLRequest) -> bytes:
    with urlopen(request, timeout=20) as response:
        return response.read()


@app.post("/signup")
async def signup(payload: SignupRequest):
    name = payload.name.strip()
    email = payload.email.strip().lower()
    if not name or not email or not payload.password:
        raise HTTPException(status_code=400, detail="Name, email, and password are required.")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    user_id = secrets.token_hex(16)
    try:
        with auth_database() as connection:
            connection.execute(
                """
                INSERT INTO users (id, name, email, password_hash, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    name,
                    email,
                    password_hasher.hash(payload.password),
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
    except sqlite3.IntegrityError as exc:
        if "users.email" in str(exc):
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists.",
            ) from exc
        raise
    return {"message": "Account created successfully."}


@app.post("/login")
async def login(payload: LoginRequest, response: Response):
    email = payload.email.strip().lower()
    if not email or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    with auth_database() as connection:
        user = connection.execute(
            "SELECT id, name, email, password_hash FROM users WHERE email = ?",
            (email,),
        ).fetchone()
    if not user or not password_hasher.verify(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = secrets.token_urlsafe(32)
    with auth_database() as connection:
        connection.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))
        connection.execute(
            "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
            (token, user["id"], datetime.now(timezone.utc).isoformat()),
        )

    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=os.getenv("COOKIE_SECURE", "false").strip().lower() == "true",
        max_age=60 * 60 * 24 * 7,
    )
    return {
        "message": "Logged in successfully.",
        "user": {"name": user["name"], "email": user["email"]},
    }


@app.post("/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        with auth_database() as connection:
            connection.execute("DELETE FROM sessions WHERE token = ?", (token,))
    response.delete_cookie("session_token")
    return {"message": "Logged out."}


@app.get("/me")
async def get_current_user(request: Request):
    token = request.cookies.get("session_token")
    if not token:
        return {"authenticated": False}

    with auth_database() as connection:
        user = connection.execute(
            """
            SELECT users.name, users.email
            FROM sessions JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
            """,
            (token,),
        ).fetchone()
    if not user:
        return {"authenticated": False}
    return {"authenticated": True, "user": dict(user)}


@app.get("/profile/history")
async def get_profile_history(request: Request):
    user = await require_authenticated_user(request)
    with auth_database() as connection:
        trips = connection.execute(
            """
            SELECT origin, destination, distance_km, duration_minutes,
                   vehicle_range_km, battery_percent, suggested_stops, created_at
            FROM trip_history WHERE user_id = ?
            ORDER BY id DESC LIMIT 25
            """,
            (user["_id"],),
        ).fetchall()
        searches = connection.execute(
            """
            SELECT location_label, source, stations, created_at
            FROM charger_search_history WHERE user_id = ?
            ORDER BY id DESC LIMIT 25
            """,
            (user["_id"],),
        ).fetchall()
    return {
        "trips": [dict(trip) for trip in trips],
        "charger_searches": [
            {
                **{key: search[key] for key in ("location_label", "source", "created_at")},
                "stations": json.loads(search["stations"]),
            }
            for search in searches
        ],
    }


@app.post("/profile/history/trips", status_code=201)
async def save_trip_history(payload: TripHistoryRequest, request: Request):
    user = await require_authenticated_user(request)
    trip = payload.model_dump()
    with auth_database() as connection:
        connection.execute(
            """
            INSERT INTO trip_history (
                user_id, origin, destination, distance_km, duration_minutes,
                vehicle_range_km, battery_percent, suggested_stops, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user["_id"],
                trip["origin"],
                trip["destination"],
                trip["distance_km"],
                trip["duration_minutes"],
                trip["vehicle_range_km"],
                trip["battery_percent"],
                trip["suggested_stops"],
                datetime.now(timezone.utc).isoformat(),
            ),
        )
    return {"saved": True}


@app.post("/profile/history/charger-searches", status_code=201)
async def save_charger_search_history(
    payload: ChargerSearchHistoryRequest, request: Request
):
    user = await require_authenticated_user(request)
    stations = [station.model_dump() for station in payload.stations]
    with auth_database() as connection:
        connection.execute(
            """
            INSERT INTO charger_search_history
                (user_id, location_label, source, stations, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                user["_id"],
                payload.location_label,
                payload.source,
                json.dumps(stations),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
    return {"saved": True, "station_count": len(stations)}


@app.post("/vehicles")
async def add_vehicle(vehicle: Vehicle):
    await require_db()
    await db.vehicles.insert_one(vehicle.model_dump())
    return {"saved": True, "vehicle": vehicle}


@app.get("/vehicles")
async def list_vehicles():
    await require_db()
    return await db.vehicles.find({}, {"_id": 0}).to_list(100)


@app.get("/{full_path:path}", include_in_schema=False)
async def frontend_fallback(full_path: str):
    index_file = FRONTEND_DIST / "index.html"
    if not index_file.is_file():
        raise HTTPException(status_code=404, detail="Frontend build is not installed.")

    requested_file = (FRONTEND_DIST / full_path).resolve()
    if requested_file.is_relative_to(FRONTEND_DIST.resolve()) and requested_file.is_file():
        return FileResponse(requested_file)
    if full_path.startswith(("assets/", "images/")):
        raise HTTPException(status_code=404, detail="Frontend asset not found.")
    return FileResponse(index_file)