# Clients

Clients are the CRM entity for charter customers: contact info, company, flags (VIP, risk), and notes. The app provides a list view and a detail view with quote history.

## Routes

| URL             | Description                                                  |
| --------------- | ------------------------------------------------------------ |
| `/clients`      | List all clients (name, company, contact, flags, added date) |
| `/clients/[id]` | Client profile: contact, details, quote history              |

Both require authentication.

---

## Clients list (`/clients`)

### Features

- **Header:** "Clients" and total count; **"Add Client"** button → `/clients/new` (ensure this route exists if you use it).
- **Table columns:**
  - **Name** — link to `/clients/[id]`.
  - **Company** — optional.
  - **Contact** — email; phone on second line if present.
  - **Flags** — VIP (amber badge), RISK (red badge) when set.
  - **Added** — `created_at` as date.

### Data

- `clients` ordered by `name`; fields: `id`, `name`, `company`, `email`, `phone`, `vip`, `risk_flag`, `created_at`.

---

## Client detail (`/clients/[id]`)

### Features

- **Header:** Breadcrumb (Clients / name), client name, company; **VIP** and **RISK FLAG** badges when set.
- **Quote history (main):** Table of quotes for this client: Quote ID (link to `/quotes/[id]`), Route (first → last ICAO from trip legs), Status (badge), Date. Empty state with link to "Start new intake →".
- **Sidebar:**
  - **Contact:** Email (mailto), Phone (tel), Nationality.
  - **Details:** Member since (`created_at`), Total quotes count, Confirmed count (quotes with status `confirmed`).
  - **Notes:** Client notes when present.

### Data

- Client by `id` (full row).
- Quotes where `client_id = id`, with `trips(legs)` for route display, ordered by `created_at` desc.

---

## Client schema (database & API)

Stored in `clients` table and validated with `ClientSchema` / `CreateClientSchema` (Zod):

| Field       | Type        | Notes          |
| ----------- | ----------- | -------------- |
| id          | uuid        | Auto-generated |
| created_at  | timestamptz | Default now()  |
| name        | text        | Required       |
| company     | text        | Optional       |
| email       | text        | Optional       |
| phone       | text        | Optional       |
| nationality | text        | Optional       |
| notes       | text        | Optional       |
| risk_flag   | boolean     | Default false  |
| vip         | boolean     | Default false  |

---

## API: Clients

- **GET /api/clients** — List all clients (ordered by `created_at` desc). Returns array of client rows.
- **POST /api/clients** — Create client. Body: `CreateClientSchema`. Returns `201` with created client.
- **GET /api/clients/[id]** — Get one client by id. Returns 404 if not found.
- **PATCH/PUT /api/clients/[id]** — Update client (if implemented; see API route files).

Intake can return a **client_hint** (name, email, phone, company) from the AI; linking that to an existing client (e.g. via search) or creating a new client is done outside the intake API (e.g. in a future clients/new or intake follow-up flow).

## Related

- [Intake](intake.md) — AI can extract client contact from raw text (client_hint)
- [Quotes](quotes.md) — quotes are linked to clients via `client_id`
