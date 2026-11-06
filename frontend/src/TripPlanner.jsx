import { useEffect, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import PriceTicker from "./PriceTicker.jsx";
import ServiceHero from "./ServiceHero.jsx";
import { apiUrl } from "./api.js";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const PHOTON_URL = "https://photon.komoot.io/api/";
const DEFAULT_CENTER = [20.5937, 78.9629];
const RESERVE_PERCENT = 15;

const delay = (milliseconds) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function geocode(place) {
  const url = new URL(NOMINATIM_URL);
  url.search = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    q: place,
  });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Place search is temporarily unavailable. Please try again.");
  }
  const results = await response.json();
  if (results.length === 0) {
    throw new Error(`Could not find "${place}". Try a nearby city or full address.`);
  }
  return {
    name: results[0].display_name,
    latitude: Number(results[0].lat),
    longitude: Number(results[0].lon),
  };
}

function haversineDistance(first, second) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDifference = radians(second[1] - first[1]);
  const longitudeDifference = radians(second[0] - first[0]);
  const value =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(radians(first[1])) *
      Math.cos(radians(second[1])) *
      Math.sin(longitudeDifference / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function routeSearchPoints(coordinates, distanceKm) {
  const intervals = Math.min(20, Math.max(1, Math.ceil(distanceKm / 50)));
  const targetDistances = Array.from(
    { length: intervals + 1 },
    (_, index) => (distanceKm * index) / intervals,
  );
  const points = [];
  let distanceAlongRoute = 0;
  let nextTarget = 0;

  coordinates.forEach((coordinate, index) => {
    if (index > 0) {
      distanceAlongRoute += haversineDistance(coordinates[index - 1], coordinate);
    }
    if (
      nextTarget < targetDistances.length &&
      distanceAlongRoute >= targetDistances[nextTarget]
    ) {
      points.push(coordinate);
      nextTarget += 1;
    }
  });

  const finalPoint = coordinates[coordinates.length - 1];
  if (points[points.length - 1] !== finalPoint) points.push(finalPoint);
  return points;
}

async function findChargers(coordinates, distanceKm) {
  const searchPoints = routeSearchPoints(coordinates, distanceKm);
  const stations = new Map();

  for (const [index, [longitude, latitude]] of searchPoints.entries()) {
    const latitudeOffset = 0.18;
    const longitudeOffset =
      latitudeOffset / Math.max(Math.cos((latitude * Math.PI) / 180), 0.2);
    const url = new URL(PHOTON_URL);
    url.search = new URLSearchParams({
      q: "charging station",
      bbox: [
        longitude - longitudeOffset,
        latitude - latitudeOffset,
        longitude + longitudeOffset,
        latitude + latitudeOffset,
      ].join(","),
      limit: "100",
      lang: "en",
    });

    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      throw new Error("Charging-station data is temporarily unavailable. Please try again later.");
    }

    const data = await response.json();
    (data.features || []).forEach((feature) => {
      const { properties } = feature;
      if (
        properties.osm_key !== "amenity" ||
        properties.osm_value !== "charging_station"
      ) {
        return;
      }

      const [stationLongitude, stationLatitude] = feature.geometry.coordinates;
      const id = `${properties.osm_type}-${properties.osm_id}`;
      stations.set(id, {
        id,
        name: properties.name || "Charging station",
        latitude: stationLatitude,
        longitude: stationLongitude,
        operator: properties.operator || "",
        sockets: [],
      });
    });

    if (index < searchPoints.length - 1) {
      await delay(400);
    }
  }

  return Array.from(stations.values());
}

function FitRoute({ coordinates }) {
  const map = useMap();
  useEffect(() => {
    if (coordinates.length > 1) map.fitBounds(coordinates, { padding: [36, 36] });
  }, [coordinates, map]);
  return null;
}

