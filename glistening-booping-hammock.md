# Plan: Part 135 Charter MVP — 5-Agent Build (Hackathon)

## Context

Fresh Next.js 16 / React 19 / Tailwind CSS 4 / TypeScript project (`/Users/eric/dev/sw26`).
Hackathon MVP — move fast, ship a working demo. No billing. Core loop:
**intake email/call → AI extracts trip → system prices quote → compliance check → quote sent.**

---

## Tech Stack (locked)

- **Framework**: Next.js 16 App Router (TypeScript)
- **Styling**: Tailwind CSS 4
- **Backend-as-a-Service**: Supabase (Postgres DB, Auth, Realtime, Storage)
- **AI**: Anthropic Claude API (`claude-sonnet-4-6`)
- **Validation**: Zod
- **Data fetching**: `@supabase/ssr` + native fetch

---

## Database (Supabase)

All tables created via Supabase SQL editor / migrations:

| Table         | Purpose                                                                             |
| ------------- | ----------------------------------------------------------------------------------- |
| `clients`     | Name, company, email, phone, nationality, notes                                     |
| `aircraft`    | Tail #, category, range, cabin height, pax capacity, fuel burn, wifi, bathroom      |
| `operators`   | Name, cert number, insurance expiry, reliability score                              |
| `crew`        | Name, operator_id, ratings, duty hours used this week                               |
| `trips`       | Legs JSON, pax count, dates, flexibility, special needs                             |
| `quotes`      | trip_id, client_id, aircraft_id, operator_id, status, price breakdown JSON, version |
| `quote_costs` | Fuel, FBO, reposition, permits, crew overnight, catering, surcharge, margin, tax    |
| `audit_logs`  | Immutable: user_id, action, payload, ai_generated (bool), created_at                |

Auth: Supabase built-in (email/password). One user role: `staff`.

---

## Agent 1 — Foundation & Supabase Setup

**Goal**: Working Supabase connection, types, auth, route skeleton.

### Tasks

1. Install `@supabase/ssr`, `@supabase/supabase-js`, `zod`
2. Create `/lib/supabase/server.ts` and `/lib/supabase/client.ts` (SSR-safe clients)
3. Write SQL migration for all 8 tables above — paste into Supabase SQL editor (output as `/supabase/schema.sql`)
4. Run `npx supabase gen types typescript` → `/lib/database.types.ts`
5. Configure Supabase Auth in `/lib/supabase/server.ts` + middleware for route protection
6. Create `/middleware.ts` — protect `/app/(app)/**`, redirect unauthenticated to `/login`
7. Create `.env.local.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`
8. Create Zod schemas for each table in `/lib/schemas/`
9. Create stub API routes: `/app/api/quotes/route.ts`, `/app/api/intake/route.ts`, `/app/api/clients/route.ts`, `/app/api/aircraft/route.ts`

### Files

- `lib/supabase/server.ts`, `lib/supabase/client.ts`
- `lib/database.types.ts`
- `lib/schemas/index.ts`
- `middleware.ts`
- `supabase/schema.sql`
- `.env.local.example`

### Depends on: nothing

---

## Agent 2 — AI Intake Engine

**Goal**: Paste raw email/call text → Claude extracts structured trip → saved to DB.

### Tasks

1. Install `@anthropic-ai/sdk`
2. Build `/lib/ai/intake.ts`:
   - System prompt: extract departure/arrival airports, dates, pax (adults/children/pets), aircraft prefs (category, min cabin height, wifi, bathroom), luggage, one-way vs round-trip, flexibility window, special needs, catering, client name/contact
   - Call `claude-sonnet-4-6` with the raw text
   - Parse and validate response against Zod `TripIntakeSchema`
   - Return structured JSON + confidence flags for fields that couldn't be extracted
3. Build `/app/api/intake/route.ts` (POST):
   - Accept `{ raw_text: string, client_id?: string }`
   - Call `lib/ai/intake.ts`
   - Insert into `trips` table
   - Write to `audit_logs` (ai_generated: true, payload: extracted JSON)
   - Return trip ID + extraction result
4. Build `/lib/ai/audit.ts` — helper to write every Claude call to audit_logs (model, prompt hash, confidence, human_verified: false)

### Files

- `lib/ai/intake.ts`
- `lib/ai/audit.ts`
- `app/api/intake/route.ts`

### Depends on: Agent 1 (Supabase client, schemas)

---

## Agent 3 — Quote Generation Engine

**Goal**: Given a trip + aircraft + operator, produce a full itemized quote.

### Tasks

1. Build `/lib/pricing/engine.ts`:
   - Inputs: trip legs, aircraft fuel burn rate, distance (use great-circle calc), FBO fee lookup (flat table by airport), repositioning hours/cost, permit flag (intl?), crew overnight (if > 4hr layover), catering line items, peak-day surcharge (Fri/Sun flag), margin %, tax rate by country
   - Output: `{ line_items: CostLineItem[], subtotal, margin_amount, tax, total, per_leg_breakdown }`
2. Build `/lib/pricing/geo.ts` — great-circle distance between ICAO codes (use static airport coords table or lookup)
3. Build `/app/api/quotes/route.ts` (POST + GET):
   - POST: accept `{ trip_id, aircraft_id, operator_id, margin_pct, catering, notes }`, run pricing engine, insert `quotes` + `quote_costs`, return quote
   - GET: list quotes with filters (status, client, date range)
