import { toDisplayDate } from "@/utils/date";
import { formatINR } from "@/utils/numeric";

export function formatRecurrenceLine(
  unitAmount: number,
  recurrenceLabel: string,
  occurrences: number,
  startDate?: string,
  endDate?: string,
): string {
  const amountPart = formatINR(unitAmount);
  const countPart = `${recurrenceLabel} ×${occurrences}`;
  if (startDate && endDate) {
    return `${amountPart} ${countPart} · ${toDisplayDate(startDate)} → ${toDisplayDate(endDate)}`;
  }
  return `${amountPart} ${countPart}`;
}
