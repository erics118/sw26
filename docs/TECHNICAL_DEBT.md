# Technical Debt Analysis — sw26

**Date:** February 2025 (last full analysis)
**Updated:** February 2026 (current state refresh)
**Scope:** Full codebase (app, lib, components, supabase, scripts)
**Approx. size:** ~120 source files (TS/TSX), ~12k+ lines

---

## Recent improvements (since last analysis)

- **Shared API helpers in place:** `lib/api/helpers.ts` provides `parseBody`, `validationError`, `dbError`, `notFound`. **All 6 CRUD routes** (clients, aircraft, crew — list + [id]) use them. No more copy-paste of JSON parse/validation/500 in those routes.
- **Vitest config:** `vitest.config.ts` exists with node env, `**/*.test.ts` include, `@` alias. Test run: 4 files, 50 tests (risk, pricing engine, api helpers, ops mockData).
- **Schema reuse in agent tools:** `lib/agents/tools/database.ts` imports `TripLegSchema`, `TripTypeSchema`, `OptimizationModeSchema` from `lib/schemas` for `save_trip`, `compute_route_plan`, `calculate_pricing`. Trip/leg/optimization shapes are single source of truth; `save_route_plan` / `save_quote` still use inline `z.any()` / custom args.
- **Page/component size reductions:** `QuoteTable.tsx` down to ~164 lines (was 532); `quotes/new` ~732 (was 874); `quotes/[id]` ~444 (was 681); `intake` ~237 (was 499); `fleet-forecasting` ~488 (was 569).

**Remaining high-impact debt:** Many API routes still bypass helpers (quotes, intake, routing, fleet-forecasting, dev seeds). No API integration or E2E tests. Monolithic `quotes/new` and large `seed-demo` route. Inline types on quote/intake pages.

---

## Executive Summary

| Summary                      | Value                                                                                                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Debt score (qualitative)** | Medium–High (critical paths untested; duplication in 12+ routes)                                                                                                                                   |
| **Monthly velocity impact**  | ~6–12 hours in duplicated/fragile areas                                                                                                                                                            |
| **Key risks**                | No automated tests for quote/intake; regressions can reach production                                                                                                                              |
| **Recommended investment**   | Quick wins ~6 hrs; medium-term ~50–70 hrs; long-term ~90–140 hrs                                                                                                                                   |
| **Expected ROI**             | Quick wins pay back in 1–2 months via fewer bugs and single-point error/validation changes; medium-term (tests + refactors) reduces production incidents and speeds feature work within 2–3 months |

**Immediate actions:** (1) Extend shared API helpers to quotes, intake, routing, and fleet-forecasting routes. (2) Document prepare script. (3) Plan API integration tests and quotes/new split for next sprint.

---

## 1. Debt Inventory

### 1.1 Code Debt

#### Duplicated code

| Item                                                      | Locations                                             | Approx. lines       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------- | ----------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JSON parse + validation response**                      | 12+ API routes                                        | ~4–8 each           | `quotes/route.ts`, `quotes/[id]/route.ts`, `intake/route.ts`, `routing/plan/route.ts`, `routing/airports/route.ts`, `routing/airports/[icao]/route.ts`, `fleet-forecasting/insights/route.ts`, `fleet-forecasting/maintenance/route.ts`, `quotes/preview/route.ts`, `quotes/[id]/versions/route.ts`, etc. still use inline `try { body = await request.json() } catch { return NextResponse.json(...) }` and `parsed.error.issues.map(...)`. |
| **Form submit + error handling (client)**                 | `clients/new`, `aircraft/new`, `intake`, `quotes/new` | ~15–25 each         | Same pattern: `handleSubmit`, `setIsLoading(true)`, `setError(null)`, `fetch`, `if (!res.ok) throw`, `router.push`, `catch` → `setError` / `setIsLoading(false)`.                                                                                                                                                                                                                                                                            |
| **Trip/quote types and Zod in tools**                     | `lib/schemas` vs `lib/agents/tools/database.ts`       | ~50+ lines          | `save_route_plan` and `save_quote` use inline `z.any()` / custom Zod; adding fields may require both schemas and tool args.                                                                                                                                                                                                                                                                                                                  |
| **Type definitions (TripLeg, Trip, PreviewResult, etc.)** | `quotes/new/page.tsx`, `intake/page.tsx`, components  | Multiple interfaces | `TripLeg`, `Trip`, `Aircraft`, `PreviewResult`, `OptimizationMode` defined locally in `quotes/new/page.tsx` instead of shared `lib` or `lib/database.types`.                                                                                                                                                                                                                                                                                 |

