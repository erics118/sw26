# Technical Debt Analysis — sw26

**Date:** February 2025
**Scope:** Full codebase (app, lib, components, supabase, scripts)
**Approx. size:** ~97 source files, ~12k+ lines

### Recent improvements (DB/schema) — rechecked

- **Schema ↔ DB aligned:** `trips.flexibility_hours_return` added in schema.sql and reset.sql; lib/database.types and lib/schemas updated; agent `save_trip` tool now includes `flexibility_hours_return`.
- **Schemas:** Aircraft has full operational fields (status, daily_available_hours, cruise_speed_kts, max_fuel_capacity_gal, min_runway_ft, etops_certified, max_payload_lbs, reserve_fuel_gal); Crew has `available_hours_per_day`; Quote has `WonLostReasonSchema`, `quote_valid_until`, `estimated_total_hours`, `won_lost_reason`, and CreateQuote has `route_plan_id`.
- **Seeds:** reset.sql and seed_comprehensive_testing.sql use `created_at` consistently; aircraft seeds include performance data; clients/crew/trips/quotes have realistic staggered dates; one full trip with all operational fields; key airports (KTEB, KLAX, EGLL) have optional fields (iata, fuel_price_usd_gal, operating_hours_utc, etc.).
- **Remaining schema debt:** Agent tools still re-define Zod for `save_trip`/`save_quote`/`calculate_pricing` instead of importing from `lib/schemas` — quick win “reuse schemas in agent tools” still applies.

---

## 1. Debt Inventory

### 1.1 Code Debt

#### Duplicated code

| Item                                                 | Locations                                                                                       | Approx. lines              | Notes                                                                                                                                                                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **API CRUD pattern (list + create)**                 | `app/api/clients/route.ts`, `app/api/aircraft/route.ts`, `app/api/crew/route.ts`                | ~45 × 3 ≈ 135              | Identical flow: GET list + POST with `request.json()` try/catch → schema `safeParse` → same error shape → insert → select/single.                                                                            |
| **API CRUD pattern ([id] GET/PATCH)**                | `app/api/clients/[id]/route.ts`, `app/api/aircraft/[id]/route.ts`, `app/api/crew/[id]/route.ts` | ~65 × 3 ≈ 195              | Same: invalid JSON → 400, validation → 400, not found → 404, supabase error → 500.                                                                                                                           |
| **JSON parse + validation error response**           | 14+ API routes                                                                                  | ~4–6 lines each            | Repeated `try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, 400); }` and `parsed.error.issues.map((i) => i.message).join(", ")` + status 400.                 |
| **Form submit + error handling (client)**            | `clients/new`, `aircraft/new`, `intake`, `quotes/new`                                           | ~15–25 lines each          | Same pattern: `handleSubmit`, `setIsLoading(true)`, `setError(null)`, `fetch`, `if (!res.ok) throw`, `router.push`, `catch` → `setError` / `setIsLoading(false)`.                                            |
| **Trip/leg/quote Zod shapes**                        | `lib/schemas/index.ts` vs `lib/agents/tools/database.ts`                                        | ~80 lines duplicated logic | Schemas and DB are aligned (e.g. flexibility_hours_return, quote new fields). Agent tools still re-define full Zod for `save_trip`/`calculate_pricing`/`save_quote` instead of importing from `lib/schemas`. |
| **Type definitions (TripLeg, Trip, RouteLeg, etc.)** | `quotes/new/page.tsx`, `intake/page.tsx`, `QuoteTable.tsx`, lib                                 | Multiple interfaces        | `TripLeg` in quotes new, intake, and schema/DB types; route/leg/cost types in quote page instead of shared `lib` types.                                                                                      |

**Duplication summary:** ~400+ lines of repeated API/form/validation logic; type and schema duplication across app and agent tools.

#### Complex code

| Item                        | Location                               | Metric                   | Notes                                                                                                                                                                                                                                                 |
| --------------------------- | -------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Very large page**         | `app/(app)/quotes/new/page.tsx`        | ~874 lines               | Single component, many inline interfaces (TripLeg, Trip, Aircraft, RouteLeg, RefuelStop, WeatherSummary, NotamAlert, CostBreakdownResult, RoutePlanResult, etc.), two flows (preview vs manual), many `useState`/`useEffect`/`useCallback`, long JSX. |
| **Large page**              | `app/(app)/quotes/[id]/page.tsx`       | ~681 lines               | Same style: one big page, substantial state and UI.                                                                                                                                                                                                   |
| **Large page**              | `app/(app)/fleet-forecasting/page.tsx` | ~569 lines               | Single page with tabs and multiple data sections.                                                                                                                                                                                                     |
| **Large page**              | `app/(app)/intake/page.tsx`            | ~499 lines               | Single component with full intake flow.                                                                                                                                                                                                               |
| **God-object / many tools** | `lib/agents/tools/database.ts`         | ~482 lines, 10+ tools    | Single factory: search_clients, save_trip, get_trip, lookup_airport, list_aircraft, list_crew, compute_route_plan, save_route_plan, calculate_pricing, save_quote. All tool definitions and Zod args in one file.                                     |
| **Long form mapping**       | `app/(app)/aircraft/new/page.tsx`      | ~40 lines in one handler | Single `handleSubmit` building a large `data` object from many optional fields with repeated `formData.get(...) ? parseX(...) : null`.                                                                                                                |
| **Long module**             | `lib/routing/optimizer.ts`             | ~472 lines               | Core routing algorithm; prime candidate for long-function debt.                                                                                                                                                                                       |
| **Large component**         | `components/Quotes/QuoteTable.tsx`     | ~532 lines               | Local `QuoteRow`/`QuoteCosts` instead of shared quote types.                                                                                                                                                                                          |