4. Build `/app/api/quotes/[id]/route.ts` (GET, PATCH):
   - GET: full quote detail with cost breakdown
   - PATCH: update status (`new → pricing → sent → negotiating → confirmed → lost → completed`), update margin, add notes
5. Build `/app/api/quotes/[id]/versions/route.ts` — save new version snapshot before each edit

### Files

- `lib/pricing/engine.ts`
- `lib/pricing/geo.ts`
- `app/api/quotes/route.ts`
- `app/api/quotes/[id]/route.ts`
- `app/api/quotes/[id]/versions/route.ts`

### Depends on: Agent 1

---

## Agent 4 — Compliance & Data Management

**Goal**: Basic Part 135 checks, operator/aircraft/client CRUD, audit trail.

### Tasks

1. Build `/lib/compliance/checker.ts`:
   - Check operator has valid Part 135 cert (cert not expired in DB)
   - Check insurance not expired
   - Check aircraft range ≥ trip distance
   - Check aircraft cabin height ≥ required minimum
   - Check crew duty hours won't exceed limit (simple: used + estimated flight ≤ 60hr/week)
   - Return `{ passed: boolean, failures: string[] }`
2. Build `/app/api/compliance/check/route.ts` (POST):
   - Accept `{ quote_id }` or `{ trip_id, aircraft_id, operator_id, crew_ids }`
   - Run checker, return result, write to audit_logs
3. Build `/app/api/clients/route.ts` — GET list, POST create
4. Build `/app/api/clients/[id]/route.ts` — GET, PATCH, GET trip history
5. Build `/app/api/aircraft/route.ts` + `/app/api/aircraft/[id]/route.ts` — CRUD
6. Build `/app/api/operators/route.ts` + `/app/api/operators/[id]/route.ts` — CRUD
7. Build `/app/api/crew/route.ts` + `/app/api/crew/[id]/route.ts` — CRUD

### Files

- `lib/compliance/checker.ts`
- `app/api/compliance/check/route.ts`
- `app/api/clients/[[...route]]/route.ts`
- `app/api/aircraft/[[...route]]/route.ts`
- `app/api/operators/[[...route]]/route.ts`
- `app/api/crew/[[...route]]/route.ts`

### Depends on: Agent 1

---

## Agent 5 — Frontend (Receptionist Dashboard)

**Goal**: A clean, usable UI for the full receptionist workflow. Demo-ready.

### Tasks

1. Update `app/layout.tsx` — sidebar nav: Dashboard, New Intake, Quotes, Clients, Aircraft, Operators, Compliance
2. Build `app/(auth)/login/page.tsx` — Supabase email/password login
3. Build `app/(app)/dashboard/page.tsx` — KPI cards (open quotes, confirmed this week, pending compliance), recent quotes table
4. Build `app/(app)/intake/page.tsx` — **key demo screen**:
   - Large textarea: "Paste email or call notes"
   - "Extract with AI" button → shows extracted fields in a review form
   - Human can edit any field
   - "Save Trip" → creates trip record
   - Inline spinner + confidence indicators per field
5. Build `app/(app)/quotes/page.tsx` — sortable/filterable quote list with status badges
6. Build `app/(app)/quotes/new/page.tsx` — select trip → pick aircraft → pick operator → set margin → preview pricing breakdown → run compliance check inline → save & send
7. Build `app/(app)/quotes/[id]/page.tsx` — full quote detail: cost table, status stepper, edit margin, add notes, mark status
8. Build `app/(app)/clients/page.tsx` + `app/(app)/clients/[id]/page.tsx`
9. Build `app/(app)/aircraft/page.tsx` + `app/(app)/operators/page.tsx` — simple data tables with add/edit modals
10. Build `app/(app)/compliance/page.tsx` — list of expiry warnings (certs, insurance) color-coded
11. Shared components in `components/ui/`: Button, Card, Table, Badge, Modal, StatusStepper, ConfidenceChip, CostBreakdown

### Files

- `app/layout.tsx` (updated)
- `app/(auth)/login/page.tsx`
- `app/(app)/dashboard/page.tsx`
- `app/(app)/intake/page.tsx`
- `app/(app)/quotes/page.tsx`
- `app/(app)/quotes/new/page.tsx`
- `app/(app)/quotes/[id]/page.tsx`
- `app/(app)/clients/[[...slug]]/page.tsx`
- `app/(app)/aircraft/page.tsx`
- `app/(app)/operators/page.tsx`
- `app/(app)/compliance/page.tsx`
- `components/ui/*.tsx`

### Depends on: Agents 1–4

---

## Execution Order

```
Phase 1 (solo):     Agent 1  →  Supabase setup + types + auth
Phase 2 (parallel): Agent 2 + Agent 3 + Agent 4  →  AI, pricing, compliance APIs
Phase 3 (solo):     Agent 5  →  Frontend wired to all APIs
```

---

## Verification (Demo Flow)

1. `npm run dev` — no errors
2. Log in → redirected to dashboard
3. Go to Intake → paste a sample charter request email → AI extracts fields → save trip
4. Go to New Quote → select that trip + an aircraft + operator → pricing breakdown appears → compliance check passes → save quote
5. Quote appears in list with status "Sent"
6. `npm run build` — clean TypeScript + ESLint
