# sw26 — Private Aviation Charter Platform

Next.js 16 app for managing private aviation charters: clients, operators, aircraft, quotes, compliance, and AI-powered intake.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4
- **Auth/DB**: Supabase (SSR cookies via `@supabase/ssr`)
- **Validation**: Zod
- **AI**: Anthropic SDK (`@anthropic-ai/sdk`)
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
  (app)/             # Authenticated routes (dashboard, clients, quotes, aircraft, operators, compliance, intake)
  (auth)/            # Auth routes (login)
  api/               # API route handlers
    aircraft/        # CRUD + [id]
    clients/         # CRUD + [id]
    compliance/      # check/, route
    crew/            # CRUD + [id]
    intake/          # AI-powered intake
    operators/       # CRUD + [id]
    quotes/          # CRUD + [id] + versions
lib/
  ai/                # AI helpers (audit.ts, intake.ts)
  compliance/        # Compliance checker
  pricing/           # Pricing engine + geo
  schemas/           # Zod schemas
  supabase/          # client.ts (browser), server.ts (SSR)
  database.types.ts  # Generated Supabase types
  geo.ts             # Geo utilities
components/
  Sidebar.tsx
  ui/
```

## Auth

Supabase auth managed via `middleware.ts`:

- `/` redirects to `/dashboard` (authenticated) or `/login` (unauthenticated)
- Unauthenticated requests to protected routes redirect to `/login`
- Authenticated users hitting `/login` redirect to `/dashboard`

Supabase clients:

- `lib/supabase/client.ts` — browser client
- `lib/supabase/server.ts` — server/RSC client

## Env Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## Using Nia (External Docs & Research)

**BEFORE using WebFetch or WebSearch:**

1. Check indexed sources: `manage_resource(action='list', query='relevant-keyword')`
2. If indexed: use `search`, `nia_grep`, `nia_read`, `nia_explore`
3. If not indexed but URL known: use `index` tool, wait 1–5 min, then search
4. If URL unknown: use `nia_research(mode='quick')` to discover, then index

Always prefer Nia over WebFetch — Nia returns full structured content, not truncated summaries. For docs, index the root URL (e.g. `docs.stripe.com`) to scrape all pages.
