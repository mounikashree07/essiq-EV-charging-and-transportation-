import { useEffect, useState } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import PriceTicker from "./PriceTicker.jsx";
import ServiceHero from "./ServiceHero.jsx";
import { apiUrl } from "./api.js";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const DEFAULT_PLACE = "Chennai, India";

function distanceKm(firstLatitude, firstLongitude, secondLatitude, secondLongitude) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(secondLatitude - firstLatitude);
  const longitudeDelta = radians(secondLongitude - firstLongitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(firstLatitude)) *
      Math.cos(radians(secondLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function statusLabel(station) {
  if (!station.is_status_fresh) return "Status data is stale";
  if (station.is_operational === true) return "Reported operational";
  if (station.is_operational === false) return "Reported not operational";
  return "Status unknown";
}

function formatStatusDate(value) {
  if (!value) return "No status timestamp";
  return new Date(value).toLocaleString();
}

function getLocationAccuracy(location) {
  return Number.isFinite(location.accuracy) && location.accuracy > 0
    ? location.accuracy
    : 100;
}

function FitStations({ stations, userLocation }) {
  const map = useMap();

  useEffect(() => {
    const bounds = stations.map((station) => [station.latitude, station.longitude]);
    if (userLocation) {
      const accuracy = getLocationAccuracy(userLocation);
      const latitudeDelta = accuracy / 111320;
      const longitudeDelta =
        accuracy /
        (111320 * Math.max(Math.cos((userLocation.latitude * Math.PI) / 180), 0.2));
      bounds.push(
        [userLocation.latitude - latitudeDelta, userLocation.longitude - longitudeDelta],
        [userLocation.latitude + latitudeDelta, userLocation.longitude + longitudeDelta],
      );
    }
    if (bounds.length > 0) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13 });
  }, [stations, userLocation, map]);
  return null;
}

