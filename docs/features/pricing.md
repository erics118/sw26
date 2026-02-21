# Pricing Engine

The **pricing engine** (`lib/pricing/engine.ts`) is a deterministic cost calculator used to build quote totals. It produces a line-item breakdown (fuel, FBO, repositioning, permits, crew overnight, catering, peak-day surcharge, margin, tax) and is used by the **quote agent** and when creating quotes (optionally with fuel price from the route plan).

## Entry point

- **`calculatePricing(input: PricingInput): PricingResult`** — synchronous.

---

## Input (PricingInput)

| Field                | Type           | Description                                                   |
| -------------------- | -------------- | ------------------------------------------------------------- |
| legs                 | TripLeg[]      | At least one leg: from_icao, to_icao, date, time              |
| aircraftCategory     | string         | turboprop, light, midsize, super-mid, heavy, ultra-long       |
| fuelBurnGph          | number \| null | Optional; uses category default if null                       |
| homeBaseIcao         | string \| null | Optional; used for repositioning from home to first departure |
| marginPct            | number         | Broker margin % (e.g. 15)                                     |
| cateringRequested    | boolean        | If true, adds flat catering per leg                           |
| isInternational      | boolean        | If true, adds permit fee per international leg                |
| taxRate              | number         | Optional; default 7.5%                                        |
| fuelPriceOverrideUsd | number         | Optional; overrides default $/gal (e.g. from route plan)      |

---

## Cost components

1. **Fuel** — Per leg: distance (haversine) → flight hours (distance / category cruise speed) → fuel = hours × fuelBurnGph × fuelPricePerGal. fuelPricePerGal = `fuelPriceOverrideUsd ?? 7.5`.
2. **FBO fees** — Per leg destination + first leg departure. Lookup by ICAO in `FBO_FEES` map; default 600. (Examples: KTEB 1200, KJFK 1500, EGLL 2000, etc.)
3. **Repositioning** — If homeBaseIcao is set and different from first leg’s from_icao: distance home → first departure, hours = distance / category speed, cost = hours × category hourly rate (e.g. midsize 3000, heavy 5500).
4. **International permit** — Per leg where either endpoint is non-US (roughly: ICAO not starting with 'K'), add PERMIT_FEE (750).
5. **Catering** — If cateringRequested, CATERING_FLAT (350) per leg.
6. **Crew overnight** — If layover between consecutive legs exceeds threshold (default 4 hours), add CREW_OVERNIGHT_RATE × DEFAULT_CREW_COUNT (350 × 2 = 700) per occurrence.
7. **Peak-day surcharge** — If any leg date is Saturday or Sunday (UTC), add 5% of base subtotal (before margin).
8. **Subtotal** — Sum of all above (including peak).
9. **Margin** — marginPct% of subtotal.
10. **Tax** — (subtotal + margin) × taxRate (default 7.5%).

---

## Category defaults

- **Cruise speed and fuel burn** come from `lib/routing/performance.ts`: the pricing engine imports `CATEGORY_PERF` from there (single source of truth). Categories: turboprop, light, midsize, super-mid, heavy, ultra-long (with speedKts and defaultFuelBurnGph).
- **Repositioning $/hr** (in `lib/pricing/engine.ts`): turboprop 1500 → ultra-long 7000.

---

## Output (PricingResult)

- **line_items** — Array of { leg?, label, amount } for display.
- **per_leg_breakdown** — Per-leg line items (fuel, FBO, permit, catering, etc.).
- **fuel_cost**, **fbo_fees**, **repositioning_cost**, **repositioning_hours**, **permit_fees**, **crew_overnight_cost**, **catering_cost**, **peak_day_surcharge**.
- **subtotal**, **margin_amount**, **tax**, **total**.

These map directly to **quote_costs** columns and to the **CostBreakdown** UI component.

---

## Usage

- **Quote agent** — Calls `calculate_pricing` tool (which uses this engine) with trip legs, aircraft category, fuel burn, home base, margin, catering, international, and optional fuel_price_override_usd. Then saves quote and quote_costs via `save_quote`.
- **New quote flow** — When user runs "Plan Route", the returned route plan’s average fuel price can be passed as `fuel_price_override_usd` when creating the quote so pricing reflects actual route fuel costs.

---

## Related

- [Quotes](quotes.md) — quote creation and cost breakdown display
- [Routing](routing.md) — provides optional fuel price override
- [AI Agents](agents.md) — quote agent uses calculate_pricing tool
