/** Parse YYYY-MM-DD as local calendar date (no timezone drift). */
export function parseISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export function todayISO(): string {
  return formatISODate(new Date());
}

/** Add months preserving day-of-month when possible; clamps to month-end (e.g. Jan 31 → Feb 28). */
export function addMonthsISO(dateStr: string, months: number): string {
  const d = parseISODate(dateStr);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return formatISODate(d);
}

/** Full calendar months elapsed since start; 0 if start is in the future. */
export function monthsElapsed(startDate: string, asOf: Date = new Date()): number {
  const start = parseISODate(startDate);
  const end = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  if (end < start) return 0;
  let months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

export function compareISO(a: string, b: string): number {
  return a.localeCompare(b);
}

export function monthEndISO(month: string): string {
  const [y, mo] = month.split("-").map(Number);
  return formatISODate(new Date(y, mo, 0));
}

export function isDateInMonth(dateStr: string, month: string): boolean {
  return dateStr.startsWith(month);
}
