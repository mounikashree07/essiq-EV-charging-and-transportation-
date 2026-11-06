function PriceTicker() {
  return (
    <aside className="price-ticker" aria-label="EV charging price update">
      <strong>Charging prices · India</strong>
      <span>
        No verified India-wide daily price trend is connected yet. Rates vary by
        station and operator.
      </span>
      <a href="/chargers">Check nearby stations</a>
    </aside>
  );
}

export default PriceTicker;