function TripMap({ route, stations }) {
  const path = route?.coordinates.map(([longitude, latitude]) => [latitude, longitude]) || [];
  const origin = path[0];
  const destination = path[path.length - 1];

  return (
    <MapContainer className="trip-map" center={DEFAULT_CENTER} zoom={5} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {path.length > 1 && (
        <>
          <FitRoute coordinates={path} />
          <Polyline positions={path} pathOptions={{ color: "#b4e54f", weight: 5 }} />
          <CircleMarker center={origin} radius={8} pathOptions={{ color: "#101211", fillColor: "#c9f36a", fillOpacity: 1 }}>
            <Popup>Start: {route.start.name}</Popup>
          </CircleMarker>
          <CircleMarker center={destination} radius={8} pathOptions={{ color: "#101211", fillColor: "#f4f5f5", fillOpacity: 1 }}>
            <Popup>Destination: {route.destination.name}</Popup>
          </CircleMarker>
          {stations.map((station) => (
            <CircleMarker
              key={station.id}
              center={[station.latitude, station.longitude]}
              radius={6}
              pathOptions={{ color: "#101211", fillColor: "#69c8df", fillOpacity: 0.95 }}
            >
              <Popup>
                <strong>{station.name}</strong>
                {station.operator && <div>Operator: {station.operator}</div>}
                {station.sockets.length > 0 && (
                  <div>
                    Connectors:{" "}
                    {station.sockets
                      .map(([type, count]) => `${type.replace("socket:", "")} (${count})`)
                      .join(", ")}
                  </div>
                )}
                <div>Availability is not provided.</div>
              </Popup>
            </CircleMarker>
          ))}
        </>
      )}
    </MapContainer>
  );
}

