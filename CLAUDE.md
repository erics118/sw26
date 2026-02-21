# sw26 — Private Aviation Charter Platform

Next.js 16 app for managing private aviation charters: clients, aircraft, quotes, fleet forecasting, and AI-powered intake. Designed for a single operator (not multi-tenant).

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4
- **Auth/DB**: Supabase (SSR cookies via `@supabase/ssr`)
- **Validation**: Zod
- **AI**: Anthropic SDK (`@anthropic-ai/sdk`) + Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- **Language**: TypeScript (strict)

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier write
npm run format:check # Prettier check
```

> **Hooks**: After every `Write` or `Edit`, the project automatically runs `npm run format && npm run lint:fix`.

## Project Structure

```
app/
  (app)/             # Authenticated routes
    dashboard/
    intake/          # AI-powered trip intake
    quotes/          # List, new, [id]
    clients/         # List, [id]
    aircraft/
    fleet-forecasting/
  (auth)/            # login
  api/
    aircraft/        # CRUD + [id]
    clients/         # CRUD + [id]
    crew/            # CRUD + [id]
    intake/          # AI intake endpoint
    quotes/          # CRUD + [id] + [id]/versions
    routing/         # plan/, plan/[id], airports/, airports/[icao]
    fleet-forecasting/  # forecast, insights, maintenance, overrides, recommendations, utilization

lib/
  agents/            # Claude Agent SDK (quote only)
    index.ts         # runAgent() helper
    intake.agent.ts  # Intake orchestration (extraction + server-side lookup/save)
    quote.agent.ts   # Quote generation (agent with tools)
    tools/
      database.ts    # MCP tools: search_clients, save_trip, get_trip, lookup_airport, list_aircraft, compute_route_plan, save_route_plan, calculate_pricing, save_quote
  ai/                # Direct Claude helpers
    audit.ts         # Audit log writer
    forecasting.ts   # Fleet forecasting AI
    intake.ts        # extractTripFromText() — single LLM call, no agent
  forecasting/       # Fleet forecasting logic (capacity, demand, utilization, etc.)
  pricing/
    engine.ts        # Deterministic pricing engine
  routing/           # Flight routing (graph, optimizer, weather, notam, risk, performance)
  schemas/           # Zod schemas
  supabase/
    client.ts        # Browser client
    server.ts        # SSR/RSC client
  database.types.ts  # Generated Supabase types
  geo.ts             # Geo utilities (distanceNm; haversineNm in lib/routing/airport-db.ts)
  ops/               # Mock data + types for ops views

components/
  Sidebar.tsx
  ui/
```

## Auth

Supabase auth managed via `proxy.ts` (Next.js 16 proxy convention):

- `/` redirects to `/dashboard` (authenticated) or `/login` (unauthenticated)
- Unauthenticated requests to protected routes redirect to `/login`
- Authenticated users hitting `/login` redirect to `/dashboard`

## AI: Intake vs Quote

**Intake** (extraction only, no agent):

- `lib/ai/intake.ts` — `extractTripFromText(rawText)` — single Messages API call, returns structured JSON
- `lib/agents/intake.agent.ts` — orchestrates: extract → resolve airports (DB) → search clients → save trip
- No agent loop, no tools. Fast.

**Quote** (Claude Agent SDK):

- `lib/agents/index.ts` — `runAgent<T>()` shared runner, uses `bypassPermissions`
- `lib/agents/tools/database.ts` — `createDatabaseTools(supabase)` — MCP tools: `search_clients`, `save_trip`, `get_trip`, `lookup_airport`, `list_aircraft`, `list_crew`, `compute_route_plan`, `save_route_plan`, `calculate_pricing`, `save_quote`
- `lib/agents/quote.agent.ts` — builds quotes; selects best aircraft and route plan (cost/balanced/time); uses database tools only

Agent notes:

- `permissionMode: "bypassPermissions"` requires `allowDangerouslySkipPermissions: true`
- Pass `builtinTools: []` to disable WebFetch etc.
- JSON extraction uses `{` / `}` position search (not anchored regex)

## Env Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
ANTHROPIC_API_KEY   # For Messages API (intake, forecasting) and Agent SDK (quote)
```

## Using Nia (External Docs & Research)

**BEFORE using WebFetch or WebSearch:**

1. Check indexed sources: `manage_resource(action='list', query='relevant-keyword')`
2. If indexed: use `search`, `nia_grep`, `nia_read`, `nia_explore`
3. If not indexed but URL known: use `index` tool, wait 1–5 min, then search
4. If URL unknown: use `nia_research(mode='quick')` to discover, then index

Always prefer Nia over WebFetch — Nia returns full structured content, not truncated summaries. For docs, index the root URL (e.g. `docs.stripe.com`) to scrape all pages.
