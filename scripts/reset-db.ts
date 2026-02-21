/**
 * Reset the database to a clean state with seed data.
 *
 * Requires a direct (non-pooler) Postgres connection URL set as DATABASE_URL.
 * In Supabase: Settings → Database → Connection string → URI (use port 5432).
 *
 * Example:
 *   DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres \
 *   npm run db:reset
 *
 * Or add DATABASE_URL to .env.local and run: npm run db:reset
 */

import postgres from "postgres";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL is not set.");
  console.error(
    "Set it to your Supabase direct Postgres URL (port 5432, not 6543):",
  );
  console.error(
    "  postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres",
  );
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require" });

try {
  const resetSql = readFileSync(
    join(__dirname, "..", "supabase", "reset.sql"),
    "utf-8",
  );

  console.log("Resetting database…");
  await sql.unsafe(resetSql);
  console.log("Done. Database is clean and seeded.");
} finally {
  await sql.end();
}