function TripPlanner() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [vehicleRange, setVehicleRange] = useState("350");
  const [batteryPercent, setBatteryPercent] = useState("100");
  const [route, setRoute] = useState(null);
  const [stations, setStations] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [stationMessage, setStationMessage] = useState("");
  const [historyMessage, setHistoryMessage] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsPlanning(true);
    setErrorMessage("");
    setStationMessage("");
    setHistoryMessage("");
    setRoute(null);
    setStations([]);

    try {
      const start = await geocode(origin.trim());
      await delay(1100);
      const end = await geocode(destination.trim());
      const routeUrl = `${OSRM_URL}/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&steps=false`;
      const routeResponse = await fetch(routeUrl);
      if (!routeResponse.ok) {
        throw new Error("Route service is temporarily unavailable. Please try again.");
      }
      const routeData = await routeResponse.json();
      const result = routeData.routes?.[0];
      if (!result) {
        throw new Error("No drivable route was found between those places.");
      }

      const nextRoute = {
        start,
        destination: end,
        coordinates: result.geometry.coordinates,
        distanceKm: result.distance / 1000,
        durationMinutes: result.duration / 60,
      };
      setRoute(nextRoute);

      try {
        const foundStations = await findChargers(
          result.geometry.coordinates,
          nextRoute.distanceKm,
        );
        setStations(foundStations);
        setStationMessage(
          foundStations.length
            ? `${foundStations.length} mapped stations found near this route.`
            : "No mapped charging stations were found in the route corridor.",
        );
      } catch (error) {
        setStationMessage(error.message);
      }

      const currentRange = Number(vehicleRange) * (Number(batteryPercent) / 100);
      const rangeWithReserve = currentRange * ((100 - RESERVE_PERCENT) / 100);
      const suggestedStops =
        rangeWithReserve > 0
          ? Math.max(
              0,
              Math.ceil((nextRoute.distanceKm - currentRange) / rangeWithReserve),
            )
          : 0;
      try {
        const response = await fetch(apiUrl("/profile/history/trips"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            origin: origin.trim(),
            destination: destination.trim(),
            distance_km: nextRoute.distanceKm,
            duration_minutes: nextRoute.durationMinutes,
            vehicle_range_km: Number(vehicleRange),
            battery_percent: Number(batteryPercent),
            suggested_stops: suggestedStops,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? "Sign in to save this trip to your profile."
              : data.detail || "Could not save this trip to your profile.",
          );
        }
        setHistoryMessage("Trip saved to your profile.");
      } catch (error) {
        setHistoryMessage(error.message || "Trip planned, but history could not be saved.");
      }
    } catch (error) {
      setErrorMessage(error.message || "Trip planning failed. Please try again.");
    } finally {
      setIsPlanning(false);
    }
  };

  const effectiveRange = Number(vehicleRange) * (Number(batteryPercent) / 100);
  const rangeWithReserve = effectiveRange * ((100 - RESERVE_PERCENT) / 100);
  const estimatedStops =
    route && rangeWithReserve > 0
      ? Math.max(
          0,
          Math.ceil(
            (route.distanceKm - effectiveRange) / rangeWithReserve,
          ),
        )
      : 0;
  const formattedDuration = route
    ? `${Math.floor(route.durationMinutes / 60)} hr ${Math.round(route.durationMinutes % 60)} min`
    : "";

  return (
    <main className="trip-planner-page">
      <PriceTicker />
      <nav className="trip-nav" aria-label="Trip planner navigation">
        <a className="brand" href="/">
          essiq<span>.</span>
        </a>
        <div className="charger-nav-links">
          <a href="/battery-intelligence">Battery intelligence</a>
          <a href="/chargers">Find chargers</a>
          <a href="/resale-estimator">Resale estimate</a>
          <a href="/account">My profile</a>
          <a href="/">Back to home</a>
        </div>
      </nav>

      <ServiceHero
        eyebrow="Plan with confidence"
        title="EV trip planner"
        description="Map a road route and explore charging stations listed near the way. Station availability is not live."
        image="/images/range.jpg"
        alt="An electric vehicle driving on an open road"
      />

      <section className="trip-layout" aria-label="Plan an EV trip">
        <aside className="trip-controls">
          <form className="trip-form" onSubmit={handleSubmit}>
            <label>
              <span>Starting point</span>
              <input
                value={origin}
                onChange={(event) => setOrigin(event.target.value)}
                placeholder="City, address, or place"
                maxLength={300}
                required
              />
            </label>
            <label>
              <span>Destination</span>
              <input
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                placeholder="City, address, or place"
                maxLength={300}
                required
              />
            </label>
            <label>
              <span>Estimated full-charge range (km)</span>
              <input
                type="number"
                min="1"
                max="2000"
                value={vehicleRange}
                onChange={(event) => setVehicleRange(event.target.value)}
                required
              />
            </label>
            <label>
              <span>Current battery charge (%)</span>
              <input
                type="number"
                min="1"
                max="100"
                value={batteryPercent}
                onChange={(event) => setBatteryPercent(event.target.value)}
                required
              />
            </label>
            <button type="submit" className="primary-button" disabled={isPlanning}>
              {isPlanning ? "Finding route and chargers…" : "Plan my trip"}
            </button>
          </form>

          <p className="trip-data-note">
            Range is your estimate, not live vehicle telemetry. Stop count is a
            rough calculation with a {RESERVE_PERCENT}% reserve.
          </p>
          {historyMessage && (
            <p className="trip-data-note" role="status">{historyMessage}</p>
          )}

          {errorMessage && (
            <p className="trip-error" role="alert">
              {errorMessage}
            </p>
          )}

          {route && (
            <div className="trip-results" aria-live="polite">
              <p className="eyebrow">Route estimate</p>
              <strong>{Math.round(route.distanceKm).toLocaleString()} km</strong>
              <p>Approx. driving time: {formattedDuration} (traffic not included)</p>
              <p>
                Suggested charging breaks:{" "}
                <strong>{estimatedStops}</strong>
              </p>
              <p className="trip-data-note">
                Break count uses your entered range and charge level. It does
                not select or guarantee suitable charging stops.
              </p>
            </div>
          )}

          {stationMessage && (
            <div className="station-results" aria-live="polite">
              <p className="eyebrow">Charging stations</p>
              <p>{stationMessage}</p>
              <p className="trip-data-note">
                OpenStreetMap community listings; connector details can be
                incomplete. Confirm the station and connector before travel.
              </p>
              {stations.slice(0, 6).map((station) => (
                <div className="station-item" key={station.id}>
                  <span>{station.name}</span>
                  {station.operator && <small>{station.operator}</small>}
                </div>
              ))}
            </div>
          )}
        </aside>

        <div className="trip-map-wrap">
          <TripMap route={route} stations={stations} />
          <div className="map-legend" aria-label="Map legend">
            <span><i className="legend-start" /> Start</span>
            <span><i className="legend-end" /> Destination</span>
            <span><i className="legend-charger" /> Listed charger</span>
          </div>
          <p className="map-attribution-note">
            Map tiles and station data © OpenStreetMap contributors · route via
            OSRM
          </p>
        </div>
      </section>
    </main>
  );
}

export default TripPlanner;
