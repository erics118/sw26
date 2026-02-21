# sw26 — Documentation

Private aviation charter platform for managing clients, aircraft, quotes, trip intake, fleet forecasting, and flight routing. Designed for a **single operator** (not multi-tenant).

## Tech stack

| Layer      | Technology                                 |
| ---------- | ------------------------------------------ |
| Framework  | Next.js 16 (App Router)                    |
| UI         | React 19, Tailwind CSS 4                   |
| Auth & DB  | Supabase (SSR cookies via `@supabase/ssr`) |
| Validation | Zod                                        |
| AI         | Anthropic SDK + Claude Agent SDK           |
| Language   | TypeScript (strict)                        |

## Documentation index

### Application features

| Document                                           | Description                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [Dashboard](features/dashboard.md)                 | Operations overview, KPIs, live ops, recent quotes                                    |
| [Authentication](features/authentication.md)       | Login, session, redirects, sign out                                                   |
| [AI Intake](features/intake.md)                    | Paste email/notes → AI extracts trip and client details                               |
| [Quotes](features/quotes.md)                       | List, filter, new quote (trip + aircraft + route plan), quote detail & cost breakdown |
| [Clients](features/clients.md)                     | Client list, profile, contact, quote history                                          |
| [Aircraft (Fleet)](features/aircraft.md)           | Fleet list, aircraft specs, categories, status                                        |
| [Fleet Forecasting](features/fleet-forecasting.md) | Demand/capacity forecast, utilization, recommendations, post-flight learning          |

### Backend & engines

| Document                              | Description                                                   |
| ------------------------------------- | ------------------------------------------------------------- |
| [Flight routing](features/routing.md) | Route planning, fuel stops, weather, NOTAMs, risk score       |
| [Pricing engine](features/pricing.md) | Cost breakdown, margin, FBO, repositioning, permits, catering |
| [AI agents](features/agents.md)       | Intake agent, quote agent, database tools, audit              |

### Data

| Document                                               | Description                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| [Database and schema](features/database-and-schema.md) | Core and supporting tables, relationships, validation (Zod) |

### API reference

| Document                      | Description                                               |
| ----------------------------- | --------------------------------------------------------- |
| [API overview](api/README.md) | All API routes, methods, and main request/response shapes |

## Quick start

```bash
npm run dev    # Start dev server
npm run build  # Production build
npm run lint   # ESLint
npm run format # Prettier
```

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key

See [Authentication](features/authentication.md) for auth behavior.