**Duplication summary:** ~200+ lines of repeated parse/validation in non-CRUD API routes; form and type duplication across app and agent tools.

#### Complex code

| Item                        | Location                                 | Metric                | Notes                                                                                                                         |
| --------------------------- | ---------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Very large page**         | `app/(app)/quotes/new/page.tsx`          | ~732 lines            | Single component, many inline interfaces, two flows (preview vs manual), many `useState`/`useEffect`/`useCallback`, long JSX. |
| **Large page**              | `app/(app)/fleet-forecasting/page.tsx`   | ~488 lines            | Single page with tabs and multiple data sections.                                                                             |
| **Large page**              | `app/(app)/quotes/[id]/page.tsx`         | ~444 lines            | Substantial state and UI in one file.                                                                                         |
| **Large dev route**         | `app/api/dev/seed-demo/route.ts`         | ~629 lines            | Monolithic seed: clients, aircraft, trips, quotes, history; all inline data and repeated error handling.                      |
| **God-object / many tools** | `lib/agents/tools/database.ts`           | ~469 lines, 10+ tools | Single factory for all DB/compute tools; all tool definitions and Zod in one file.                                            |
| **Long module**             | `lib/routing/optimizer.ts`               | ~472 lines            | Core routing algorithm; long-function debt.                                                                                   |
| **Large component**         | `components/ops/FlightMap.tsx`           | ~428 lines            | Map + flight trail logic in one component.                                                                                    |
| **Large component**         | `components/Quotes/QuoteDetailModal.tsx` | ~382 lines            | Modal with full quote detail.                                                                                                 |

#### Poor structure (localized)

- **Feature envy / inline types:** Quote and intake pages define their own Trip/Route/Cost types instead of importing from `lib/routing`, `lib/pricing`, or `lib/database.types`.
- **Inconsistent API abstraction:** CRUD routes use helpers; quotes, intake, routing, fleet-forecasting do not. Changing error shape still touches 12+ route files.
- **Forms:** Client/aircraft forms do not validate with Zod before submit (validation only on API); aircraft form uses manual `parseInt`/`parseFloat` and long ternaries.

---

### 1.2 Architecture Debt

- **Missing abstractions:** No generic `handleGetList(table)` / `handlePostCreate(table, schema)` for API; no shared `useFormSubmit` for forms. Non-CRUD routes each implement parse/validate by hand.
- **Leaky abstraction:** Agent tools partially reuse schemas; `save_route_plan` and `save_quote` still encode structure in tool args. New trip/quote fields can require both `lib/schemas` and tool updates.
- **Monolithic pages:** `quotes/new`, `quotes/[id]`, `fleet-forecasting` are single-file pages with many responsibilities.
- **Supabase client usage:** Most routes correctly use `createClient()` from `@/lib/supabase/server`; `seed-demo` and `seed-history` use `@supabase/supabase-js` with service role (intentional for RLS bypass). No circular dependencies; app → lib flow is one-way.

---

### 1.3 Technology / Tooling Debt

| Item                                | Severity | Notes                                                                                                         |
| ----------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| **Prepare script**                  | Low      | `"prepare": "prek install"` uses `@j178/prek` (real package). Document in README/CLAUDE.md if team is unsure. |
| **No E2E or API integration tests** | High     | No Playwright; no API test suite for quotes, intake, routing, fleet-forecasting.                              |
| **No dependency audit in CI**       | Medium   | No `npm audit` or Dependabot/renovate in docs or CI.                                                          |

