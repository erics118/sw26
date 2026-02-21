// ─── Date utility helpers for forecasting ─────────────────────────────────────

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setUTCDate(result.getUTCDate() + n);
  return result;
}

/** Returns an array of ISO date strings (YYYY-MM-DD) from start to end inclusive */
export function dateRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  let current = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  const endUTC = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
  );
  while (current <= endUTC) {
    dates.push(formatDate(current));
    current = addDays(current, 1);
  }
  return dates;
}

/** 0 = Sunday, 1 = Monday, ... 6 = Saturday (UTC) */
export function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + "T12:00:00Z").getUTCDay();
}
