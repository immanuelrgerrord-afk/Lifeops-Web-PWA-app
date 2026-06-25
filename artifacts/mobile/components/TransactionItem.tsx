import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { CategoryBadge } from "@/components/CategoryChip";
import { toDisplayDate } from "@/utils/date";
import { formatINR } from "@/utils/numeric";
import { formatRecurrenceLine } from "@/utils/recurrenceDisplay";

interface TransactionItemProps {
  categoryName: string;
  categoryIcon?: string | null;
  categoryColor?: string | null;
  amount: number;
  perOccurrenceAmount?: number;
  date: string;
  notes?: string | null;
  type: "income" | "expense";
  recurrenceType?: string;
  recurrenceLabel?: string;
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  occurrences?: number;
  totalPlannedCost?: number;
  onEdit?: () => void;
  onDelete?: () => void;
}

function displayLabel(categoryName: string, notes?: string | null): string {
  if (categoryName === "Other" && notes?.trim()) return notes.trim();
  return categoryName;
}

export function TransactionItem({
  categoryName,
  categoryIcon,
  categoryColor,
  amount,
  perOccurrenceAmount,
  date,
  notes,
  type,
  recurrenceType,
  recurrenceLabel,
  recurrenceStartDate,
  recurrenceEndDate,
  occurrences,
  totalPlannedCost,
  onEdit,
  onDelete,
}: TransactionItemProps) {
  const colors = useColors();
  const isIncome = type === "income";
  const accentColor = isIncome ? colors.income : colors.expense;
  const label = displayLabel(categoryName, notes);
  const isRecurring = recurrenceType && recurrenceType !== "one-time";
  const unitAmount = perOccurrenceAmount ?? amount;

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <CategoryBadge
        name={label}
        icon={categoryIcon}
        color={categoryColor}
        fallbackAccent={accentColor}
      />
      <View style={styles.info}>
        <Text style={[styles.category, { color: colors.text }]}>{label}</Text>
        {label !== categoryName && (
          <Text style={[styles.catTag, { color: colors.textSecondary }]}>{categoryName}</Text>
        )}
        {notes && label === categoryName ? (
          <Text style={[styles.notes, { color: colors.textSecondary }]}>{notes}</Text>
        ) : null}
        {isRecurring ? (
          <Text style={[styles.recurrence, { color: colors.textSecondary }]}>
            {formatRecurrenceLine(
              unitAmount,
              recurrenceLabel ?? recurrenceType ?? "",
              occurrences ?? 1,
              recurrenceStartDate,
              recurrenceEndDate,
            )}
          </Text>
        ) : (
          <Text style={[styles.date, { color: colors.textSecondary }]}>{toDisplayDate(date)}</Text>
        )}
        {isRecurring ? (
          <Text style={[styles.date, { color: colors.textSecondary }]}>{toDisplayDate(date)}</Text>
        ) : null}
        {isRecurring && totalPlannedCost != null ? (
          <Text style={[styles.planned, { color: colors.textSecondary }]}>
            Total Planned {formatINR(totalPlannedCost)}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: accentColor }]}>
          {isIncome ? "+" : "-"}{formatINR(amount)}
        </Text>
        <View style={styles.actions}>
          {onEdit && (
            <Pressable onPress={onEdit} hitSlop={8} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
              <Feather name="edit-2" size={14} color={colors.textSecondary} />
            </Pressable>
          )}
          {onDelete && (
            <Pressable onPress={onDelete} hitSlop={8} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
              <Feather name="trash-2" size={14} color={colors.expense} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 10,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  category: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  catTag: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  notes: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  date: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  recurrence: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  planned: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  right: {
    alignItems: "flex-end",
    gap: 6,
  },
  amount: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    padding: 2,
  },
});
