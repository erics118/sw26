# AI Integration Ideas — sw26

Current AI surfaces: **intake** (extraction), **quote** (agent + preview route recommendation), **fleet forecasting** (insights, utilization, learning). Below are concrete ways to integrate AI further.

---

## 1. High impact, low effort

### 1.1 One-click “Generate quote” from intake (reverted)

- **Where:** After intake save, on the redirect to `/quotes/new?trip_id=…` or on the intake success state.
- **What:** Add a primary CTA “Generate quote with AI” that `POST /api/quotes` with `trip_id` (no aircraft), so `runQuoteAgent` picks aircraft + route and creates the quote. Then redirect to `/quotes/[id]`.
- **Why:** Removes the manual step of choosing trip + aircraft on New Quote; agent already does that when `aircraft_id` is omitted. _(Previously implemented then reverted; API still supports it.)_

### 1.2 Show agent reasoning on quote detail (done)

- **Where:** `app/(app)/quotes/[id]/page.tsx` — you already load `audit_logs` for `quote.created`.
- **What:** If the audit payload has `aircraft_explanation` / `route_explanation` / `optimization_mode`, render an “Why we chose this” or “AI selection” collapsible block (e.g. aircraft + route reasoning).
- **Why:** Trust and transparency; reuses data you already store.

### 1.3 “Suggest aircraft” in manual quote flow

- **Where:** `/quotes/new` when not in preview flow (trip selected, no aircraft yet).
- **What:** Reuse the same logic as `/api/quotes/preview`: for the selected trip, pick best aircraft + run 3 route plans + `getRouteRecommendation`. Return aircraft + recommended mode and optionally the recommendation text. Button: “Suggest best aircraft”.
- **Why:** Keeps manual flow but adds AI assist without going full agent.

---

## 2. Medium effort, high value

### 2.1 Client detail — “Next best action” or summary

- **Where:** `app/(app)/clients/[id]/page.tsx`.
- **What:** New API or server action that takes `client_id`, loads client + recent quotes (status, dates, trip legs). One Messages API call (e.g. Haiku) with system “You are a charter account manager…” and a payload of client + last N quotes. Return `{ summary: string, next_action: string }` and render in a small card.
- **Why:** Gives ops/sales a quick, contextual “what to do next” for the account.

### 2.2 Quote detail — “Explain this quote”

- **Where:** `app/(app)/quotes/[id]/page.tsx`.
- **What:** Button “Explain this quote” that calls an API with quote id. Server loads quote + trip + costs + route_plan (if any), sends structured summary to Claude (Haiku). Return 2–3 sentence plain-English explanation (route, aircraft, main cost drivers). Show in a modal or expandable section.
- **Why:** Helps non-experts understand why the quote looks the way it does.

### 2.3 Dashboard — daily briefing

- **Where:** `app/(app)/dashboard/page.tsx` (you already fetch forecast, utilization, recommendations).
- **What:** Server component or API that aggregates: open quotes count, today’s trips, forecast summary, utilization summary, top 1–2 recommendations. Single Messages API call: “Given this ops snapshot, write a 3–4 sentence daily briefing for dispatch.” Cache 5–15 min. Render at top of dashboard.
- **Why:** One place to read “what matters today” without clicking through tabs.

---

## 3. Larger / exploratory

### 3.1 Natural-language client/trip search

- **Where:** Clients list or a global search bar.
- **What:** User types e.g. “clients who flew to Aspen in January”. LLM extracts structured filters (destination ICAO, date range, etc.); server runs existing Supabase queries with those filters. Start with a single “smart search” endpoint and a simple prompt (extract location + date range).
- **Why:** Faster than teaching users filters and columns.

### 3.2 Intake: suggest client from text

- **Where:** Intake flow, after extraction (you already have `client_name`, `client_email`, etc.).
- **What:** Before or after “Save trip”, call `search_clients` (or a dedicated API) with extracted name/email/company; if one close match, show “Likely existing client: X” with option to link trip to that client. No new agent; just existing search + one LLM call to decide “same client? yes/no + confidence”.
- **Why:** Reduces duplicate clients and improves quote→client linking.

### 3.3 Fleet forecasting — “Ask a follow-up”

- **Where:** Fleet forecasting tab where you show insights (summary + actions).
- **What:** Optional “Ask about this forecast” text input. Send current forecast payload + user question to Claude; return a short answer. Can be a simple POST endpoint with no persistence (or persist in audit_logs for compliance).
- **Why:** Deeper understanding of why a recommendation was made without reading raw numbers.

### 3.4 Audit log summarization

- **Where:** Admin or ops view over `audit_logs` (if you add one).
- **What:** For a date range or entity, aggregate log entries and ask Claude to summarize: “What changed for quote X?” or “What AI actions ran today?”. Useful for compliance and handoffs.
- **Why:** Audit is already there; AI makes it scannable.

---

## 4. Technical notes

- **Reuse patterns:** You already have `extractTripFromText`, `getRouteRecommendation`, `generateForecastInsight` — same idea: structured prompt, JSON out, parse with fallback. New features can follow the same style (single Messages API call, no agent) where possible.
- **Agent vs single call:** Use the **quote agent** when you need tool loop (DB + routing + pricing). Use **single Messages API** for summarization, explanation, “next action”, and search intent extraction.
- **Audit:** Keep using `auditAICall` (and audit_logs) for any new AI paths that affect business data or decisions.
- **Cost:** Haiku for extraction/short summaries and route recommendation; Sonnet already used for forecasting insights. Prefer Haiku for new “assist” features to keep cost low.

---

## 5. Suggested order

1. **1.2** — Show agent reasoning on quote detail (data already there).
2. **1.1** — One-click “Generate quote” from intake.
3. **1.3** — “Suggest aircraft” on New Quote (manual flow).
4. **2.1** or **2.2** — Client “next action” or Quote “explain”.
5. **2.3** — Dashboard daily briefing.

Then expand with 3.x based on user feedback.
