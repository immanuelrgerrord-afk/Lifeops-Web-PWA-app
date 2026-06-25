import { occurrenceDate, recurrenceLabel, totalPlannedCost } from "./recurrence.js";

export type RecurringTemplate = {
  id: number;
  amount: string;
  date: string;
  recurrenceType: string;
  occurrences: number;
};

export function buildTemplateMap<T extends RecurringTemplate>(rows: T[]): Map<number, T> {
  return new Map(rows.map((r) => [r.id, r]));
}

function recurrenceBounds(startDate: string, recurrenceType: string, occurrences: number) {
  if (recurrenceType === "one-time") {
    return { recurrenceStartDate: startDate, recurrenceEndDate: startDate };
  }
  return {
    recurrenceStartDate: startDate,
    recurrenceEndDate: occurrenceDate(startDate, recurrenceType, Math.max(0, occurrences - 1)),
  };
}

export function resolveRecurrenceDisplay(
  row: {
    parentId: number | null;
    date: string;
    recurrenceType: string;
    occurrences: number;
    amount: string;
  },
  templateMap: Map<number, RecurringTemplate>,
) {
  if (row.parentId != null && templateMap.has(row.parentId)) {
    const parent = templateMap.get(row.parentId)!;
    const perAmount = Number(parent.amount);
    const bounds = recurrenceBounds(parent.date, parent.recurrenceType, parent.occurrences);
    return {
      recurrenceType: parent.recurrenceType,
      occurrences: parent.occurrences,
      occurrenceCount: parent.occurrences,
      perOccurrenceAmount: perAmount,
      totalPlannedCost: totalPlannedCost(perAmount, parent.recurrenceType, parent.occurrences),
      recurrenceLabel: recurrenceLabel(parent.recurrenceType),
      recurrenceStartDate: bounds.recurrenceStartDate,
      recurrenceEndDate: bounds.recurrenceEndDate,
      isMaterializedOccurrence: true,
      templateId: row.parentId,
    };
  }

  const amount = Number(row.amount);
  const bounds = recurrenceBounds(row.date, row.recurrenceType, row.occurrences);
  return {
    recurrenceType: row.recurrenceType,
    occurrences: row.occurrences,
    occurrenceCount: row.occurrences,
    perOccurrenceAmount: amount,
    totalPlannedCost: totalPlannedCost(amount, row.recurrenceType, row.occurrences),
    recurrenceLabel: recurrenceLabel(row.recurrenceType),
    recurrenceStartDate: bounds.recurrenceStartDate,
    recurrenceEndDate: bounds.recurrenceEndDate,
    isMaterializedOccurrence: false,
    templateId: null as number | null,
  };
}
