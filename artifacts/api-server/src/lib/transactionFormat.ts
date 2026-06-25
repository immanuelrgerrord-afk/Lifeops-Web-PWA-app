import { recurrenceLabel, totalPlannedCost } from "./recurrence.js";

export type RecurringTemplate = {
  id: number;
  amount: string;
  recurrenceType: string;
  occurrences: number;
};

export function buildTemplateMap<T extends RecurringTemplate>(rows: T[]): Map<number, T> {
  return new Map(rows.map((r) => [r.id, r]));
}

export function resolveRecurrenceDisplay(
  row: {
    parentId: number | null;
    recurrenceType: string;
    occurrences: number;
    amount: string;
  },
  templateMap: Map<number, RecurringTemplate>,
) {
  if (row.parentId != null && templateMap.has(row.parentId)) {
    const parent = templateMap.get(row.parentId)!;
    const perAmount = Number(parent.amount);
    return {
      recurrenceType: parent.recurrenceType,
      occurrences: parent.occurrences,
      occurrenceCount: parent.occurrences,
      perOccurrenceAmount: perAmount,
      totalPlannedCost: totalPlannedCost(perAmount, parent.recurrenceType, parent.occurrences),
      recurrenceLabel: recurrenceLabel(parent.recurrenceType),
      isMaterializedOccurrence: true,
      templateId: row.parentId,
    };
  }

  const amount = Number(row.amount);
  return {
    recurrenceType: row.recurrenceType,
    occurrences: row.occurrences,
    occurrenceCount: row.occurrences,
    perOccurrenceAmount: amount,
    totalPlannedCost: totalPlannedCost(amount, row.recurrenceType, row.occurrences),
    recurrenceLabel: recurrenceLabel(row.recurrenceType),
    isMaterializedOccurrence: false,
    templateId: null as number | null,
  };
}
