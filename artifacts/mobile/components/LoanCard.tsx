import { Feather } from "@expo/vector-icons";
import type { Loan } from "@workspace/api-client-react";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { toDisplayDate } from "@/utils/date";

interface LoanCardProps {
  loan: Loan;
  onEdit?: () => void;
  onDelete?: () => void;
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

function fmtShort(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

// Calculates months saved and interest saved for a one-time prepayment
function calcPrepay(
  outstanding: number,
  annualRate: number,
  emi: number,
  monthsRemaining: number
) {
  const r = annualRate / 100 / 12;
  if (outstanding <= 0 || emi <= 0) return { monthsSaved: 0, interestSaved: 0, newMonths: monthsRemaining };

  const interestOriginal = emi * monthsRemaining - outstanding;

  // New outstanding after prepayment is already computed by caller
  const newOutstanding = outstanding; // placeholder – caller passes reduced outstanding
  if (r === 0) {
    const newMonths = Math.ceil(newOutstanding / emi);
    const interestNew = emi * newMonths - newOutstanding;
    return {
      monthsSaved: Math.max(0, monthsRemaining - newMonths),
      interestSaved: Math.max(0, interestOriginal - interestNew),
      newMonths,
    };
  }
  const newMonths = Math.ceil(-Math.log(1 - (newOutstanding * r) / emi) / Math.log(1 + r));
  const interestNew = emi * newMonths - newOutstanding;
  return {
    monthsSaved: Math.max(0, monthsRemaining - newMonths),
    interestSaved: Math.max(0, interestOriginal - interestNew),
    newMonths,
  };
}

export function LoanCard({ loan, onEdit, onDelete }: LoanCardProps) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const [lumpSum, setLumpSum] = useState("");
  const [extraMonthly, setExtraMonthly] = useState("");
  const isHomeLoan = loan.loanType.toLowerCase().includes("home");

  const {
    name,
    loanType,
    principalAmount,
    interestRate,
    emi,
    tenureYears,
    outstandingBalance,
    principalPaid,
    interestPaid,
    totalInterest,
    monthsCompleted,
    monthsRemaining,
    totalMonths,
    startDate,
    endDate,
  } = loan;

  const paidPct = principalAmount > 0 ? Math.min(100, (principalPaid / principalAmount) * 100) : 0;

  // Prepayment simulation
  const lumpAmt = parseFloat(lumpSum) || 0;
  const extraAmt = parseFloat(extraMonthly) || 0;

  let lumpResult = { monthsSaved: 0, interestSaved: 0, newMonths: monthsRemaining };
  if (lumpAmt > 0 && outstandingBalance > 0 && emi > 0) {
    const r = interestRate / 100 / 12;
    const reducedBal = Math.max(0, outstandingBalance - lumpAmt);
    if (r === 0) {
      const nm = Math.ceil(reducedBal / emi);
      lumpResult = {
        newMonths: nm,
        monthsSaved: Math.max(0, monthsRemaining - nm),
        interestSaved: Math.max(0, emi * monthsRemaining - outstandingBalance - (emi * nm - reducedBal)),
      };
    } else {
      const nm = reducedBal > 0 ? Math.ceil(-Math.log(1 - (reducedBal * r) / emi) / Math.log(1 + r)) : 0;
      lumpResult = {
        newMonths: nm,
        monthsSaved: Math.max(0, monthsRemaining - nm),
        interestSaved: Math.max(0, emi * monthsRemaining - outstandingBalance - (emi * nm - reducedBal)),
      };
    }
  }

  let extraResult = { monthsSaved: 0, interestSaved: 0, newMonths: monthsRemaining };
  if (extraAmt > 0 && outstandingBalance > 0) {
    const r = interestRate / 100 / 12;
    const newEmi = emi + extraAmt;
    if (r === 0) {
      const nm = Math.ceil(outstandingBalance / newEmi);
      extraResult = {
        newMonths: nm,
        monthsSaved: Math.max(0, monthsRemaining - nm),
        interestSaved: Math.max(0, emi * monthsRemaining - outstandingBalance - (newEmi * nm - outstandingBalance)),
      };
    } else {
      const nm = Math.ceil(-Math.log(1 - (outstandingBalance * r) / newEmi) / Math.log(1 + r));
      extraResult = {
        newMonths: nm,
        monthsSaved: Math.max(0, monthsRemaining - nm),
        interestSaved: Math.max(0, emi * monthsRemaining - outstandingBalance - (newEmi * nm - outstandingBalance)),
      };
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable onPress={() => setExpanded(!expanded)} style={styles.headerRow}>
        <View style={[styles.typeChip, { backgroundColor: colors.loan + "20" }]}>
          <Feather name="credit-card" size={14} color={colors.loan} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
          <Text style={[styles.type, { color: colors.textSecondary }]}>{loanType} · {tenureYears} yr{tenureYears !== 1 ? "s" : ""}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.outstanding, { color: colors.loan }]}>{fmtShort(outstandingBalance)}</Text>
          <Text style={[styles.emiLabel, { color: colors.textSecondary }]}>EMI {fmtShort(emi)}/mo</Text>
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
      </Pressable>

      {/* Progress bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { width: `${paidPct}%` as `${number}%`, backgroundColor: colors.loan }]} />
      </View>
      <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
        {paidPct.toFixed(1)}% paid · {monthsCompleted}/{totalMonths} months
      </Text>

      {expanded && (
        <View style={styles.details}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Key figures grid */}
          <View style={styles.grid}>
            <GridItem label="Principal" value={fmtShort(principalAmount)} colors={colors} />
            <GridItem label="Rate" value={`${interestRate}% p.a.`} colors={colors} />
            <GridItem label="Outstanding" value={fmtShort(outstandingBalance)} colors={colors} accent={colors.loan} />
            <GridItem label="Principal Paid" value={fmtShort(principalPaid)} colors={colors} accent={colors.income} />
            <GridItem label="Interest Paid" value={fmtShort(interestPaid)} colors={colors} accent={colors.expense} />
            <GridItem label="Interest Left" value={fmtShort(Math.max(0, emi * monthsRemaining - outstandingBalance))} colors={colors} />
            <GridItem label="Total Interest" value={fmtShort(totalInterest)} colors={colors} />
            <GridItem label="Months Left" value={`${monthsRemaining} mo`} colors={colors} />
            <GridItem label="Start Date" value={toDisplayDate(startDate)} colors={colors} />
            <GridItem label="End Date" value={toDisplayDate(endDate)} colors={colors} />
          </View>

          {/* Prepayment Simulator – available for all loan types */}
          <View style={[styles.prepaySection, { backgroundColor: colors.surface ?? colors.background, borderRadius: 12 }]}>
            <Text style={[styles.prepayTitle, { color: colors.text }]}>Prepayment Simulator</Text>

            <Text style={[styles.prepaySubtitle, { color: colors.textSecondary }]}>One-Time Lump Sum</Text>
            <View style={[styles.prepayInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ color: colors.textSecondary, fontFamily: "Inter_500Medium" }}>₹</Text>
              <TextInput
                style={[styles.prepayField, { color: colors.text }]}
                placeholder="e.g. 200000"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={lumpSum}
                onChangeText={setLumpSum}
              />
            </View>
            {lumpAmt > 0 && (
              <View style={styles.prepayResults}>
                <PrepayRow icon="clock" color={colors.primary} label={`Save ${lumpResult.monthsSaved} months (${(lumpResult.monthsSaved / 12).toFixed(1)} yrs)`} colors={colors} />
                <PrepayRow icon="trending-down" color={colors.income} label={`Interest saved: ${fmt(lumpResult.interestSaved)}`} colors={colors} />
              </View>
            )}

            <Text style={[styles.prepaySubtitle, { color: colors.textSecondary, marginTop: 8 }]}>Extra Monthly Payment</Text>
            <View style={[styles.prepayInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ color: colors.textSecondary, fontFamily: "Inter_500Medium" }}>₹</Text>
              <TextInput
                style={[styles.prepayField, { color: colors.text }]}
                placeholder="e.g. 5000"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={extraMonthly}
                onChangeText={setExtraMonthly}
              />
              <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 12 }}>/mo extra</Text>
            </View>
            {extraAmt > 0 && (
              <View style={styles.prepayResults}>
                <PrepayRow icon="clock" color={colors.primary} label={`Save ${extraResult.monthsSaved} months (${(extraResult.monthsSaved / 12).toFixed(1)} yrs)`} colors={colors} />
                <PrepayRow icon="trending-down" color={colors.income} label={`Interest saved: ${fmt(extraResult.interestSaved)}`} colors={colors} />
                <PrepayRow icon="check-circle" color={colors.goal} label={`New EMI: ${fmt(emi + extraAmt)}/mo`} colors={colors} />
              </View>
            )}
          </View>

          <View style={styles.actions}>
            {onEdit && (
              <Pressable onPress={onEdit} style={[styles.actionBtn, { backgroundColor: colors.primary + "15" }]}>
                <Feather name="edit-2" size={14} color={colors.primary} />
                <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
              </Pressable>
            )}
            {onDelete && (
              <Pressable onPress={onDelete} style={[styles.actionBtn, { backgroundColor: colors.expense + "15" }]}>
                <Feather name="trash-2" size={14} color={colors.expense} />
                <Text style={[styles.actionText, { color: colors.expense }]}>Delete</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function GridItem({ label, value, colors, accent }: { label: string; value: string; colors: any; accent?: string }) {
  return (
    <View style={styles.gridItem}>
      <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.gridValue, { color: accent ?? colors.text }]}>{value}</Text>
    </View>
  );
}

function PrepayRow({ icon, color, label, colors }: { icon: string; color: string; label: string; colors: any }) {
  return (
    <View style={styles.prepayRow}>
      <Feather name={icon as any} size={14} color={color} />
      <Text style={[styles.prepayResult, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  typeChip: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  titleBlock: { flex: 1 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  type: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerRight: { alignItems: "flex-end", gap: 2 },
  outstanding: { fontSize: 15, fontFamily: "Inter_700Bold" },
  emiLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  progressBar: { height: 4, borderRadius: 4, overflow: "hidden", marginBottom: 6 },
  progressFill: { height: "100%", borderRadius: 4 },
  progressLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  details: { marginTop: 12, gap: 12 },
  divider: { height: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridItem: { width: "30%", gap: 2 },
  gridLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  gridValue: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  prepaySection: { padding: 14, gap: 8 },
  prepayTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  prepaySubtitle: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.3 },
  prepayInput: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 44,
  },
  prepayField: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  prepayResults: { gap: 6 },
  prepayRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  prepayResult: { fontSize: 13, fontFamily: "Inter_500Medium" },
  actions: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  actionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
