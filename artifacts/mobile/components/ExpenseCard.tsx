import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface ExpenseCardProps {
  id: number;
  categoryName: string;
  amount: number;
  date: string;
  notes?: string | null;
  recurrenceType: string;
  occurrences: number;
  onEdit?: () => void;
  onDelete?: () => void;
}

function fmtINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function fmtDate(d: string) {
  try {
    const parts = d.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return d;
  } catch { return d; }
}

function recurrenceLabel(type: string): string {
  const map: Record<string, string> = {
    "one-time": "One Time",
    monthly: "Monthly",
    quarterly: "Quarterly",
    "half-yearly": "Half-Yearly",
    yearly: "Yearly",
  };
  return map[type] ?? type;
}

function totalPlanned(amount: number, recurrenceType: string, occurrences: number): number {
  if (recurrenceType === "one-time") return amount;
  return amount * occurrences;
}

function monthsElapsed(startDateStr: string): number {
  const start = new Date(startDateStr + "T00:00:00");
  const today = new Date();
  return Math.max(0,
    (today.getFullYear() - start.getFullYear()) * 12 +
    (today.getMonth() - start.getMonth())
  );
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

export function ExpenseCard({
  categoryName,
  amount,
  date,
  notes,
  recurrenceType,
  occurrences,
  onEdit,
  onDelete,
}: ExpenseCardProps) {
  const colors = useColors();

  // Smart category display: if "Other" and notes exist, use notes as label
  const displayName =
    categoryName === "Other" && notes?.trim()
      ? notes.trim()
      : categoryName;

  const isEMI = categoryName === "EMI";
  const isRecurring = recurrenceType !== "one-time";
  const planned = totalPlanned(amount, recurrenceType, occurrences);

  // EMI calculations (only when category = EMI)
  const monthsCompleted = isEMI ? Math.min(monthsElapsed(date), occurrences) : 0;
  const monthsRemaining = isEMI ? Math.max(0, occurrences - monthsCompleted) : 0;
  const totalPaid = isEMI ? amount * monthsCompleted : 0;
  const remainingAmt = isEMI ? amount * monthsRemaining : 0;
  const nextEMIDate = isEMI && monthsRemaining > 0 ? addMonths(date, monthsCompleted + 1) : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Main row */}
      <View style={styles.mainRow}>
        <View style={[styles.iconBox, { backgroundColor: colors.expense + "20" }]}>
          <Feather name="trending-down" size={16} color={colors.expense} />
        </View>

        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]}>{displayName}</Text>

          {/* Show original category if smart-display changed it */}
          {displayName !== categoryName && (
            <Text style={[styles.catLabel, { color: colors.textSecondary }]}>{categoryName}</Text>
          )}

          {/* Recurrence line */}
          {isRecurring ? (
            <Text style={[styles.recurrence, { color: colors.textSecondary }]}>
              {recurrenceLabel(recurrenceType)} × {occurrences}
            </Text>
          ) : (
            <Text style={[styles.recurrence, { color: colors.textSecondary }]}>
              {fmtDate(date)} · One Time
            </Text>
          )}
        </View>

        <View style={styles.rightCol}>
          <Text style={[styles.amount, { color: colors.expense }]}>-{fmtINR(amount)}</Text>
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

      {/* Recurring total planned */}
      {isRecurring && (
        <View style={[styles.plannedRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.plannedLabel, { color: colors.textSecondary }]}>Total Planned</Text>
          <Text style={[styles.plannedValue, { color: colors.text }]}>{fmtINR(planned)}</Text>
        </View>
      )}

      {/* EMI details (only when category = EMI) */}
      {isEMI && (
        <View style={[styles.emiBox, { backgroundColor: colors.expense + "08", borderColor: colors.expense + "25" }]}>
          <View style={styles.emiGrid}>
            <View style={styles.emiCell}>
              <Text style={[styles.emiKey, { color: colors.textSecondary }]}>Started</Text>
              <Text style={[styles.emiVal, { color: colors.text }]}>{fmtDate(date)}</Text>
            </View>
            <View style={styles.emiCell}>
              <Text style={[styles.emiKey, { color: colors.textSecondary }]}>Duration</Text>
              <Text style={[styles.emiVal, { color: colors.text }]}>{occurrences} months</Text>
            </View>
            <View style={styles.emiCell}>
              <Text style={[styles.emiKey, { color: colors.textSecondary }]}>Completed</Text>
              <Text style={[styles.emiVal, { color: colors.income }]}>{monthsCompleted}</Text>
            </View>
            <View style={styles.emiCell}>
              <Text style={[styles.emiKey, { color: colors.textSecondary }]}>Remaining</Text>
              <Text style={[styles.emiVal, { color: colors.expense }]}>{monthsRemaining}</Text>
            </View>
            <View style={styles.emiCell}>
              <Text style={[styles.emiKey, { color: colors.textSecondary }]}>Paid</Text>
              <Text style={[styles.emiVal, { color: colors.income }]}>{fmtINR(totalPaid)}</Text>
            </View>
            <View style={styles.emiCell}>
              <Text style={[styles.emiKey, { color: colors.textSecondary }]}>Left</Text>
              <Text style={[styles.emiVal, { color: colors.expense }]}>{fmtINR(remainingAmt)}</Text>
            </View>
          </View>
          {nextEMIDate && (
            <View style={[styles.nextEMIRow, { borderTopColor: colors.expense + "20" }]}>
              <Feather name="calendar" size={12} color={colors.expense} />
              <Text style={[styles.nextEMIText, { color: colors.expense }]}>
                Next EMI: {fmtDate(nextEMIDate)}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: "hidden",
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  iconBox: {
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
  name: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  catLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  recurrence: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  rightCol: {
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
  actionBtn: { padding: 2 },
  plannedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  plannedLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  plannedValue: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  emiBox: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  emiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
  },
  emiCell: {
    width: "33.33%",
    paddingVertical: 5,
  },
  emiKey: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  emiVal: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  nextEMIRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  nextEMIText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