Dependencies (Next 16, React 19, Supabase, Anthropic, Zod 4, Vitest 4) are current.

---

### 1.4 Testing Debt

| Area                                | Coverage          | Notes                                                                                                            |
| ----------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Unit tests**                      | 4 files, 50 tests | `lib/routing/risk.test.ts`, `lib/pricing/engine.test.ts`, `lib/api/helpers.test.ts`, `lib/ops/mockData.test.ts`. |
| **API routes**                      | 0%                | No tests for clients, aircraft, crew, quotes, intake, routing, fleet-forecasting.                                |
| **Agents / tools**                  | 0%                | No tests for intake or quote agents or database tools.                                                           |
| **Routing optimizer / forecasting** | 0%                | No tests for optimizer, demand, utilization, capacity.                                                           |
| **UI / E2E**                        | 0%                | No component or E2E tests.                                                                                       |

**Critical paths untested:** Quote creation flow, intake extraction, pricing calculation, route planning, fleet forecasting.

---

### 1.5 Documentation Debt

- **API:** No OpenAPI/Swagger or documented request/response shapes for API routes.
- **Complex logic:** No inline docs for routing optimizer, pricing engine, or agent tool contracts.
- **Onboarding:** CLAUDE.md and README describe structure and commands; no architecture diagram or “where to change X” guide.

---

### 1.6 Infrastructure / Ops Debt

- **Deployment:** No deployment or rollback docs in repo (may live elsewhere).
- **DB:** `scripts/reset-db.ts` + `db:reset` script; schema and seeds in supabase/ aligned. No migration versioning mentioned.

---

## 2. Impact Assessment

### 2.1 Development velocity

| Debt item                       | Estimated impact                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Non-CRUD API duplication        | Error format or validation change still requires edits in 12+ route files; ~1–2 hrs per cross-cutting change. |
| Form submit duplication         | Change to loading/error behavior touches 4+ pages.                                                            |
| Schema + agent tool duplication | Adding a trip/quote/route_plan field can require schemas + tool args; risk of drift.                          |
| Monolithic quote/fleet pages    | New feature or fix in quote or forecasting flow is harder; refactors risky without tests.                     |

**Rough monthly cost:** ~6–12 hours in duplicated or fragile areas (assuming 1–2 API/form changes and 1 quote or forecasting change per month). **Annualized (velocity only):** ~70–140 hours.

### 2.2 Quality and risk

| Debt item                                      | Risk                                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| No API/agent/routing/pricing integration tests | **High** — Regressions in quote, intake, or pricing can reach production.                          |
| No E2E                                         | **High** — Critical user paths (create quote, intake, view client) not automatically verified.     |
| Duplicate schema/tool definitions              | **Medium** — Drift between API validation and agent tools can cause inconsistent behavior or 400s. |
| Large pages with local types                   | **Medium** — Refactors are error-prone; types can get out of sync with backend.                    |

**Risk level:** Critical paths (quotes, intake, pricing) are high-impact and largely untested.

### 2.3 Cost illustration (example)

```
Debt Item: No integration tests for quote/intake flow
Assumption: 2 production bugs/quarter in this area
Per bug: Investigation 4h + Fix 2h + Testing 2h + Deploy 1h = 9h
Quarterly cost: 2 × 9h = 18h
Annual cost: ~72 hours (e.g. ~$10.8k at $150/h)
```

### 2.4 Risk summary

- **Critical:** No automated tests for quote and intake flows (business-critical).
- **High:** Many API routes still use inline parse/validation; form logic duplicated.
- **Medium:** Monolithic pages and duplicate types; schema/tool drift risk.
- **Low:** Prepare script documentation, missing API docs.

---

## 3. Debt Metrics Dashboard

