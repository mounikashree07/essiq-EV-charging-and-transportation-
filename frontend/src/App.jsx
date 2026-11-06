import { useEffect, useState } from "react";
import TripPlanner from "./TripPlanner.jsx";
import Chargers from "./Chargers.jsx";
import ResaleEstimator from "./ResaleEstimator.jsx";
import BatteryIntelligence from "./BatteryIntelligence.jsx";
import PriceTicker from "./PriceTicker.jsx";
import { apiUrl } from "./api.js";

const features = [
  {
    id: "battery",
    number: "01",
    title: "Battery health, made clear",
    description:
      "Understand the condition of an EV's most important component with a simple, transparent health estimate.",
    image: "/images/passport.jpg",
    alt: "Close-up of an electric vehicle battery pack",
  },
  {
    id: "range",
    number: "02",
    title: "Know your real-world range",
    description:
      "See what everyday driving can look like, beyond the number on the spec sheet.",
    image: "/images/range.jpg",
    alt: "Electric car on a road",
  },
  {
    id: "charging",
    number: "03",
    title: "Charging that fits your life",
    description:
      "Explore charging options and get a clearer picture of what ownership could look like.",
    image: "/images/charging.jpg",
    alt: "A row of electric vehicle charging stations",
  },
];

const initialForm = { name: "", email: "", password: "" };

