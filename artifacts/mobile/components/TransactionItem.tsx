import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface TransactionItemProps {
  categoryName: string;
  amount: number;
  date: string;
  notes?: string | null;
  type: "income" | "expense";
  recurrenceType?: string;
  recurrenceLabel?: string;
  totalPlannedCost?: number;
  onEdit?: () => void;
  onDelete?: () => void;
}

function formatAmount(n: number) {
  return n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

function formatDate(d: string) {
  try {
    const parts = d.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return d;
  } catch {
    return d;
  }
}

/** Smart category display: if "Other" and notes exist, show notes as the label */
function displayLabel(categoryName: string, notes?: string | null): string {
  if (categoryName === "Other" && notes?.trim()) return notes.trim();
  return categoryName;
}

export function TransactionItem({
  categoryName,
  amount,
  date,
  notes,
  type,
  recurrenceType,
  recurrenceLabel,
  totalPlannedCost,
  onEdit,
  onDelete,
}: TransactionItemProps) {
  const colors = useColors();
  const isIncome = type === "income";
  const accentColor = isIncome ? colors.income : colors.expense;
  const label = displayLabel(categoryName, notes);

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.dot, { backgroundColor: accentColor + "25" }]}>
        <Feather
          name={isIncome ? "arrow-down-left" : "arrow-up-right"}
          size={16}
          color={accentColor}
        />
      </View>
      <View style={styles.info}>
        <Text style={[styles.category, { color: colors.text }]}>{label}</Text>
        {/* Show original category tag if smart-display changed the label */}
        {label !== categoryName && (
          <Text style={[styles.catTag, { color: colors.textSecondary }]}>{categoryName}</Text>
        )}
        {notes && label === categoryName ? (
          <Text style={[styles.notes, { color: colors.textSecondary }]}>{notes}</Text>
        ) : null}
        {recurrenceType && recurrenceType !== "one-time" ? (
          <Text style={[styles.recurrence, { color: colors.textSecondary }]}>
            {recurrenceLabel ?? recurrenceType} · Total {formatAmount(totalPlannedCost ?? amount)}
          </Text>
        ) : (
          <Text style={[styles.date, { color: colors.textSecondary }]}>{formatDate(date)}</Text>
        )}
        {recurrenceType && recurrenceType !== "one-time" ? (
          <Text style={[styles.date, { color: colors.textSecondary }]}>{formatDate(date)}</Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: accentColor }]}>
          {isIncome ? "+" : "-"}{formatAmount(amount)}
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
  dot: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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
