# Dashboard

The **Operations Overview** is the main landing page after login. It gives a snapshot of pipeline health and recent activity.

## Route

- **URL:** `/dashboard`
- **Access:** Authenticated only (redirect to `/login` if not signed in).

## Features

### 1. Header

- **Title:** "Operations Overview"
- **Subtitle:** Current date in long format (e.g. "Saturday, February 21, 2026").

### 2. KPI cards (top row)

Three summary metrics:

| KPI                     | Description                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| **Open Quotes**         | Count of quotes with status `new`, `pricing`, `sent`, or `negotiating`. Shown with amber accent when > 0. |
| **Confirmed This Week** | Count of quotes with status `confirmed` and `confirmed_at` within the last 7 days.                        |
| **Total Trips**         | Total number of trips in the database (all time).                                                         |

### 3. Live Operations

- Renders the **OpsCenter** component (`components/ops/OpsCenter`), which may use **FlightMap** and **FlightDetailDrawer** (`components/ops/`) for map and flight details.
- Data comes from `lib/ops/` (mock data and types: `Flight`, `Alert`).

### 4. Recent Quotes table

- **Title:** "Recent Quotes" with a "View all →" link to `/quotes`.
- Shows the **8 most recent quotes** (by `created_at` desc).
- Columns: **Quote ID** (truncated UUID, links to `/quotes/[id]`), **Client**, **Route** (first → last ICAO from trip legs), **Status** (badge), **Created** (date).
- Empty state: message and link to "Start with a new intake →" (`/intake`).

## Data sources

- **Quotes:** `quotes` with `clients(name)`, `trips(legs)`, ordered by `created_at` desc, limit 20 (then slice to 8 for display).
- **Trips count:** `trips` with `count: 'exact'` for total trips.
- All data is loaded server-side via Supabase in the Server Component.

## Related

- [Quotes](quotes.md) — full quote list and detail
- [Intake](intake.md) — create new trips that become quotes