function App() {
  const [battery, setBattery] = useState(null);
  const [error, setError] = useState(false);
  const [formData, setFormData] = useState(() => ({
    ...initialForm,
    email: new URLSearchParams(window.location.search).get("email") || "",
  }));
  const [authUser, setAuthUser] = useState(null);
  const [profileHistory, setProfileHistory] = useState({
    trips: [],
    charger_searches: [],
  });
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [authMessage, setAuthMessage] = useState(() =>
    window.location.search.includes("created=1")
      ? "Account created. Log in with your new account."
      : "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingUser, setIsCheckingUser] = useState(true);
  const currentPath = window.location.pathname;
  const isSignupPage = currentPath === "/signup";
  const isLoginPage = currentPath === "/login";
  const isAccountPage = currentPath === "/account";
  const isAuthPage = isSignupPage || isLoginPage || isAccountPage;
  const isTripPlannerPage = currentPath === "/trip-planner";
  const isChargersPage = currentPath === "/chargers";
  const isResalePage = currentPath === "/resale-estimator";
  const isBatteryIntelligencePage = currentPath === "/battery-intelligence";

  useEffect(() => {
    if (!window.location.pathname.match(/^\/(login|signup|account|trip-planner|chargers|resale-estimator|battery-intelligence)\/?$/)) {
      fetch(apiUrl("/battery/health"))
        .then((res) => {
          if (!res.ok) throw new Error("Battery health request failed");
          return res.json();
        })
        .then((data) => setBattery(data))
        .catch(() => setError(true));
    }

    fetch(apiUrl("/me"), { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error("Could not check the current session.");
        return response.json();
      })
      .then((data) => setAuthUser(data.authenticated ? data.user : null))
      .catch(() => setAuthUser(null))
      .finally(() => setIsCheckingUser(false));
  }, []);

  useEffect(() => {
    if (isAccountPage && !isCheckingUser && !authUser) {
      window.location.replace("/login");
    }
  }, [isAccountPage, isCheckingUser, authUser]);

  useEffect(() => {
    if (!isAccountPage || !authUser) return;

    fetch(apiUrl("/profile/history"), { credentials: "include" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || "Could not load profile history.");
        }
        return data;
      })
      .then(setProfileHistory)
      .catch((requestError) => {
        setHistoryError(requestError.message || "Could not load profile history.");
      })
      .finally(() => setIsLoadingHistory(false));
  }, [isAccountPage, authUser]);

  if (isTripPlannerPage) {
    return <TripPlanner />;
  }
  if (isChargersPage) {
    return <Chargers />;
  }
  if (isResalePage) {
    return <ResaleEstimator />;
  }
  if (isBatteryIntelligencePage) {
    return <BatteryIntelligence />;
  }

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setAuthMessage("");

    try {
      const endpoint = isSignupPage ? "/signup" : "/login";
      const payload =
        isSignupPage
          ? { name: formData.name, email: formData.email, password: formData.password }
          : { email: formData.email, password: formData.password };

      const response = await fetch(apiUrl(endpoint), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Authentication failed.");
      }

      if (isSignupPage) {
        window.location.href = `/login?created=1&email=${encodeURIComponent(formData.email)}`;
      } else {
        window.location.href = "/account";
      }
    } catch (error) {
      setAuthMessage(
        error instanceof TypeError
          ? "Cannot reach the essiq server. Start the FastAPI backend and try again."
          : error.message || "Something went wrong.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(apiUrl("/logout"), {
        method: "POST",
        credentials: "include",
      });
      window.location.href = "/login?logged_out=1";
    } catch {
      setAuthMessage("Logout failed. Please try again.");
    }
  };

  if (isAuthPage) {
    const showAccount = isAccountPage && authUser;

    return (
      <main className="auth-page">
        <PriceTicker />
        <nav className="auth-page-nav" aria-label="Account navigation">
          <a className="brand" href="/">
            essiq<span>.</span>
          </a>
          <a className="auth-back-link" href="/">
            Back to home
          </a>
        </nav>

        <section className="auth-page-content">
          {showAccount ? (
            <div className="auth-card account-card">
              <div className="account-panel">
                <p className="eyebrow">Your EV profile</p>
                <p className="welcome-label">Signed in</p>
                <h1>Welcome back, {authUser.name}.</h1>
                <p>{authUser.email}</p>
                <button type="button" className="secondary-button" onClick={handleLogout}>
                  Log out
                </button>
              </div>

              <section className="profile-history" aria-labelledby="profile-trips-title">
                <div className="profile-history-heading">
                  <p className="eyebrow">Saved to your account</p>
                  <h2 id="profile-trips-title">Previous trips</h2>
                </div>
                {isLoadingHistory ? (
                  <p className="profile-empty">Loading your saved trips…</p>
                ) : historyError ? (
                  <p className="trip-error" role="alert">{historyError}</p>
                ) : profileHistory.trips.length === 0 ? (
                  <p className="profile-empty">
                    Your planned trips will appear here after you plan one while signed in.
                  </p>
                ) : (
                  <div className="profile-history-list">
                    {profileHistory.trips.map((trip) => (
                      <article
                        className="profile-history-card"
                        key={trip._id || `${trip.origin}-${trip.created_at}`}
                      >
                        <div>
                          <h3>
                            {trip.origin} <span aria-hidden="true">→</span>{" "}
                            {trip.destination}
                          </h3>
                          <p>{new Date(trip.created_at).toLocaleString()}</p>
                        </div>
                        <p>
                          {Math.round(trip.distance_km).toLocaleString()} km · about{" "}
                          {Math.floor(trip.duration_minutes / 60)} hr{" "}
                          {Math.round(trip.duration_minutes % 60)} min ·{" "}
                          {trip.suggested_stops} suggested charging breaks
                        </p>
                        <p>
                          Planned with {trip.vehicle_range_km} km estimated range
                          at {trip.battery_percent}% charge.
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="profile-history" aria-labelledby="profile-chargers-title">
                <div className="profile-history-heading">
                  <p className="eyebrow">Station searches</p>
                  <h2 id="profile-chargers-title">Previously found charging points</h2>
                </div>
                {isLoadingHistory ? (
                  <p className="profile-empty">Loading your charging history…</p>
                ) : historyError ? (
                  <p className="trip-error" role="alert">{historyError}</p>
                ) : profileHistory.charger_searches.length === 0 ? (
                  <p className="profile-empty">
                    Charging stations you find while signed in will be saved here.
                  </p>
                ) : (
                  <div className="profile-history-list">
                    {profileHistory.charger_searches.map((search) => (
                      <article
                        className="profile-history-card"
                        key={search._id || `${search.location_label}-${search.created_at}`}
                      >
                        <div>
                          <h3>{search.location_label}</h3>
                          <p>
                            {new Date(search.created_at).toLocaleString()} ·{" "}
                            {search.stations.length} stations
                          </p>
                        </div>
                        <ul className="profile-station-list">
                          {search.stations.map((station) => (
                            <li key={station.id}>
                              <a
                                href={`https://www.openstreetmap.org/?mlat=${station.latitude}&mlon=${station.longitude}#map=16/${station.latitude}/${station.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {station.name}
                              </a>
                              {station.operator && <span>{station.operator}</span>}
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                )}
                <p className="trip-data-note">
                  Saved station listings are community data and do not guarantee live availability.
                </p>
              </section>
            </div>
          ) : isCheckingUser && isAccountPage ? (
            <div className="auth-card">
              <p>Checking your account…</p>
            </div>
          ) : isAccountPage ? (
            <div className="auth-card">
              <p>Redirecting to sign in…</p>
            </div>
          ) : (
            <div className="auth-card">
              <div className="auth-intro">
                <p className="eyebrow">{isSignupPage ? "Join essiq" : "Welcome back"}</p>
                <h1>{isSignupPage ? "Create your account." : "Sign in to essiq."}</h1>
                <p>
                  {isSignupPage
                    ? "Save your account and keep your EV details in one place."
                    : "Sign in to continue to your EV profile."}
                </p>
              </div>

              <form className="auth-form" onSubmit={handleAuthSubmit}>
                {isSignupPage && (
                  <label>
                    <span>Full name</span>
                    <input
                      type="text"
                      name="name"
                      autoComplete="name"
                      placeholder="Alex Morgan"
                      value={formData.name}
                      onChange={handleFormChange}
                      required
                    />
                  </label>
                )}

                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleFormChange}
                    required
                  />
                </label>

                <label>
                  <span>Password</span>
                  <input
                    type="password"
                    name="password"
                    autoComplete={isSignupPage ? "new-password" : "current-password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleFormChange}
                    minLength="6"
                    required
                  />
                </label>

                {(authMessage || window.location.search.includes("logged_out=1")) && (
                  <p className="auth-message" role="status">
                    {authMessage || "You have been logged out."}
                  </p>
                )}

                <button type="submit" className="primary-button" disabled={isSubmitting}>
                  {isSubmitting
                    ? isSignupPage
                      ? "Creating account..."
                      : "Signing in..."
                    : isSignupPage
                      ? "Create account"
                      : "Sign in"}
                </button>
              </form>

              <p className="auth-switch">
                {isSignupPage ? "Already have an account?" : "New to essiq?"}{" "}
                <a href={isSignupPage ? "/login" : "/signup"}>
                  {isSignupPage ? "Sign in" : "Create an account"}
                </a>
              </p>
            </div>
          )}
        </section>
        <footer className="auth-page-footer">
          <p>Clarity for your electric journey.</p>
        </footer>
      </main>
    );
  }

  return (
    <>
      <PriceTicker />
      <nav className="site-nav" aria-label="Main navigation">
        <a className="brand" href="#" aria-label="essiq home">
          essiq<span>.</span>
        </a>
        <div className="nav-links">
          <a href="#battery">Battery</a>
          <a href="/battery-intelligence">Battery intelligence</a>
          <a href="#range">Range</a>
          <a href="#charging">Charging</a>
          <a href="/trip-planner">Trip planner</a>
          <a href="/chargers">Find chargers</a>
          <a href="/resale-estimator">Resale estimate</a>
        </div>
        <a className="nav-cta" href={authUser ? "/account" : "/login"}>
          {authUser ? "My account" : "Sign in"} <span aria-hidden="true">↗</span>
        </a>
      </nav>

      <main>
        <section className="hero" id="explore">
          <div className="hero-copy">
            <p className="eyebrow">A clearer way to choose electric</p>
            <h1>
              Go electric.<br />
              Go with confidence.
            </h1>
            <p className="hero-description">
              Battery health, real-world range, charging and resale — all the
              details that make your next EV decision feel simple.
            </p>
            <a className="button-link" href="#battery">
              Discover your EV <span aria-hidden="true">↓</span>
            </a>
            <a className="button-link trip-planner-link" href="/battery-intelligence">
              Battery intelligence <span aria-hidden="true">↗</span>
            </a>
            <a className="button-link trip-planner-link" href="/trip-planner">
              Plan a trip <span aria-hidden="true">↗</span>
            </a>
            <a className="button-link trip-planner-link" href="/resale-estimator">
              Estimate resale value <span aria-hidden="true">↗</span>
            </a>
          </div>
          <figure className="hero-photo">
            <img
              src="/images/hero.jpg"
              alt="An electric car connected to a charger at night"
            />
            <figcaption>Better insight for the road ahead.</figcaption>
          </figure>
        </section>

        <section className="intro">
          <p className="eyebrow">The essentials, in one place</p>
          <h2>Everything you need to know before you plug in.</h2>
        </section>

        <section className="feature-grid" aria-label="EV ownership essentials">
          {features.map((feature) => (
            <article className="feature-card" id={feature.id} key={feature.id}>
              <div className="feature-photo">
                <img src={feature.image} alt={feature.alt} loading="lazy" />
              </div>
              <div className="feature-copy">
                <span className="feature-number">{feature.number}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                {feature.id === "battery" && (
                  <div className="battery-reading">
                    <span>
                      Homepage value: {battery?.data_basis || (error ? "Unavailable" : "Loading")} — not a vehicle-specific reading.
                    </span>
                  </div>
                )}
                {feature.id === "battery" && (
                  <a className="feature-action-link" href="/battery-intelligence">
                    Estimate capacity retention <span aria-hidden="true">↗</span>
                  </a>
                )}
              </div>
            </article>
          ))}
        </section>

        <section className="closing">
          <img
            src="/images/resale.jpg"
            alt="An electric car ready for its next journey"
            loading="lazy"
          />
          <div className="closing-copy">
            <p className="eyebrow">Your next chapter starts here</p>
            <h2>Make your next EV decision a confident one.</h2>
            <a className="button-link" href="#explore">
              Back to the top <span aria-hidden="true">↑</span>
            </a>
          </div>
        </section>
      </main>

      <footer>
        <a className="brand" href="#explore">essiq<span>.</span></a>
        <p>Clarity for your electric journey.</p>
      </footer>
    </>
  );
}

export default App;
