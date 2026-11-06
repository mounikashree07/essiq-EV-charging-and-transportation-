# EV Trust — Master Project Brief

## Project Overview

**EV Trust** is a college project for an intelligent electric-vehicle ownership
platform. It is designed to answer one central question:

> Can I trust my EV?

The platform brings battery-health insight, realistic range estimates, charging
guidance, route planning, and resale-value advice into one coherent experience.
It is intended to become a working full-stack system with real data flow,
explainable calculations, database storage, APIs, and clear fallback behaviour
— not just a static UI concept.

The project should be technically credible and transparent about its data. It
must never present simulated, estimated, historical, curated, or unavailable
information as live real-world data.

## Product Vision

EV Trust aims to combine:

- An EV battery health report
- Practical range intelligence
- Route and charging guidance
- Charging-station reliability recommendations
- Resale-value advice
- Alerts and clear next steps for the owner

The experience should help an owner understand:

- How healthy is my EV?
- How far can I really drive?
- Where can I reliably charge?
- How much might my EV be worth?
- What should I pay attention to?
- What should I do next?

Above all, the product should help answer:

> Can I trust my EV?

## Product Principles

1. **Be transparent:** explain the source and limitations of user-facing data.
2. **Be explainable:** show the inputs and factors behind estimates and
   recommendations.
3. **Be honest about availability:** gracefully show when a service or source is
   unavailable instead of inventing a live result.
4. **Separate evidence types:** do not silently combine laboratory battery data,
   simulated examples, curated station records, and live vehicle telemetry.
5. **Prioritize a coherent core:** build reliable features and data flows before
   expanding into every possible EV feature.

## Design Direction

Use the Tesla Supercharger website as a visual reference for clarity,
confidence, map-led interactions, charging-focused hierarchy, and premium
simplicity. This is a design reference only: do not copy Tesla branding or imply
any affiliation with Tesla.

The intended aesthetic is **Quiet Intelligence**:

- Clean and calm, never cluttered
- Premium but practical
- High trust, with restrained use of colour
- Important risks made visible without causing alarm
- Data-rich interfaces that remain easy to understand
- Maps, battery-health summaries, and recommendations presented as one unified
  product

Visual polish supports the product but does not replace working functionality,
reliable data flow, or clear limitations.

## Technology Decisions

### Database — Confirmed

Use **MongoDB**. Its flexible document model is a fit for the project's
potentially changing data structures, including:

- Vehicle profiles
- Battery-health histories
- Charging-station records
- User preferences
- Route results
- ML predictions
- Alerts and recommendations
- Curated or demo station information

### Backend — Confirmed

Use **Python + FastAPI** for the backend. It supports the project's API-first
architecture, asynchronous endpoints, ML/data-service integration, and MongoDB
access patterns. Build the API in small increments and validate database
connectivity, request validation, error handling, and frontend integration as
each feature is added.

### Other Integrations — Candidates Only

Routing and charging providers listed in this brief are candidates for
evaluation, not confirmed integrations. Verify API access, coverage, pricing,
limits, data fields, and project suitability before selecting or describing a
provider as available.

## Battery Dataset Strategy

### Initial dataset

Start with the **NASA Ames Li-ion Battery Aging Dataset**. It contains
laboratory ageing data for 18650 lithium-ion cells, including charge, discharge,
and impedance testing under varying conditions. Relevant measurements include
voltage, current, temperature, capacity, and impedance.

The raw NASA Ames files are MATLAB `.mat` files. Process them in Python, for
example with `scipy.io.loadmat`, and establish a dependable pipeline for:

1. Loading and inspecting the source data
2. Cleaning and handling missing or invalid values
3. Transforming records into a consistent structure
4. Engineering and documenting features
5. Validating calculations and predictions

Treat NASA Ames as a **historical laboratory dataset**, not live vehicle
telemetry. Explain the limits of applying laboratory results to a real EV.

### Optional datasets

Only consider these after the NASA Ames pipeline is working:

- Stanford/MIT cycle-life dataset — optional extension for cycle-life and
  lifetime prediction experiments
- Oxford Battery Degradation Dataset — optional, subject to verification of
  current access and suitability
- CALCE Battery Dataset from the University of Maryland — optional, subject to
  verification of current access and suitability
- Newer NASA accelerated-life dataset — optional, only after availability and
  licensing are verified

Do not claim access, coverage, or dataset details unless independently verified.
Do not combine laboratory battery data with real EV telemetry without clearly
explaining the limitations.

## Battery Intelligence

The battery-health module should provide explainable estimates and guidance,
which may include:

- Estimated state of health
- Capacity degradation trend
- Range-confidence estimate
- Battery stress indicators
- Factors influencing a prediction
- Recommended owner actions

Every output must state its data basis, as applicable:

- Historical dataset
- Simulated data
- Estimated value
- Live telemetry, only if an active live telemetry integration is actually
  connected in a future version

Do not describe a prediction as a professional vehicle inspection or a
manufacturer-certified diagnostic report.

## Routing and Charging Data Strategy

OpenRouteService and Open Charge Map are **not** the assumed integration
choices. Evaluate the candidates below before selecting providers.

### Route planning

1. **HERE EV Routing — first candidate:** evaluate EV-aware routing,
   charging-stop planning, energy-aware navigation, route-range logic, and
   geographic suitability. Do not claim API access, free usage, or India
   coverage until verified.
2. **TomTom — alternative candidate:** evaluate routing, traffic, EV-related
   route capabilities, pricing, limits, and regional coverage. Do not claim
   access or live coverage until verified.
3. **GraphHopper — ordinary-routing fallback:** consider for standard route
   planning when EV-specific routing is unavailable or impractical. Clearly
   distinguish ordinary route results from EV-aware routing.

### Charging-station discovery

Potential sources to evaluate:

1. **Google Places:** a candidate for discovering places identified as EV
   charging stations. Do not assume it supplies real-time connector,
   availability, or reliability data.
2. **HERE Charge Points:** a candidate for charging-station data. Verify
   availability, geographic coverage, pricing, data fields, and API access
   before use.
3. **Curated station dataset / demo fallback:** maintain a small, documented
   dataset for demonstrations if reliable live API access is unavailable.
   Records may include manually curated locations, station names, connectors,
   operating notes, and demo reliability fields. Clearly label these records
   **Demo data** or **Curated dataset**, never as live charger availability.

The current frontend prototype uses Photon/OpenStreetMap community data to
search and display mapped charging-station locations. This is discovery data
only: it does not verify that a station is operating or provide live connector
availability, queue time, or charging price. The separate Chargers page must
label those fields unavailable until an authorized charging-network or roaming
provider feed is connected and its coverage and freshness are verified.

The separate Chargers page now requests public station records from Open Charge
Map through the FastAPI backend. Its API key is stored in `backend/.env` and is
never sent to the browser. Open Charge Map status is community-reported, so the
UI must show its last status-update time and mark records older than 15 minutes
as stale. Reported operational status is not a guarantee of working equipment.
Only show an operational connector count when every returned connector has a
status and the station status timestamp is fresh. Queue time is not provided by
this integration. Any returned `UsageCost` is a listed tariff string, not a
verified real-time price.

The Chargers page also offers an explicit, user-triggered browser geolocation
search with selectable 5, 10, 25, or 50 km radius. Do not request location
automatically. Send the coordinates only to the backend for the requested
nearby-station search, display the browser-reported accuracy, and do not persist
the location.

For live station data, evaluate access with one charging network or roaming
provider at a time. Confirm which fields are actually supplied (connector
status, tariff, timestamps, and any queue estimate), the geographic coverage,
refresh cadence, usage terms, and API-key handling. Do not treat a station
listing or a station-level status as a count of working plugs. If queue time is
not available from the source, keep it unavailable rather than estimating it
without a validated model.

## Charging Reliability

Charging reliability must be a transparent recommendation system, not an
unsupported live claim. Possible factors include:

- Station type and connector information, when verified
- User-provided or curated reliability notes
- Historical or demo reliability score
- Distance from the route
- Availability, only when supplied by a verified live source
- Alternative stations nearby

When real-time availability is unavailable, state that clearly. For example:

> Availability is not live. This recommendation is based on curated or
> historical information.

Do not claim verified India-wide charging coverage unless it has been confirmed
with the selected API or dataset.

## Data Transparency

Use visible data-basis labels wherever needed:

| Label | Use |
| --- | --- |
| **Live data** | Only for a verified, active live integration |
| **Historical dataset** | NASA Ames and other research datasets |
| **Estimated data** | Calculated battery-health, range, or resale outputs |
| **Simulated data** | Generated demonstrations and test scenarios |
| **Demo data** | Sample routes, stations, vehicles, or user scenarios |
| **Curated dataset** | Manually maintained station records |

Never fabricate live charger status, live vehicle telemetry, real-time routing
conditions, or nationwide India coverage.

### Account history and charging-price notice

