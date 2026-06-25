import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface EmiDetails {
  emiStartDate: string;
  emiDurationMonths: number;
  monthsCompleted: number;
  monthsRemaining: number;
  totalPaid: number;
  remainingAmount: number;
  nextEmiDate: string | null;
  completionPercentage: number;
}

interface ExpenseCardProps {
  id: number;
  categoryName: string;
  amount: number;
  date: string;
  notes?: string | null;
  recurrenceType: string;
  occurrences: number;
  recurrenceLabel?: string;
  totalPlannedCost?: number;
  emiDetails?: EmiDetails;
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
  } catch {
    return d;
  }
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

export function ExpenseCard({
  categoryName,
  amount,
  date,
  notes,
  recurrenceType,
  occurrences,
  recurrenceLabel: recurrenceLabelProp,
  totalPlannedCost,
  emiDetails,
  onEdit,
  onDelete,
}: ExpenseCardProps) {
  const colors = useColors();

  const displayName =
    categoryName === "Other" && notes?.trim() ? notes.trim() : categoryName;

  const isEMI = categoryName === "EMI";
  const isRecurring = recurrenceType !== "one-time";
  const planned = totalPlannedCost ?? (isRecurring ? amount * occurrences : amount);
  const recLabel = recurrenceLabelProp ?? recurrenceLabel(recurrenceType);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.mainRow}>
        <View style={[styles.iconBox, { backgroundColor: colors.expense + "20" }]}>
          <Feather name="trending-down" size={16} color={colors.expense} />
        </View>

        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]}>{displayName}</Text>

          {displayName !== categoryName && (
            <Text style={[styles.catLabel, { color: colors.textSecondary }]}>{categoryName}</Text>
          )}

          {isRecurring ? (
            <Text style={[styles.recurrence, { color: colors.textSecondary }]}>
              {recLabel} × {occurrences}
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

      {isRecurring && (
        <View style={[styles.plannedRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.plannedLabel, { color: colors.textSecondary }]}>Total Planned</Text>
          <Text style={[styles.plannedValue, { color: colors.text }]}>{fmtINR(planned)}</Text>
        </View>
      )}

      {isEMI && emiDetails && (
        <View style={[styles.emiBox, { backgroundColor: colors.expense + "08", borderColor: colors.expense + "25" }]}>
          <View style={styles.emiGrid}>
            <View style={styles.emiCell}>
              <Text style={[styles.emiKey, { color: colors.textSecondary }]}>Started</Text>
              <Text style={[styles.emiVal, { color: colors.text }]}>{fmtDate(emiDetails.emiStartDate)}</Text>
            </View>
            <View style={styles.emiCell}>
              <Text style={[styles.emiKey, { color: colors.textSecondary }]}>Duration</Text>
              <Text style={[styles.emiVal, { color: colors.text }]}>{emiDetails.emiDurationMonths} months</Text>
            </View>
            <View style={styles.emiCell}>
              <Text style={[styles.emiKey, { color: colors.textSecondary }]}>Completed</Text>
              <Text style={[styles.emiVal, { color: colors.income }]}>{emiDetails.monthsCompleted}</Text>
            </View>
            <View style={styles.emiCell}>
              <Text style={[styles.emiKey, { color: colors.textSecondary }]}>Remaining</Text>
              <Text style={[styles.emiVal, { color: colors.expense }]}>{emiDetails.monthsRemaining}</Text>
            </View>
            <View style={styles.emiCell}>
              <Text style={[styles.emiKey, { color: colors.textSecondary }]}>Paid</Text>
              <Text style={[styles.emiVal, { color: colors.income }]}>{fmtINR(emiDetails.totalPaid)}</Text>
            </View>
            <View style={styles.emiCell}>
              <Text style={[styles.emiKey, { color: colors.textSecondary }]}>Left</Text>
              <Text style={[styles.emiVal, { color: colors.expense }]}>{fmtINR(emiDetails.remainingAmount)}</Text>
            </View>
          </View>
          <View style={[styles.progressRow, { borderTopColor: colors.expense + "20" }]}>
            <Text style={[styles.emiKey, { color: colors.textSecondary }]}>Completion</Text>
            <Text style={[styles.emiVal, { color: colors.text }]}>{emiDetails.completionPercentage}%</Text>
          </View>
          {emiDetails.nextEmiDate && (
            <View style={[styles.nextEMIRow, { borderTopColor: colors.expense + "20" }]}>
              <Feather name="calendar" size={12} color={colors.expense} />
              <Text style={[styles.nextEMIText, { color: colors.expense }]}>
                Next EMI: {fmtDate(emiDetails.nextEmiDate)}
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
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
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