```yaml
# Current state (Feb 2026)

duplication:
  api_routes_using_helpers: 6  # clients, aircraft, crew (list + [id])
  api_routes_without_helpers: 12+
  form_submit_pattern: 4 pages
  schema_reuse_in_tools: partial (trip/leg/optimization); save_route_plan/save_quote inline
  target: All applicable routes use helpers; full schema reuse in tools

complexity:
  files_over_400_lines: 6
  files_over_300_lines: 10+
  largest_page: quotes/new (732 lines)
  largest_api_route: seed-demo (629 lines)
  target: Pages <300 lines; API routes <200; split seed data from handler

testing:
  unit_test_files: 4
  unit_tests: 50
  integration_api: 0%
  e2e: 0%
  target: 80% unit for lib; 60% integration for API; E2E for critical paths

tooling:
  vitest_config: present
  prepare_script: "prek install" (@j178/prek — document intent)
  audit_script: none
```

---

## 4. Prioritized Remediation Plan

### 4.1 Quick wins (Week 1–2)

| #   | Action                                                                                                                                                                                                                                                       | Effort  | Impact                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------- |
| 1   | **Extend API helpers to more routes** — Use `parseBody`, `validationError`, `dbError`, `notFound` in `app/api/quotes/route.ts`, `quotes/[id]/route.ts`, `intake/route.ts`, `quotes/preview/route.ts`, and routing/fleet-forecasting routes where applicable. | 4–6 hrs | One place to change error shape; fewer copy-paste bugs. |
| 2   | **Document prepare script** — Add one line in README or CLAUDE.md: “`prepare` runs `prek install` (@j178/prek).”                                                                                                                                             | 15 min  | Avoid confusion.                                        |
| 3   | **Add `notFound` usage** — In [id] routes that already use helpers, use `notFound("Client")` etc. where applicable for 404s.                                                                                                                                 | ~30 min | Consistent 404 responses.                               |

**ROI:** Low effort, immediate consistency and fewer places to touch for error/validation changes.

### 4.2 Medium-term (Month 1–3)

| #   | Action                                                                                                                                                                                                                          | Effort    | Impact                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------- |
| 1   | **Split quotes/new page** — Extract shared types to `lib` or `types/quotes.ts`, `useQuotePreview` / `useQuoteSubmit` hooks, presentational components (trip summary, route card, cost breakdown). Target: main page <300 lines. | 12–16 hrs | Easier to test and change quote flow.         |
| 2   | **Split database tools** — Split `lib/agents/tools/database.ts` by domain: e.g. `clientTools.ts`, `tripTools.ts`, `routingTools.ts`, `quoteTools.ts`; re-export from `database.ts`.                                             | 6–8 hrs   | Easier to maintain and test individual tools. |
| 3   | **Shared form submit hook** — Implement `useFormSubmit({ url, method, schema, onSuccess })` and use in clients/new, aircraft/new, intake, quotes/new where applicable.                                                          | 4–6 hrs   | Consistent loading/error/success behavior.    |
| 4   | **API integration tests** — Vitest + `fetch` or supertest for GET/POST clients, GET/POST aircraft, POST intake, POST quotes/preview (or key endpoints).                                                                         | 16–24 hrs | Catch regressions in API and validation.      |
| 5   | **Zod on client forms** — Use CreateClientSchema / CreateAircraftSchema (or partials) in clients/new and aircraft/new; validate before submit and show field errors.                                                            | 4–6 hrs   | Fewer invalid requests; better UX.            |
| 6   | **Refactor seed-demo** — Move CLIENTS, AIRCRAFT_SEED, etc. to `lib/dev/seed-data.ts` or similar; keep route as thin orchestrator.                                                                                               | 4–6 hrs   | Easier to maintain and reuse seed data.       |

**ROI:** Positive within 1–2 months via fewer bugs and faster feature work.

### 4.3 Long-term (Quarter 2–4)

