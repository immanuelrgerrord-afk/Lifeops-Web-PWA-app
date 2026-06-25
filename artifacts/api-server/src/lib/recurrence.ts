import { addMonthsISO, compareISO, isDateInMonth, monthsElapsed, todayISO } from "./dates.js";

export const RECURRENCE_TYPES = [
  "one-time",
  "monthly",
  "quarterly",
  "half-yearly",
  "yearly",
] as const;

export type RecurrenceType = (typeof RECURRENCE_TYPES)[number];

export function isValidRecurrenceType(type: string): type is RecurrenceType {
  return (RECURRENCE_TYPES as readonly string[]).includes(type);
}

export function intervalMonths(recurrenceType: string): number {
  const map: Record<string, number> = {
    monthly: 1,
    quarterly: 3,
    "half-yearly": 6,
    yearly: 12,
  };
  return map[recurrenceType] ?? 0;
}

/** Date of the nth occurrence (0-based index). */
export function occurrenceDate(startDate: string, recurrenceType: string, index: number): string {
  if (index <= 0) return startDate;
  return addMonthsISO(startDate, intervalMonths(recurrenceType) * index);
}

/** All occurrence dates for a recurring series. */
export function allOccurrenceDates(
  startDate: string,
  recurrenceType: string,
  occurrenceCount: number,
): string[] {
  if (recurrenceType === "one-time" || occurrenceCount <= 0) return [startDate];
  const dates: string[] = [];
  for (let i = 0; i < occurrenceCount; i++) {
    dates.push(occurrenceDate(startDate, recurrenceType, i));
  }
  return dates;
}

/** Next occurrence on or after today; null if series completed. */
export function nextOccurrenceDate(
  startDate: string,
  recurrenceType: string,
  occurrenceCount: number,
  generatedOccurrences: number,
): string | null {
  if (recurrenceType === "one-time") return generatedOccurrences >= 1 ? null : startDate;
  if (generatedOccurrences >= occurrenceCount) return null;

  const today = todayISO();
  for (let i = generatedOccurrences; i < occurrenceCount; i++) {
    const d = occurrenceDate(startDate, recurrenceType, i);
    if (compareISO(d, today) >= 0) return d;
  }
  return null;
}

/** Occurrence dates in a month that should count toward totals (not future within current month). */
export function occurrenceDatesInMonth(
  startDate: string,
  recurrenceType: string,
  occurrenceCount: number,
  month: string,
  asOf: string = todayISO(),
): string[] {
  if (recurrenceType === "one-time") {
    return isDateInMonth(startDate, month) ? [startDate] : [];
  }

  const currentMonth = asOf.slice(0, 7);
  const dates: string[] = [];
  for (let i = 0; i < occurrenceCount; i++) {
    const d = occurrenceDate(startDate, recurrenceType, i);
    if (!isDateInMonth(d, month)) continue;
    if (month === currentMonth && compareISO(d, asOf) > 0) continue;
    dates.push(d);
  }
  return dates;
}

/** Upcoming occurrences within the next N days (not yet generated). */
export function upcomingOccurrences(
  startDate: string,
  recurrenceType: string,
  occurrenceCount: number,
  generatedOccurrences: number,
  withinDays = 30,
): Array<{ date: string; index: number }> {
  if (recurrenceType === "one-time") return [];

  const today = todayISO();
  const end = new Date();
  end.setDate(end.getDate() + withinDays);
  const endISO = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;

  const results: Array<{ date: string; index: number }> = [];
  for (let i = generatedOccurrences; i < occurrenceCount; i++) {
    const d = occurrenceDate(startDate, recurrenceType, i);
    if (compareISO(d, today) < 0) continue;
    if (compareISO(d, endISO) > 0) break;
    results.push({ date: d, index: i });
  }
  return results;
}

export function recurrenceLabel(type: string): string {
  const map: Record<string, string> = {
    "one-time": "One Time",
    monthly: "Monthly",
    quarterly: "Quarterly",
    "half-yearly": "Half-Yearly",
    yearly: "Yearly",
  };
  return map[type] ?? type;
}

export function totalPlannedCost(amount: number, recurrenceType: string, occurrenceCount: number): number {
  if (recurrenceType === "one-time") return amount;
  return Math.round(amount * occurrenceCount * 100) / 100;
}

/** How many occurrences have calendar dates on or before asOf. */
export function dueOccurrenceCount(
  startDate: string,
  recurrenceType: string,
  occurrenceCount: number,
  asOf: string = todayISO(),
): number {
  if (recurrenceType === "one-time") {
    return compareISO(startDate, asOf) <= 0 ? 1 : 0;
  }
  let count = 0;
  for (let i = 0; i < occurrenceCount; i++) {
    if (compareISO(occurrenceDate(startDate, recurrenceType, i), asOf) <= 0) count++;
  }
  return count;
}
