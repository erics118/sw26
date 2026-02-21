# Dead code and wasteful code diagnosis

Findings from a static usage scan. “Dead” = never imported or invoked. “Wasteful” = duplicate logic or unused exports that add maintenance cost.

---

## 1. Dead code

### `proxy.ts` (root)

- **What:** Exports `proxy()` and `config` (Next.js 16 auth/proxy convention). Implements auth redirects (/, /login, /dashboard).
- **Note:** Next.js 16 uses the `proxy` file convention (not `middleware.ts`). The file is loaded by the framework when named `proxy.ts` at root; no change needed. Left as-is.

---

## 2. Unused schema exports (barrel-only) — FIXED

These were exported from `lib/schemas/index.ts` but never imported elsewhere.

**Fix applied:** Removed `export` from `CreateQuoteCostSchema`, `CreateQuoteCostInput`, `CreateAuditLogSchema`, and `CreateAuditLogInput`. They remain defined for internal use in the same file but are no longer part of the public barrel API. `QuoteCostSchema`, `AuditLogSchema`, and `CostLineItemSchema` remain exported for potential future use.

---

## 3. Duplicate / wasteful logic

### `CATEGORY_PERF` in two places

- **`lib/pricing/engine.ts`:** Local `CATEGORY_PERF` with `speedKts` and `defaultFuelBurnGph` only.
- **`lib/routing/performance.ts`:** Exported `CATEGORY_PERF` with more fields (e.g. `defaultFuelCapacityGal`, `defaultReserveGal`, `defaultMinRunwayFt`). Comment in performance.ts says: “The pricing engine has its own copy for now; when convenient, engine.ts can import CATEGORY_PERF from here.”

**Verdict:** **Wasteful duplication.** Same category keys and speed/burn numbers maintained in two files. Unifying on `lib/routing/performance.ts` (e.g. `engine.ts` imports `CATEGORY_PERF` and uses `.speedKts` / `.defaultFuelBurnGph`) would remove drift risk. Routing already needs the extra fields; pricing only needs those two.

---

## 4. Unused types (ops) — FIXED

- **Was:** `lib/ops/types.ts` exported unused `MaintenanceItem`, `CrewMember`, `FleetAircraft`.
- **Fix applied:** Those three interfaces removed. Only `Flight` and `Alert` remain (used by OpsCenter, FlightMap, FlightDetailDrawer).

---

## 5. Documentation inaccuracy

- **CLAUDE.md** lists:
  - `lib/ai/intake.ts` — “Legacy intake (unused by routes)”. That file does **not** exist; only `lib/ai/audit.ts` and `lib/ai/forecasting.ts` exist.

**Verdict:** Update CLAUDE.md so it doesn’t reference the missing file.

---

## 6. Summary

| Item                                                          | Type                     | Status                                 |
| ------------------------------------------------------------- | ------------------------ | -------------------------------------- |
| `proxy.ts`                                                    | N/A (Next 16 convention) | Left as-is; no change                  |
| Schema exports (CreateQuoteCost*, CreateAuditLog* only)       | Unused exports           | Fixed: no longer exported              |
| mockData.ts `airports` array                                  | Dead code                | Fixed: removed                         |
| `CATEGORY_PERF` in engine vs performance                      | Duplication              | Fixed: engine imports from performance |
| `MaintenanceItem`, `CrewMember`, `FleetAircraft` in ops types | Unused types             | Fixed: removed                         |
| CLAUDE.md (intake.ts)                                         | Stale docs               | Fixed                                  |

No other clearly dead or heavily wasteful areas were found in the scanned app code, API routes, lib, or components.

---

## 7. Code, descriptions, and documentation that don’t make sense

### CLAUDE.md

- **Auth section (line 80):** Says “Supabase auth managed via `middleware.ts`”. There is no `middleware.ts`; the only auth redirect logic lives in `proxy.ts`, which is never loaded. So either auth is not actually enforced by middleware (e.g. only per-route), or the doc is wrong. **Fix:** Say how auth is really done (e.g. “Auth intended via `proxy.ts`; rename to `middleware.ts` to enable” or “Auth is per-route only”).
- **lib/ai:** Lists `intake.ts` — “Legacy intake (unused by routes)”. The file does not exist (only `audit.ts` and `forecasting.ts`). **Fix:** Remove the line.
- **quote.agent.ts (line 91):** “builds and saves quotes, no builtin tools”. The quote agent does use tools — it gets `dbTools` (search_clients, save_trip, get_trip, list_aircraft, list_crew, calculate_pricing, save_quote). “No builtin tools” here means no WebFetch/etc. **Fix:** Clarify e.g. “uses only database tools (no WebFetch)”.

### lib/geo.ts and CLAUDE.md

- **CLAUDE.md (line 70):** Says `geo.ts` provides “haversineNm, distanceNm”. `haversineNm` is exported from `lib/routing/airport-db.ts`, not `geo.ts`. **Fix:** Change to “distanceNm (and optional lookup)” or “distanceNm only; haversineNm in lib/routing/airport-db.ts”.

### Tool / schema descriptions

- **lib/agents/tools/database.ts (line 216):** `margin_pct` is described as “Broker margin %”. In a single-operator app there may be no separate “broker” entity; margin is the operator’s margin on the quote. **Fix:** Optional — e.g. “Margin % on cost breakdown” if you want to avoid “broker”.

### Comments in code

- **lib/forecasting/actions.ts (line 77):** `const fromAirport = ac.home_base_icao ?? "KXXX"`. “KXXX” is a placeholder ICAO (not a real code). **Fix:** Add a one-line comment e.g. “Placeholder when home base unknown” or a constant `UNKNOWN_HOME_BASE = "KXXX"`.
- **lib/ops/mockData.ts:** The unused `airports` array and `void airports` were dead code. **Fix applied:** Removed the array and the void statement.

### Seed data / SQL comments

- **supabase/reset.sql (line 424):** Comment “lost: client went with another broker”. In a single-operator app this can read as if “we” are the broker; “another broker” might mean “competitor” or “other charter company”. **Fix:** Optional — e.g. “lost: client chose competitor” if you want to avoid “broker”.

### UI placeholders

- **app/(app)/intake/page.tsx (lines 243, 252):** ICAO inputs use placeholder `"XXXX"`. Real ICAO codes are 4 characters (e.g. KORD, KMIA). **Fix:** Optional — use `"KORD"` or `"ICAO"` or a hint like “e.g. KORD” so it’s clear what format is expected.