#### Poor structure (localized)

- **Feature envy / inline types:** Quote and intake pages define their own Trip/Route/Cost types instead of importing from `lib/routing`, `lib/pricing`, or `lib/database.types`.
- **No shared API abstraction:** Changing error shape or status codes requires edits in 14+ route files.
- **Forms:** Client/aircraft forms do not validate with Zod before submit (validation only on API); aircraft form uses manual `parseInt`/`parseFloat` and long ternaries.

---

### 1.2 Architecture Debt

- **Missing abstractions:** No `handleGetList(table)`, `handlePostCreate(table, schema)`, or `parseAndValidate(request, schema)` for API routes. No shared `useFormSubmit` or “submit + redirect” helper for forms.
- **Leaky abstraction:** Agent tools re-define trip/quote Zod payloads in `database.ts`; adding a new field still requires updating both `lib/schemas` and the tool args (schema/DB are now in sync for existing fields).
- **Monolithic pages:** Quotes new/[id], fleet-forecasting, intake are single-file pages with many responsibilities (data, UI, state, side effects).

**Coupling:** App and API depend on a broad set of lib modules; no circular dependencies. Dependency flow is one-way (app → lib).

---

### 1.3 Technology / Tooling Debt

| Item                                | Severity | Notes                                                                                           |
| ----------------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| **No Vitest config**                | Low      | `"test": "vitest run"` in package.json; no `vitest.config.ts` (relies on defaults).             |
| **prepare script typo**             | Low      | `"prepare": "prek install"` — likely intended as pre-commit or husky-style hook; verify intent. |
| **No E2E or API integration tests** | High     | No Playwright, no supertest/API test suite.                                                     |
| **No dependency audit script**      | Medium   | No `npm audit` or Dependabot/renovate mentioned in docs.                                        |

Dependencies (Next 16, React 19, Supabase, Anthropic, Zod 4, Vitest 4) are current; no obvious deprecated API usage in the scanned code.

---

### 1.4 Testing Debt

| Area                                | Coverage | Notes                                                                             |
| ----------------------------------- | -------- | --------------------------------------------------------------------------------- |
| **Unit tests**                      | ~1 file  | Only `lib/ops/mockData.test.ts` (mock flights + trail/lat-lng helpers).           |
| **API routes**                      | 0%       | No tests for clients, aircraft, crew, quotes, intake, routing, fleet-forecasting. |
| **Agents / tools**                  | 0%       | No tests for intake or quote agents or database tools.                            |
| **Routing / pricing / forecasting** | 0%       | No tests for optimizer, pricing engine, or forecasting logic.                     |
| **UI / E2E**                        | 0%       | No component or E2E tests.                                                        |

**Critical paths untested:** Quote creation flow, intake extraction, pricing calculation, route planning, fleet forecasting.

---

### 1.5 Documentation Debt

- **API:** No OpenAPI/Swagger or documented request/response shapes for API routes.
- **Complex logic:** No inline docs for routing optimizer, pricing engine, or agent tool contracts.
- **Onboarding:** CLAUDE.md and README describe structure and commands; no architecture diagram or “where to change X” guide.

---

### 1.6 Infrastructure / Ops Debt

- **Deployment:** No deployment or rollback docs in repo (may live elsewhere).
- **DB:** `scripts/reset-db.ts` + `db:reset` script present; schema and seeds in supabase/ are aligned and seeds are comprehensive (created_at, operational fields, airport optional fields). No migration versioning mentioned.

---

## 2. Impact Assessment

### 2.1 Development velocity

| Debt item                       | Estimated impact                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| API CRUD duplication            | Bug fix or behavior change (e.g. error format) must be applied in 3–6+ places; ~1–2 hrs per change. |
| Form submit duplication         | Same: change to loading/error behavior touches 4+ pages.                                            |
| Schema + agent tool duplication | Adding a trip/quote field requires editing schemas and database tools; risk of drift and bugs.      |
| Monolithic quote/intake pages   | New feature or fix in quote flow is harder; refactors are risky without tests.                      |