function ChargerMap({ stations, userLocation }) {
  const center = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : stations.length
      ? [stations[0].latitude, stations[0].longitude]
    : [13.0827, 80.2707];

  return (
    <MapContainer className="charger-map" center={center} zoom={11} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {(stations.length > 0 || userLocation) && (
        <FitStations stations={stations} userLocation={userLocation} />
      )}
      {userLocation && (
        <>
          <Circle
            center={[userLocation.latitude, userLocation.longitude]}
            radius={Math.max(getLocationAccuracy(userLocation), 25)}
            pathOptions={{
              color: "#4ca9ff",
              weight: 1,
              fillColor: "#4ca9ff",
              fillOpacity: 0.12,
            }}
          />
          <CircleMarker
            center={[userLocation.latitude, userLocation.longitude]}
            radius={9}
            pathOptions={{
              color: "#ffffff",
              weight: 3,
              fillColor: "#4ca9ff",
              fillOpacity: 1,
            }}
          >
            <Popup>
              Your current location. Device-reported accuracy: about{" "}
              {Math.round(getLocationAccuracy(userLocation))} m.
            </Popup>
          </CircleMarker>
        </>
      )}
      {stations.map((station) => (
        <CircleMarker
          key={station.id}
          center={[station.latitude, station.longitude]}
          radius={7}
          pathOptions={{
            color: "#101211",
            fillColor: station.is_status_fresh
              ? station.is_operational === true
                ? "#c9f36a"
                : "#ff9a8b"
              : "#69c8df",
            fillOpacity: 0.95,
          }}
        >
          <Popup>
            <strong>{station.name}</strong>
            {station.operator && station.operator !== "(Unknown Operator)" && (
              <div>Operator: {station.operator}</div>
            )}
            <div>{statusLabel(station)}</div>
            <div>Status updated: {formatStatusDate(station.status_updated_at)}</div>
            <div>{station.distance_km.toFixed(1)} km from search location</div>
            {station.working_connectors !== null && (
              <div>Reported working connectors: {station.working_connectors}</div>
            )}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

async function lookupLocation(place) {
  const geocodeUrl = new URL(NOMINATIM_URL);
  geocodeUrl.search = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    q: place,
  });
  const response = await fetch(geocodeUrl);
  if (!response.ok) {
    throw new Error("Location search is temporarily unavailable. Please try again.");
  }
  const [location] = await response.json();
  if (!location) {
    throw new Error(`Could not find "${place}". Try a city or full address.`);
  }

  return {
    latitude: Number(location.lat),
    longitude: Number(location.lon),
    label: location.display_name,
  };
}

async function searchChargers(location, radiusKm) {
  const chargerUrl = new URL(apiUrl("/chargers"), window.location.origin);
  chargerUrl.search = new URLSearchParams({
    latitude: location.latitude,
    longitude: location.longitude,
    distance_km: radiusKm,
    max_results: "50",
  });

  const response = await fetch(chargerUrl);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Charger data is temporarily unavailable. Please try again.");
  }
  const data = await response.json();

  return {
    locationName: location.label,
    center: location,
    source: data.source,
    retrievedAt: data.retrieved_at,
    stations: data.chargers
      .filter(
        (station) =>
          Number.isFinite(station.latitude) && Number.isFinite(station.longitude),
      )
      .map((station) => ({
        ...station,
        distance_km: distanceKm(
          location.latitude,
          location.longitude,
          station.latitude,
          station.longitude,
        ),
      }))
      .sort((first, second) => first.distance_km - second.distance_km),
  };
}

function Chargers() {
  const [place, setPlace] = useState(DEFAULT_PLACE);
  const [radiusKm, setRadiusKm] = useState("5");
  const [userLocation, setUserLocation] = useState(null);
  const [searchedPlace, setSearchedPlace] = useState("");
  const [stations, setStations] = useState([]);
  const [fetchedAt, setFetchedAt] = useState("");
  const [dataSource, setDataSource] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [historyMessage, setHistoryMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const runSearch = async (location) => {
    setIsSearching(true);
    setErrorMessage("");
    setHistoryMessage("");
    setStations([]);
    setSearchedPlace("");
    setFetchedAt("");
    setDataSource("");

    try {
      const result = await searchChargers(location, radiusKm);
      setStations(result.stations);
      setSearchedPlace(result.locationName);
      setFetchedAt(new Date(result.retrievedAt).toLocaleString());
      setDataSource(result.source);
      setUserLocation(location.isCurrentLocation ? result.center : null);
      if (result.stations.length > 0) {
        try {
          const response = await fetch(
            apiUrl("/profile/history/charger-searches"),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                location_label: location.isCurrentLocation
                  ? "Nearby stations from current location"
                  : place.trim(),
                source: result.source,
                stations: result.stations.map((station) => ({
                  id: String(station.id),
                  name: station.name,
                  operator: station.operator || null,
                  address: station.address || null,
                  latitude: station.latitude,
                  longitude: station.longitude,
                })),
              }),
            },
          );
          const data = await response.json();
          if (!response.ok) {
            throw new Error(
              response.status === 401
                ? "Sign in to save these charging points to your profile."
                : data.detail || "Could not save these charging points.",
            );
          }
          setHistoryMessage("Charging points saved to your profile.");
        } catch (error) {
          setHistoryMessage(error.message || "Charging points found, but history could not be saved.");
        }
      }
    } catch (error) {
      setErrorMessage(error.message || "Charger search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    try {
      const location = await lookupLocation(place.trim());
      await runSearch(location);
    } catch (error) {
      setErrorMessage(error.message || "Location search failed. Please try again.");
    }
  };

  const handleUseCurrentLocation = () => {
    setErrorMessage("");
    if (!navigator.geolocation) {
      setErrorMessage("This browser does not support location access. Search by area instead.");
      return;
    }

    setIsSearching(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const location = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          label: "Your current location",
          isCurrentLocation: true,
        };
        setUserLocation(location);
        await runSearch(location);
      },
      (error) => {
        const messages = {
          1: "Location permission was denied. Allow location access in your browser or search by area.",
          2: "Your location could not be determined. Try again or search by area.",
          3: "Location request timed out. Try again or search by area.",
        };
        setErrorMessage(messages[error.code] || "Could not access your location. Search by area instead.");
        setIsSearching(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <main className="chargers-page">
      <PriceTicker />
      <nav className="trip-nav" aria-label="Charging page navigation">
        <a className="brand" href="/">
          essiq<span>.</span>
        </a>
        <div className="charger-nav-links">
          <a href="/battery-intelligence">Battery intelligence</a>
          <a href="/trip-planner">Trip planner</a>
          <a href="/resale-estimator">Resale estimate</a>
          <a href="/account">My profile</a>
          <a href="/">Back to home</a>
        </div>
      </nav>

      <ServiceHero
        eyebrow="Find your next charging stop"
        title="Charging stations"
        description="Browse community-reported stations by area. Status reports may be old, listed tariffs may not be current, and queue times aren’t provided."
        image="/images/charging.jpg"
        alt="A row of electric vehicle charging stations"
      />

      <section className="chargers-layout" aria-label="Charging stations near you">
        <aside className="chargers-sidebar">
          <form className="charger-search-form" onSubmit={handleSearch}>
            <label htmlFor="charger-location">Search an area</label>
            <input
              id="charger-location"
              value={place}
              onChange={(event) => setPlace(event.target.value)}
              placeholder="City, address, or place"
              maxLength={300}
              required
            />
            <label htmlFor="charger-radius">Search radius</label>
            <select
              id="charger-radius"
              value={radiusKm}
              onChange={(event) => setRadiusKm(event.target.value)}
            >
              <option value="5">Within 5 km</option>
              <option value="10">Within 10 km</option>
              <option value="25">Within 25 km</option>
              <option value="50">Within 50 km</option>
            </select>
            <button type="submit" className="primary-button" disabled={isSearching}>
              {isSearching ? "Searching stations…" : "Find chargers"}
            </button>
            <button
              type="button"
              className="location-button"
              onClick={handleUseCurrentLocation}
              disabled={isSearching}
            >
              {isSearching ? "Getting nearby chargers…" : "Use my current location"}
            </button>
          </form>

          <p className="trip-data-note">
            Your location is requested only when you press the button. The
            coordinates are sent to Open Charge Map to find nearby stations.
          </p>

          <div className="live-data-notice" role="note">
            <strong>Open Charge Map data is connected</strong>
            <p>
              Status records are community-reported and may be old. We only
              show working-connector counts when the station status was updated
              within the last 15 minutes and every connector has a status.
              Queue times are not provided. Treat listed tariffs as unverified.
            </p>
          </div>

          {errorMessage && (
            <p className="trip-error" role="alert">
              {errorMessage}
            </p>
          )}
          {historyMessage && (
            <p className="trip-data-note" role="status">{historyMessage}</p>
          )}

          {searchedPlace && (
            <div className="charger-listings" aria-live="polite">
              <div className="charger-count">
                <span>Stations returned by {dataSource}</span>
                <strong>{stations.length}</strong>
              </div>
              <p className="trip-data-note">
                Results within {radiusKm} km of {searchedPlace}. Listings retrieved {fetchedAt}.
                This is a station count, not a count of working plugs.
              </p>
              {userLocation && (
                <p className="trip-data-note">
                  Your device reported location accuracy of about{" "}
                  {Math.round(getLocationAccuracy(userLocation))} m. Distances are
                  approximate.
                </p>
              )}

              {stations.length === 0 ? (
                <p className="charger-empty">
                  No community-mapped charging stations were found in this
                  search area.
                </p>
              ) : (
                stations.map((station) => (
                  <article className="charger-card" key={station.id}>
                    <div className="charger-card-heading">
                      <h2>{station.name}</h2>
                      <span
                        className={
                          station.is_status_fresh
                            ? station.is_operational
                              ? "charger-status-current"
                              : "charger-status-unavailable"
                            : "charger-status-stale"
                        }
                      >
                        {statusLabel(station)}
                      </span>
                    </div>
                    {station.operator && station.operator !== "(Unknown Operator)" && (
                      <p className="charger-operator">{station.operator}</p>
                    )}
                    <p className="charger-operator">
                      Status update: {formatStatusDate(station.status_updated_at)}
                    </p>
                      {station.connectors.length > 0 && (
                        <p className="charger-operator">
                          Listed connectors:{" "}
                          {station.connectors
                            .map(
                              (connector) =>
                                `${connector.type || "Unknown"} × ${connector.quantity}` +
                                (connector.power_kw ? ` (${connector.power_kw} kW)` : ""),
                            )
                            .join(", ")}
                        </p>
                      )}
                      <dl className="charger-details">
                      <div>
                        <dt>Distance</dt>
                        <dd>{station.distance_km.toFixed(1)} km away</dd>
                    </div>
                    <div>
                        <dt>Reported working plugs</dt>
                        <dd>
                          {station.working_connectors === null
                            ? "Not available"
                            : station.working_connectors}
                        </dd>
                      </div>
                      <div>
                        <dt>Wait time</dt>
                        <dd>Not provided</dd>
                      </div>
                      <div>
                        <dt>Listed tariff (unverified)</dt>
                        <dd>{station.usage_cost || "Not provided"}</dd>
                      </div>
                    </dl>
                  </article>
                ))
              )}
            </div>
          )}
        </aside>

        <div className="chargers-map-wrap">
          <ChargerMap stations={stations} userLocation={userLocation} />
          {userLocation && (
            <div className="map-legend" aria-label="Map legend">
              <span>
                <i className="legend-user-location" /> Your location and
                approximate accuracy area
              </span>
              <span>
                <i className="legend-charger" /> Charging station
              </span>
            </div>
          )}
          <p className="map-attribution-note">
            Charging-station data © Open Charge Map contributors. Map tiles ©
            OpenStreetMap contributors. Listings and details may be incomplete.
          </p>
        </div>
      </section>
    </main>
  );
}

export default Chargers;
