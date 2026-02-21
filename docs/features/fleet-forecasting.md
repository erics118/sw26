# Fleet Forecasting

Fleet Forecasting provides **capacity planning**, **underutilization detection**, and **post-flight learning** (forecast accuracy and delay reasons). The page is tabbed: Fleet Forecast, Underutilization, and Post-Flight Learning.

## Route

- **URL:** `/fleet-forecasting`
- **Access:** Authenticated only.

---

## Tab 1: Fleet Forecast

### Purpose

Compare **expected demand** (hours per day per aircraft category) with **available capacity** (from active aircraft and maintenance) over a horizon (7, 30, or 90 days). Surplus/shortage/balanced status is shown per day per category.

### Features

- **Horizon selector:** 7d, 30d, 90d. Data is refetched when tab or horizon changes.
- **Summary:** Count of "shortage days" (red) and "surplus days" (amber); "Balanced" when neither.
- **AI insight:** `InsightBlock` shows AI-generated narrative for the forecast tab (POST `/api/fleet-forecasting/insights` with `{ tab: "forecast", days }`).
- **Per-category cards:** For each aircraft category present in the data:
  - **CapacityGapCard** — gap summary for that category.
  - **ForecastChart** — chart of planes needed / capacity over the horizon.
- **Empty state:** "No aircraft data found. Add aircraft to the fleet to see forecasts."

### Data flow

- **GET /api/fleet-forecasting/forecast?days=7|30|90**
  Returns `ForecastSummary`: `capacity` (by date, category: active aircraft, available hours, maintenance hours), `demand` (expected/confirmed demand), `planes_needed` (expected_demand_hours, available_hours, required_aircraft, capacity_gap_hours, capacity_gap_aircraft, status: surplus | balanced | shortage), `horizon_days`, `generated_at`.
  Logic: `computeCapacity`, `computeExpectedDemand`, `computePlanesNeeded` from `lib/forecasting/`.

---

## Tab 2: Underutilization

### Purpose

Identify aircraft that are underused (low utilization, idle days, empty legs) and show **recommendations**: repositioning, empty-leg opportunities, and maintenance windows.

### Features

- **AI insight:** POST `/api/fleet-forecasting/insights` with `{ tab: "utilization" }`.
- **Category KPIs:** Cards per category: average utilization %, underutilized count / total aircraft, and a utilization bar.
- **Aircraft table:** "Aircraft — Ranked by Idle Risk" — columns: Aircraft (tail, category, home base), Utilization (bar), Empty leg %, Idle days, Flags (ok | underutilized | overconstrained | inefficient). Data: last 30 days.
- **Recommendations (three columns):**
  - **Reposition** — list of reposition recommendations.
  - **Empty legs** — idle aircraft in next 48h.
  - **Maintenance windows** — low-demand windows for maintenance.

### Data flow

- **GET /api/fleet-forecasting/utilization?days=30**
  Returns `UtilizationSummary`: `by_category` (avg utilization, underutilized count, total), `aircraft` (per-aircraft utilization_rate, empty_leg_ratio, idle_days, flags, etc.).
- **GET /api/fleet-forecasting/recommendations?horizon=7**
  Returns `RecommendationSummary`: `reposition`, `empty_legs`, `maintenance_windows` (each array of recommendation objects).

---

## Tab 3: Post-Flight Learning

### Purpose

Compare **forecasted demand** vs **actual** (confirmed/completed flights) and show **delay reasons** (weather, ATC, mechanical, crew, client, other) to improve future forecasts and ops.

### Features

- **AI insight:** POST `/api/fleet-forecasting/insights` with `{ tab: "learning" }`.
- **Forecast accuracy:** Table and chart by aircraft category: predicted hours, actual hours, error %. Data: last 90 days. Green/amber/red by error magnitude.
- **Top delay reasons:** Chart and list: reason code, total hours lost, count. Last 90 days.

### Data flow

- **POST /api/fleet-forecasting/insights** with `{ tab: "learning" }`
  Returns `{ insight, accuracy, delay_reasons }`. Accuracy: `ForecastAccuracy[]` (aircraft_category, predicted_hours, actual_hours, error_pct). Delay reasons: `DelayReasonBreakdown[]` (reason_code, count, total_hours_lost).

---

## Fleet forecasting engine (lib/forecasting)

- **Capacity:** `computeCapacity(supabase, startDate, endDate, category?)` — uses `aircraft` (status, daily_available_hours) and `aircraft_maintenance` to compute available hours per day per category.
- **Demand:** `computeExpectedDemand` — combines confirmed bookings (e.g. from quotes/trips) and baseline/peak multipliers; can use `fleet_forecast_overrides` for peak multipliers per date/category.
- **Planes needed:** `computePlanesNeeded(capacity, demand)` — compares expected demand hours to available hours, derives required aircraft and surplus/shortage/balanced.
- **Utilization:** Logic for paid hours, reposition hours, idle days, empty-leg ratio, and flags (underutilized, overconstrained, inefficient) using target utilization from `lib/forecasting/types` (`TARGET_UTIL_HOURS`).
- **Maintenance:** `aircraft_maintenance` table and maintenance-window recommendations (low-demand windows).

---

## Overrides

- **fleet_forecast_overrides** table: per `date` and `aircraft_category` (or 'all'), `peak_multiplier` and optional `reason`. Used to adjust demand (e.g. events, holidays).
- **API:** `/api/fleet-forecasting/overrides` for reading/updating overrides (see API docs).

---

## Related

- [Aircraft](aircraft.md) — fleet data and status
- [Quotes](quotes.md) — confirmed quotes feed demand and actuals
- [API reference](../api/README.md) — fleet-forecasting endpoints