**Rough monthly cost:** If 2–3 API/form changes and 1–2 quote/intake changes per month, ~8–15 hours spent in duplicated or fragile areas. **Annualized (velocity only):** ~100–180 hours.

### 2.2 Quality and risk

| Debt item                          | Risk                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| No API/agent/routing/pricing tests | **High** — Regressions in quote, intake, or pricing can reach production.                          |
| No E2E                             | **High** — Critical user paths (create quote, intake, view client) not automatically verified.     |
| Duplicate schema/tool definitions  | **Medium** — Drift between API validation and agent tools can cause inconsistent behavior or 400s. |
| Large pages with local types       | **Medium** — Refactors are error-prone; types can get out of sync with backend.                    |

**Risk level:** Critical paths (quotes, intake, pricing) are high-impact and largely untested.

### 2.3 Risk summary

- **Critical:** No automated tests for payment/quote and intake flows (business-critical).
- **High:** Duplicated API and form logic increases defect rate and fix time.
- **Medium:** Monolithic pages and duplicate types slow feature work and refactors.
- **Low:** Missing Vitest config, prepare script typo, missing API docs.

---

## 3. Debt Metrics Dashboard

```yaml
# Code quality (approximate)

duplication:
  api_crud_patterns: 6 files (clients, aircraft, crew × list + [id])
  json_validation_response: 14+ routes
  form_submit_pattern: 4 pages
  schema_vs_agent_tools: 2 definitions (lib/schemas vs lib/agents/tools/database)
  target: Single shared helpers; schema reused by tools

complexity:
  files_over_400_lines: 8
  files_over_200_lines: 20+
  largest_page: quotes/new (874 lines)
  target: Pages <300 lines; split into components/hooks

testing:
  unit: ~1 test file (ops mockData only)
  integration_api: 0%
  e2e: 0%
  target: 80% unit for lib; 60% integration for API; E2E for critical paths

tooling:
  vitest_config: missing
  prepare_script: "prek install" (verify)
  audit_script: none
```

---

## 4. Prioritized Remediation Plan

### 4.1 Quick wins (Week 1–2)

| #   | Action                                                                                                                                                                                                   | Effort  | Impact                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------- |
| 1   | **Shared API helpers** — Add `lib/api/helpers.ts`: `parseJsonBody(request)`, `validateBody(body, schema)`, `apiError(message, status)`. Refactor clients, aircraft, crew list + [id] routes to use them. | 4–6 hrs | One place to change error shape/status; fewer copy-paste bugs. |
| 2   | **Reuse schemas in agent tools** — In `lib/agents/tools/database.ts`, import `TripLegSchema`, trip type enum, and other shapes from `lib/schemas` (or small adapter) instead of redefining.              | 2–3 hrs | Single source of truth for trip/quote validation.              |
| 3   | **Fix prepare script** — Replace or document `"prepare": "prek install"` (e.g. remove or switch to real hook).                                                                                           | 15 min  | Avoid confusion or failed installs.                            |
| 4   | **Add vitest.config.ts** — Explicit config for `test` match and coverage (e.g. `lib/**/*.test.ts`, `app/**` excluded).                                                                                   | 30 min  | Clear test boundaries and future coverage.                     |

**ROI:** Low effort, immediate reduction in duplication and clearer test setup.

### 4.2 Medium-term (Month 1–3)

| #   | Action                                                                                                                                                                                                                             | Effort    | Impact                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------- |
| 1   | **Split quotes/new page** — Extract: shared types (to `lib` or `types/quotes.ts`), `useQuotePreview` / `useQuoteSubmit` hooks, presentational components (trip summary, route card, cost breakdown). Target: main page <300 lines. | 12–16 hrs | Easier to test and change quote flow.         |
| 2   | **Split database tools** — Split `lib/agents/tools/database.ts` by domain: e.g. `clientTools.ts`, `tripTools.ts`, `routingTools.ts`, `quoteTools.ts`; re-export from `database.ts`.                                                | 6–8 hrs   | Easier to maintain and test individual tools. |
| 3   | **Shared form submit hook** — Implement `useFormSubmit({ url, method, schema, onSuccess })` and use in clients/new, aircraft/new, intake, quotes/new where applicable.                                                             | 4–6 hrs   | Consistent loading/error/success behavior.    |
| 4   | **API integration tests** — Add Vitest + `fetch` or supertest for: GET/POST clients, GET/POST aircraft, POST intake, POST quotes/preview (or key endpoints).                                                                       | 16–24 hrs | Catch regressions in API and validation.      |
| 5   | **Zod on client forms** — Use CreateClientSchema / CreateAircraftSchema (or partials) in clients/new and aircraft/new; validate before submit and show field errors.                                                               | 4–6 hrs   | Fewer invalid requests; better UX.            |

