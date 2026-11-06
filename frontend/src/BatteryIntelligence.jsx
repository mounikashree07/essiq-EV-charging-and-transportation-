import { useState } from "react";
import PriceTicker from "./PriceTicker.jsx";
import ServiceHero from "./ServiceHero.jsx";

const initialForm = {
  vehicle: "",
  originalCapacity: "",
  currentCapacity: "",
};

function BatteryIntelligence() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setErrorMessage("");

    const originalCapacity = Number(form.originalCapacity);
    const currentCapacity = Number(form.currentCapacity);
    if (
      !Number.isFinite(originalCapacity) ||
      !Number.isFinite(currentCapacity) ||
      originalCapacity <= 0 ||
      currentCapacity <= 0
    ) {
      setErrorMessage("Enter valid capacity values greater than zero.");
      setResult(null);
      return;
    }

    setResult({
      originalCapacity,
      currentCapacity,
      retainedPercent: (currentCapacity / originalCapacity) * 100,
      lostCapacity: originalCapacity - currentCapacity,
      vehicle: form.vehicle.trim(),
    });
  };

  const handleReset = () => {
    setForm(initialForm);
    setResult(null);
    setErrorMessage("");
  };

  const formatKwh = (value) =>
    `${Math.abs(value).toLocaleString(undefined, {
      maximumFractionDigits: 1,
    })} kWh`;

  const isAboveOriginal = result && result.currentCapacity > result.originalCapacity;
  const capacityInsight = !result
    ? null
    : isAboveOriginal
      ? {
          title: "Check the capacity inputs",
          text: `The current value is ${formatKwh(result.currentCapacity - result.originalCapacity)} above the original value. This can happen when the two figures use different capacity definitions or test conditions; it does not mean the battery gained capacity.`,
        }
      : result.currentCapacity === result.originalCapacity
        ? {
            title: "The entered values match",
            text: "These two values show no capacity difference. That alone does not confirm the battery is in perfect condition.",
          }
        : {
            title: "Lower measured capacity",
            text: `The entered current capacity is ${formatKwh(result.lostCapacity)} below the original (${(100 - result.retainedPercent).toFixed(1)}% difference by this calculation). This comparison does not identify the cause or determine whether the battery needs repair.`,
          };

  return (
    <main className="battery-intelligence-page">
      <PriceTicker />
      <nav className="trip-nav" aria-label="Battery intelligence navigation">
        <a className="brand" href="/">
          essiq<span>.</span>
        </a>
        <div className="charger-nav-links">
          <a href="/trip-planner">Trip planner</a>
          <a href="/chargers">Find chargers</a>
          <a href="/resale-estimator">Resale estimate</a>
          <a href="/account">My profile</a>
          <a href="/">Back to home</a>
        </div>
      </nav>

      <ServiceHero
        eyebrow="Understand your battery data"
        title="Battery health intelligence"
        description="Compare your EV battery’s original usable capacity with a current measured usable capacity to estimate capacity retention."
        image="/images/battery.jpg"
        alt="An electric vehicle battery pack"
      />

      <section className="battery-intelligence-layout" aria-label="Estimate battery capacity retention">
        <form className="battery-capacity-form" onSubmit={handleSubmit}>
          <label>
            <span>Vehicle make and model (optional)</span>
            <input
              type="text"
              name="vehicle"
              placeholder="For example, Tata Nexon EV"
              value={form.vehicle}
              onChange={handleChange}
            />
          </label>

          <label>
            <span>Original usable capacity (kWh)</span>
            <input
              type="number"
              name="originalCapacity"
              min="0.1"
              max="1000"
              step="0.1"
              placeholder="For example, 75"
              value={form.originalCapacity}
              onChange={handleChange}
              required
            />
            <small>
              Use the manufacturer-rated usable capacity, not necessarily the
              gross pack capacity.
            </small>
          </label>

          <label>
            <span>Current measured usable capacity (kWh)</span>
            <input
              type="number"
              name="currentCapacity"
              min="0.1"
              max="1000"
              step="0.1"
              placeholder="For example, 60"
              value={form.currentCapacity}
              onChange={handleChange}
              required
            />
            <small>
              Use a BMS/service report or a measured value—not dashboard range
              alone.
            </small>
          </label>

          {errorMessage && (
            <p className="trip-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="battery-capacity-actions">
            <button type="submit" className="primary-button">
              Estimate capacity retention
            </button>
            <button type="button" className="location-button" onClick={handleReset}>
              Reset
            </button>
          </div>
        </form>

        <aside className="battery-intelligence-result" aria-live="polite">
          {result ? (
            <>
              <p className="eyebrow">Entered-capacity estimate</p>
              <h2>{result.vehicle || "Your EV battery"}</h2>
              <p className="battery-retention-value">
                {result.retainedPercent.toFixed(1)}%
              </p>
              <p className="battery-retention-label">calculated capacity retention</p>
              <dl className="battery-capacity-breakdown">
                <div>
                  <dt>Original usable capacity</dt>
                  <dd>{formatKwh(result.originalCapacity)}</dd>
                </div>
                <div>
                  <dt>Current measured capacity</dt>
                  <dd>{formatKwh(result.currentCapacity)}</dd>
                </div>
                <div>
                  <dt>Capacity difference</dt>
                  <dd>
                    {isAboveOriginal
                      ? `${formatKwh(result.currentCapacity - result.originalCapacity)} above original`
                      : `${formatKwh(result.lostCapacity)} lower`}
                  </dd>
                </div>
              </dl>
              {isAboveOriginal && (
                <p className="battery-estimate-warning" role="status">
                  The entered current value is higher than the original. Check
                  that both values use the same usable-capacity definition and
                  measurement conditions.
                </p>
              )}
              <p className="battery-estimate-note">
                Formula: current measured usable capacity ÷ original usable
                capacity × 100. This uses only the numbers you entered.
              </p>
              <section className="battery-insights" aria-label="Battery insights and recommendations">
                <div>
                  <p className="eyebrow">Insight</p>
                  <h3>{capacityInsight.title}</h3>
                  <p>{capacityInsight.text}</p>
                </div>
                <div>
                  <p className="eyebrow">Recommended next steps</p>
                  <ul>
                    <li>
                      Confirm both figures describe usable capacity and come
                      from comparable measurement conditions.
                    </li>
                    <li>
                      If the current figure is an estimate or dashboard range,
                      ask an authorized service center for a battery capacity
                      test before making a decision.
                    </li>
                    <li>
                      Save comparable readings over time. If capacity changes
                      unexpectedly or the vehicle shows a battery warning,
                      contact the manufacturer or an authorized service center.
                    </li>
                  </ul>
                </div>
              </section>
            </>
          ) : (
            <>
              <p className="eyebrow">Your estimate will appear here</p>
              <h2>Start with two capacity values.</h2>
              <p>
                Enter the original and current usable capacity to calculate a
                transparent retention estimate.
              </p>
            </>
          )}

          <div className="battery-data-disclaimer">
            <strong>Not a live diagnosis</strong>
            <p>
              essiq does not read your vehicle’s BMS. The result is not a
              manufacturer-certified battery health report. For a useful
              comparison, use trustworthy measurements taken under comparable
              conditions. Battery capacity retention is only one part of
              battery condition.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default BatteryIntelligence;
