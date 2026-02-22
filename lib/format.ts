/** Formats an ISO or date string for display (e.g. client "Added" column). Returns "—" if invalid. */
export function formatDate(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Formats flight time in hours as "X hr Y min" or "Y min" when under 1 hr. */
export function formatFlightTime(hr: number): string {
  const totalMin = Math.round(hr * 60);
  if (totalMin < 1) return "0 min";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

/** Formats a number as currency (e.g. "$12,345"). No decimal places. */
export function formatCurrency(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}