**ROI:** Positive within 1–2 months via fewer bugs and faster feature work.

### 4.3 Long-term (Quarter 2–4)

| #   | Action                                                                                                                                               | Effort    | Impact                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------- |
| 1   | **Refactor quotes/[id] and fleet-forecasting** — Same approach as quotes/new: extract types, hooks, and components; keep pages under ~300 lines.     | 20–30 hrs | Consistency and maintainability.      |
| 2   | **Unit tests for core lib** — Routing (optimizer, graph), pricing engine, forecasting (demand, utilization), and agent tools (with mocked Supabase). | 40–60 hrs | Safe refactors and regression safety. |
| 3   | **E2E for critical paths** — Playwright (or similar): login → intake → create quote → view client/quote.                                             | 24–40 hrs | End-to-end assurance.                 |
| 4   | **API documentation** — OpenAPI or shared types + short doc for key routes (quotes, intake, routing, fleet-forecasting).                             | 8–12 hrs  | Easier onboarding and integration.    |

---

## 5. Implementation Strategy

### 5.1 Incremental refactor (API example)

**Phase 1 — Add facade (no behavior change):**

```ts
// lib/api/helpers.ts
export async function parseJsonBody(
  request: Request,
): Promise<
  { ok: true; body: unknown } | { ok: false; response: NextResponse }
> {
  try {
    const body = await request.json();
    return { ok: true, body };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
    };
  }
}

export function validationError(parsed: {
  success: false;
  error: { issues: { message: string }[] };
}): NextResponse {
  return NextResponse.json(
    { error: parsed.error.issues.map((i) => i.message).join(", ") },
    { status: 400 },
  );
}
```

**Phase 2 — Migrate one route (e.g. clients/route.ts):** Use `parseJsonBody` and `validationError`; keep same status codes and JSON shape.

**Phase 3 — Migrate remaining CRUD routes** (aircraft, crew, then [id] routes). Optionally add `handleGetList` / `handlePostCreate` that take table name and schema.

### 5.2 Testing strategy

1. **Unit:** Start with `lib/pricing/engine.ts` and `lib/routing/optimizer.ts` (pure or mostly pure); then `lib/schemas` and agent tool logic with mocked Supabase.
2. **API:** Test POST/GET for clients and aircraft first; then intake and quotes/preview.
3. **E2E:** One flow (e.g. intake → quote preview) with test user and seed data.

### 5.3 Team allocation suggestion

- **20% sprint capacity** for debt: e.g. 1–2 quick wins per sprint, then one medium-term item per sprint.
- **Definition of done** for “refactor” tasks: same behavior, no new regressions, tests added or updated where applicable.

---

## 6. Prevention

### 6.1 Quality gates

- **Lint:** Existing ESLint + Prettier; consider `eslint-plugin-boundaries` or similar to enforce “no app types in lib” and “no duplicate Zod in tools.”
- **PR:** Checklist: “New API route uses shared parse/validate helpers”; “New form uses useFormSubmit or shared pattern.”
- **Tests:** Require tests for new lib modules (routing, pricing, agents); encourage tests for new API routes.

### 6.2 Debt budget (optional)

- **New code:** New API routes must use shared helpers; new pages should avoid single file >400 lines.
- **Backlog:** Track “refactor quotes/new” and “split database tools” as stories; assign to sprints like features.

---

## 7. Success Metrics

| Metric                                 | Current | Target (3 months)  | Target (6 months)   |
| -------------------------------------- | ------- | ------------------ | ------------------- |
| API routes using shared parse/validate | 0       | 6+ (all CRUD)      | All applicable      |
| Schema reused in agent tools           | 0       | Trip + leg + quote | Full reuse          |
| Largest page (lines)                   | 874     | <500               | <350                |
| Unit test files (lib)                  | 1       | 5+                 | 10+                 |
| API integration tests                  | 0       | 4+ routes          | All critical routes |
| E2E tests                              | 0       | 0                  | 1+ critical path    |

---

## 8. Summary

- **Largest cost:** Duplicated API and form logic (~400+ lines), and untested critical paths (quotes, intake, pricing).
- **Quick wins:** Shared API helpers, reuse schemas in agent tools, fix prepare script, add Vitest config.
- **Highest ROI next:** Split quotes/new page, add API integration tests, shared form hook and client-side Zod.
- **Risk:** Keeping quote and intake flows untested and schema/tools duplicated increases production bug risk and slows changes.

Focusing on **shared API helpers** and **schema reuse in agent tools** first gives fast, low-risk payoff; then tackle **quotes/new split** and **API + unit tests** for lasting impact.