The `/account` profile displays the 25 most recent planned trips and 25 most
recent charger searches per signed-in account. Local authentication and profile
history use a SQLite database at `backend/data/essiq_auth.sqlite3`, so signup,
login, and saved history work without a separate MongoDB service. Passwords
remain hashed and sessions are carried in an HTTP-only cookie. Trip history
contains the entered endpoints and route estimates. Charger-search history
contains returned public station listings; when a search uses browser
geolocation, do not persist the user's coordinates. History is private to the
signed-in account and must not be exposed through unauthenticated endpoints.
The existing MongoDB connection remains in place for vehicle endpoints.

The site-wide charging-price bar is informational: there is no verified
India-wide daily price-trend feed connected yet. Charging tariffs vary by
station and operator. Do not invent a daily price, or claim prices went up or
down, until a reliable source provides current and historical comparable data.
Any future listed station tariff must remain visibly labeled according to its
source and freshness.

Service pages use larger feature imagery while homepage feature cards preserve
the full image rather than cropping it. Keep image alt text descriptive and
ensure images remain responsive on narrow screens.

### Resale estimator prototype

The separate `/resale-estimator` page provides an illustrative calculation,
not a market valuation. It compounds user-selected low/high annual
depreciation assumptions from the entered original purchase price and applies
optional user-entered condition and battery adjustments. Defaults are editable
example assumptions, not measured EV-market rates. Do not present the result as
an observed listing price, sale offer, or current market value. A market-backed
valuation requires verified local listings or transaction data.

### Battery capacity-retention estimator

The separate `/battery-intelligence` page calculates
`current measured usable capacity / original usable capacity * 100` from values
the user enters. Label it as an **entered-capacity estimate**, not a live BMS
reading, vehicle diagnosis, or manufacturer-certified state of health. Ask
users to compare trustworthy usable-capacity values measured under comparable
conditions. The homepage's existing 87.4% value remains demo data and must not
be presented as vehicle-specific; direct users to this estimator for their own
entered measurements. Insights describe only the difference between the two
entered values. Recommendations should focus on verifying comparable
measurements, using an authorized capacity test when data is uncertain, and
contacting the manufacturer/service center for unexpected changes or vehicle
warnings. Do not infer safety, failure cause, or repair need from capacity
retention alone.

## Core Functional Modules

Build the product as a full-stack system with working data flow, APIs, database
storage, calculations, and explainable outputs.

1. **Vehicle Profile**
   - Store EV details, usage preferences, and owner context.

2. **Battery Health Intelligence**
   - Process historical battery datasets.
   - Generate explainable health and degradation estimates.

3. **Range Confidence**
   - Estimate practical range using available vehicle, battery, route, weather,
     driving-style, or simulated inputs.
   - Clearly label estimates and identify assumptions.

4. **Route Intelligence**
   - Support route planning and distinguish ordinary routing from EV-aware
     routing.
   - Use a selected routing provider only after API access and coverage have
     been verified.

5. **Charging Discovery and Reliability**
   - Discover stations from verified providers or a curated fallback.
   - Explain why a station is recommended.
   - Never imply live availability without a verified source.

6. **EV Resale Advisor**
   - Provide resale-value guidance using transparent inputs and assumptions.
   - Label values as estimated unless connected to a verified market-data
     source.

7. **Alerts and Recommendations**
   - Turn insights into clear, useful next steps for the owner.

## Phase 9 — Testing

Testing should cover:

- Battery-data processing accuracy and missing-data handling
- ML prediction validation and explainability
- API error handling, rate limits, unavailable services, and fallback states
- MongoDB data validation and security
- Route and station-data labelling
- UI clarity for estimated, simulated, historical, and live data
- Authentication and user-data protection
- Responsive behaviour and usability

When a service is unavailable, show that state gracefully. Do not replace
unavailable real data with fabricated results.

## Phase 10 — Deployment

Deployment should include:

- Secure environment-variable management for API keys
- Separate development, demo, and production configuration
- Database backups and access controls
- Error logging and monitoring
- Clear documentation of required APIs and their status
- A deployable demo mode using labelled simulated or curated data if live APIs
  are unavailable
- A presentation-ready hosted version with clear limitations and data-source
  notes

## Future Scope

Possible future enhancements include:

- Live vehicle telemetry
- OBD integration
- Real-time charger APIs
- A mobile application
- Insurance and finance integration
- Blockchain-related features, only if they add genuine product value
- More advanced resale models
- Personalised charging recommendations
- Expanded regional coverage after data-source verification

## Build Priorities

Prioritize:

1. Functional features
2. Correct data flow
3. Reliable calculations
4. Explainable ML
5. Good UX
6. Error handling
7. Security
8. Visual polish

The goal is not to build every possible EV feature. The goal is to build one
coherent, intelligent, polished platform around one powerful question:

> Can I trust my EV?
