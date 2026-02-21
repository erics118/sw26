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
