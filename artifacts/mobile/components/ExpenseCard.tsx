import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { CategoryBadge } from "@/components/CategoryChip";
import { toDisplayDate } from "@/utils/date";
import { formatINR } from "@/utils/numeric";
import { formatRecurrenceLine } from "@/utils/recurrenceDisplay";

interface EmiDetails {
  matched: boolean;
  loanName?: string;
  emiAmount: number;
  unmatchedMessage?: string;
  emiStartDate?: string;
  emiDurationMonths?: number;
  monthsCompleted?: number;
  monthsRemaining?: number;
  totalPaid?: number;
  remainingAmount?: number;
  nextEmiDate?: string | null;
  completionPercentage?: number;
}

interface ExpenseCardProps {
  id: number;
  categoryName: string;
  categoryIcon?: string | null;
  categoryColor?: string | null;
  amount: number;
  perOccurrenceAmount?: number;
  date: string;
  notes?: string | null;
  recurrenceType: string;
  occurrences: number;
  recurrenceLabel?: string;
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  totalPlannedCost?: number;
  emiDetails?: EmiDetails;
  onEdit?: () => void;
  onDelete?: () => void;
}

function recurrenceLabel(type: string): string {
  const map: Record<string, string> = {
    "one-time": "One Time",
    monthly: "Monthly",
    quarterly: "Quarterly",
    "half-yearly": "Half Yearly",
    yearly: "Yearly",
  };
  return map[type] ?? type;
}

export function ExpenseCard({
  categoryName,
  categoryIcon,
  categoryColor,
  amount,
  perOccurrenceAmount,
  date,
  notes,
  recurrenceType,
  occurrences,
  recurrenceLabel: recurrenceLabelProp,
  recurrenceStartDate,
  recurrenceEndDate,
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
  const unitAmount = perOccurrenceAmount ?? amount;
  const planned = totalPlannedCost ?? (isRecurring ? unitAmount * occurrences : amount);
  const recLabel = recurrenceLabelProp ?? recurrenceLabel(recurrenceType);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.mainRow}>
        <CategoryBadge
          name={displayName}
          icon={categoryIcon}
          color={categoryColor}
          fallbackAccent={colors.expense}
        />

        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]}>{displayName}</Text>

          {displayName !== categoryName && (
            <Text style={[styles.catLabel, { color: colors.textSecondary }]}>{categoryName}</Text>
          )}

          {isRecurring ? (
            <Text style={[styles.recurrence, { color: colors.textSecondary }]}>
              {formatRecurrenceLine(unitAmount, recLabel, occurrences, recurrenceStartDate, recurrenceEndDate)}
            </Text>
          ) : (
            <Text style={[styles.recurrence, { color: colors.textSecondary }]}>
              {toDisplayDate(date)} · One Time
            </Text>
          )}
        </View>

        <View style={styles.rightCol}>
          <Text style={[styles.amount, { color: colors.expense }]}>-{formatINR(amount)}</Text>
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
          <Text style={[styles.plannedValue, { color: colors.text }]}>{formatINR(planned)}</Text>
        </View>
      )}

      {isEMI && (
        <View style={[styles.emiBox, { backgroundColor: colors.expense + "08", borderColor: colors.expense + "25" }]}>
          <View style={styles.emiHeader}>
            <Text style={[styles.emiTitle, { color: colors.text }]}>EMI Details</Text>
            <Text style={[styles.emiAmount, { color: colors.expense }]}>
              {formatINR(emiDetails?.emiAmount ?? amount)}
            </Text>
          </View>

          {emiDetails?.loanName ? (
            <Text style={[styles.loanName, { color: colors.textSecondary }]}>{emiDetails.loanName}</Text>
          ) : null}

          {!emiDetails?.matched ? (
            <Text style={[styles.unmatched, { color: colors.textSecondary }]}>
              {emiDetails?.unmatchedMessage ?? "Linked loan not found."}
            </Text>
          ) : (
            <>
              <View style={styles.emiGrid}>
                <View style={styles.emiCell}>
                  <Text style={[styles.emiKey, { color: colors.textSecondary }]}>Start Date</Text>
                  <Text style={[styles.emiVal, { color: colors.text }]}>
                    {toDisplayDate(emiDetails.emiStartDate ?? "")}
                  </Text>
                </View>
                <View style={styles.emiCell}>
                  <Text style={[styles.emiKey, { color: colors.textSecondary }]}>Duration</Text>
                  <Text style={[styles.emiVal, { color: colors.text }]}>
                    {emiDetails.emiDurationMonths} months
                  </Text>
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
                  <Text style={[styles.emiKey, { color: colors.textSecondary }]}>Total Paid</Text>
                  <Text style={[styles.emiVal, { color: colors.income }]}>
                    {formatINR(emiDetails.totalPaid ?? 0)}
                  </Text>
                </View>
                <View style={styles.emiCell}>
                  <Text style={[styles.emiKey, { color: colors.textSecondary }]}>Remaining Amt</Text>
                  <Text style={[styles.emiVal, { color: colors.expense }]}>
                    {formatINR(emiDetails.remainingAmount ?? 0)}
                  </Text>
                </View>
              </View>
              <View style={[styles.progressRow, { borderTopColor: colors.expense + "20" }]}>
                <Text style={[styles.emiKey, { color: colors.textSecondary }]}>Completion</Text>
                <Text style={[styles.emiVal, { color: colors.text }]}>
                  {emiDetails.completionPercentage}%
                </Text>
              </View>
              {emiDetails.nextEmiDate ? (
                <View style={[styles.nextEMIRow, { borderTopColor: colors.expense + "20" }]}>
                  <Text style={[styles.nextEMIText, { color: colors.expense }]}>
                    Next EMI: {toDisplayDate(emiDetails.nextEmiDate)}
                  </Text>
                </View>
              ) : null}
            </>
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
    gap: 8,
  },
  emiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  emiTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  emiAmount: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  loanName: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  unmatched: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  emiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
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
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  nextEMIRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  nextEMIText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
