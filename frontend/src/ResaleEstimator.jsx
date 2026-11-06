import { useState } from "react";
import PriceTicker from "./PriceTicker.jsx";
import ServiceHero from "./ServiceHero.jsx";

const currentYear = new Date().getFullYear();

const initialForm = {
  vehicle: "",
  modelYear: String(currentYear - 2),
  originalPrice: "",
  lowAnnualDepreciation: "8",
  highAnnualDepreciation: "12",
  conditionAdjustment: "0",
  batteryAdjustment: "0",
};

function calculateEstimate(form) {
  const ageYears = Math.max(0, currentYear - Number(form.modelYear));
  const originalPrice = Number(form.originalPrice);
  const lowRate = Number(form.lowAnnualDepreciation) / 100;
  const highRate = Number(form.highAnnualDepreciation) / 100;
  const conditionFactor = 1 - Number(form.conditionAdjustment) / 100;
  const batteryFactor = 1 - Number(form.batteryAdjustment) / 100;
  const adjustmentFactor = conditionFactor * batteryFactor;

  return {
    ageYears,
    lower: Math.round(originalPrice * (1 - highRate) ** ageYears * adjustmentFactor),
    upper: Math.round(originalPrice * (1 - lowRate) ** ageYears * adjustmentFactor),
  };
}

function formatRupees(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function ResaleEstimator() {
  const [form, setForm] = useState(initialForm);
  const [estimate, setEstimate] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setErrorMessage("");

    const lowerRate = Number(form.lowAnnualDepreciation);
    const upperRate = Number(form.highAnnualDepreciation);
    if (lowerRate > upperRate) {
      setErrorMessage("The lower annual depreciation rate must not exceed the higher rate.");
      setEstimate(null);
      return;
    }

    setEstimate(calculateEstimate(form));
  };

  const handleReset = () => {
    setForm(initialForm);
    setEstimate(null);
    setErrorMessage("");
  };

  return (
    <main className="resale-page">
      <PriceTicker />
      <nav className="trip-nav" aria-label="Resale estimator navigation">
        <a className="brand" href="/">
          essiq<span>.</span>
        </a>
        <div className="charger-nav-links">
          <a href="/battery-intelligence">Battery intelligence</a>
          <a href="/trip-planner">Trip planner</a>
          <a href="/chargers">Find chargers</a>
          <a href="/account">My profile</a>
          <a href="/">Back to home</a>
        </div>
      </nav>

      <ServiceHero
        eyebrow="Plan your next move"
        title="EV resale estimator"
        description="Explore a value range using your vehicle details and assumptions. This is a planning estimate, not a live market valuation."
        image="/images/resale.jpg"
        alt="An electric vehicle ready for its next journey"
      />

      <section className="resale-layout" aria-label="Estimate EV resale value">
        <form className="resale-form" onSubmit={handleSubmit}>
          <label>
            <span>Vehicle make and model</span>
            <input
              type="text"
              name="vehicle"
              placeholder="For example, Tata Nexon EV"
              value={form.vehicle}
              onChange={handleChange}
            />
          </label>

          <label>
            <span>Model year</span>
            <input
              type="number"
              name="modelYear"
              min="1990"
              max={currentYear}
              value={form.modelYear}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            <span>Original purchase price (INR)</span>
            <input
              type="number"
              name="originalPrice"
              min="1"
              step="1"
              placeholder="Enter the original price"
              value={form.originalPrice}
              onChange={handleChange}
              required
            />
          </label>

          <fieldset className="resale-assumptions">
            <legend>Depreciation scenario assumptions</legend>
            <p>
              These are editable example assumptions, not measured EV-market
              rates. The lower rate gives the higher end of the estimate.
            </p>
            <div className="resale-rate-grid">
              <label>
                <span>Lower annual depreciation (%)</span>
                <input
                  type="number"
                  name="lowAnnualDepreciation"
                  min="0"
                  max="99"
                  step="0.5"
                  value={form.lowAnnualDepreciation}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                <span>Higher annual depreciation (%)</span>
                <input
                  type="number"
                  name="highAnnualDepreciation"
                  min="0"
                  max="99"
                  step="0.5"
                  value={form.highAnnualDepreciation}
                  onChange={handleChange}
                  required
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="resale-assumptions">
            <legend>Optional value adjustments</legend>
            <p>
              Set these only if you want to apply your own discounts. They are
              not automatically inferred from battery health or condition.
            </p>
            <div className="resale-rate-grid">
              <label>
                <span>Condition adjustment (%)</span>
                <input
                  type="number"
                  name="conditionAdjustment"
                  min="0"
                  max="80"
                  step="1"
                  value={form.conditionAdjustment}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                <span>Battery adjustment (%)</span>
                <input
                  type="number"
                  name="batteryAdjustment"
                  min="0"
                  max="80"
                  step="1"
                  value={form.batteryAdjustment}
                  onChange={handleChange}
                  required
                />
              </label>
            </div>
          </fieldset>

          {errorMessage && (
            <p className="trip-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="resale-actions">
            <button type="submit" className="primary-button">
              Calculate estimate
            </button>
            <button type="button" className="location-button" onClick={handleReset}>
              Reset
            </button>
          </div>
        </form>

        <aside className="resale-results" aria-live="polite">
          {estimate ? (
            <>
              <p className="eyebrow">Illustrative estimate</p>
              <h2>{form.vehicle.trim() || "Your EV"}</h2>
              <p className="resale-model-meta">
                Model year {form.modelYear} · {estimate.ageYears}{" "}
                {estimate.ageYears === 1 ? "year" : "years"} old
              </p>
              <p className="resale-range">
                {formatRupees(estimate.lower)}
                <span>to</span>
                {formatRupees(estimate.upper)}
              </p>
              <p className="trip-data-note">
                Calculated from the original price using your selected annual
                depreciation range and optional adjustments. No current
                listings or transaction data are included.
              </p>
              <div className="resale-formula">
                <strong>Calculation</strong>
                <p>
                  Original price × (1 − annual depreciation)<sup>vehicle age</sup>{" "}
                  × (1 − condition adjustment) × (1 − battery adjustment)
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="eyebrow">Your estimate will appear here</p>
              <h2>Start with your EV details.</h2>
              <p>
                Enter the original purchase price and choose depreciation
                assumptions to see an illustrative resale-value range.
              </p>
            </>
          )}
          <div className="resale-disclaimer">
            <strong>Not a live market price</strong>
            <p>
              Actual resale value depends on local listings, trim, mileage,
              service history, warranty, battery report, and buyer demand.
              Compare current listings and get a professional valuation before
              making a sale decision.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default ResaleEstimator;