| #   | Action                                                                                                                               | Effort    | Impact                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------------------------------------- |
| 1   | **Refactor quotes/[id] and fleet-forecasting** — Extract types, hooks, and components; keep pages under ~300 lines.                  | 20–30 hrs | Consistency and maintainability.      |
| 2   | **Unit tests for core lib** — Routing (optimizer, graph), forecasting (demand, utilization), and agent tools (with mocked Supabase). | 40–60 hrs | Safe refactors and regression safety. |
| 3   | **E2E for critical paths** — Playwright (or similar): login → intake → create quote → view client/quote.                             | 24–40 hrs | End-to-end assurance.                 |
| 4   | **API documentation** — OpenAPI or shared types + short doc for key routes (quotes, intake, routing, fleet-forecasting).             | 8–12 hrs  | Easier onboarding and integration.    |

---

## 5. Implementation Strategy

### 5.1 Extending API helpers (no behavior change)

**Step 1 — Use existing helpers in one route (e.g. intake):**

```ts
// app/api/intake/route.ts
import { parseBody, validationError } from "@/lib/api/helpers";

export async function POST(request: Request) {
  const [body, err] = await parseBody(request);
  if (err) return err;

  const parsed = IntakeRequestSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  // ... rest unchanged
}
```

**Step 2 — Migrate quotes GET/POST, quotes/[id], quotes/preview, routing, fleet-forecasting** one at a time. Keep same status codes and JSON shape.

**Step 3 — Optionally add** `unauthorized()` in helpers and use in routes that check `getUser()`.

### 5.2 Testing strategy

1. **Unit:** Existing coverage on risk, pricing, helpers, mockData. Add optimizer, demand, utilization, and agent tool logic with mocked Supabase.
2. **API:** Start with GET/POST clients and aircraft (already use helpers); then intake and quotes/preview.
3. **E2E:** One flow (e.g. intake → quote preview) with test user and seed data.

### 5.3 Team allocation

- **20% sprint capacity** for debt: 1–2 quick wins per sprint, then one medium-term item per sprint.
- **Definition of done** for refactors: same behavior, no new regressions, tests added or updated where applicable.

---

## 6. Prevention

### 6.1 Quality gates

- **Lint:** Existing ESLint + Prettier. Consider “new API route must use parseBody/validationError/dbError” in PR checklist.
- **PR:** “New API route uses shared helpers”; “New form uses useFormSubmit or shared pattern.”
- **Tests:** Require tests for new lib modules (routing, pricing, agents); encourage tests for new API routes.

### 6.2 Debt budget (optional)

- **New code:** New API routes must use shared helpers; new pages should avoid single file >400 lines.
- **Backlog:** Track “refactor quotes/new” and “split database tools” as stories; assign to sprints like features.

---

## 7. Success Metrics

| Metric                          | Current | Target (3 months)                       | Target (6 months)   |
| ------------------------------- | ------- | --------------------------------------- | ------------------- |
| API routes using shared helpers | 6       | 12+                                     | All applicable      |
| Schema reused in agent tools    | Partial | Full (incl. save_route_plan/save_quote) | Full                |
| Largest page (lines)            | 732     | <500                                    | <350                |
| Unit test files (lib)           | 4       | 6+                                      | 10+                 |
| API integration tests           | 0       | 4+ routes                               | All critical routes |
| E2E tests                       | 0       | 0                                       | 1+ critical path    |

---

## 8. Summary

- **Already done:** Shared API helpers in all CRUD routes; Vitest config; partial schema reuse in agent tools; some page/component size reductions.
- **Largest remaining cost:** Inline parse/validation in 12+ non-CRUD routes, untested critical paths (quotes, intake, pricing), and monolithic quotes/new and seed-demo.
- **Quick wins:** Extend helpers to quotes, intake, routing, fleet-forecasting; document prepare script.
- **Highest ROI next:** Split quotes/new page, API integration tests, shared form hook, refactor seed-demo.
- **Risk:** Quote and intake flows remain high-impact and largely untested; addressing tests and duplication will reduce production bug risk and speed up changes.
