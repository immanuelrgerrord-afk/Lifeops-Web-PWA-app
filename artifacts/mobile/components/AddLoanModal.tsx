import { Feather } from "@expo/vector-icons";
import {
  useCreateLoan,
  useUpdateLoan,
  getGetLoansQueryKey,
  getGetDashboardQueryKey,
  type Loan,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { todayDisplay, toStorageDate, isValidDisplayDate, storageToDisplay } from "@/utils/date";

const LOAN_TYPES = [
  "Personal Loan",
  "Home Loan",
  "Car Loan",
  "Education Loan",
  "Business Loan",
  "Gold Loan",
  "Other",
];

function maxTenure(loanType: string): number {
  const lt = loanType.toLowerCase();
  if (lt.includes("personal")) return 5;
  if (lt.includes("car")) return 7;
  if (lt.includes("home")) return 30;
  return 30;
}

function minTenure(loanType: string): number {
  return 1;
}

function tenureHint(loanType: string): string {
  const lt = loanType.toLowerCase();
  if (lt.includes("personal")) return "1–5 years";
  if (lt.includes("car")) return "1–7 years";
  if (lt.includes("home")) return "1–30 years";
  return "1–30 years";
}

function calcEMI(principal: number, annualRate: number, tenureYears: number): number {
  const n = tenureYears * 12;
  if (annualRate === 0) return Math.round((principal / n) * 100) / 100;
  const r = annualRate / 100 / 12;
  const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(emi * 100) / 100;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  editing?: Loan | null;
}

export function AddLoanModal({ visible, onClose, editing }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [loanType, setLoanType] = useState("Personal Loan");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [tenure, setTenure] = useState("5");
  const [startDate, setStartDate] = useState(todayDisplay());
  const [emiOverride, setEmiOverride] = useState("");

  // Auto-computed EMI
  const autoEmi = useMemo(() => {
    const P = parseFloat(principal);
    const R = parseFloat(rate);
    const T = parseInt(tenure, 10);
    if (P > 0 && R >= 0 && T >= 1) return calcEMI(P, R, T);
    return null;
  }, [principal, rate, tenure]);

  const displayEmi = emiOverride || (autoEmi !== null ? String(Math.round(autoEmi)) : "");

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setLoanType(editing.loanType);
      setPrincipal(String(editing.principalAmount));
      setRate(String(editing.interestRate));
      setTenure(String(editing.tenureYears ?? 5));
      setStartDate(storageToDisplay(editing.startDate));
      setEmiOverride("");
    } else {
      setName("");
      setLoanType("Personal Loan");
      setPrincipal("");
      setRate("");
      setTenure("5");
      setStartDate(todayDisplay());
      setEmiOverride("");
    }
  }, [editing, visible]);

  // Reset tenure within limits when loan type changes
  useEffect(() => {
    const t = parseInt(tenure, 10);
    const max = maxTenure(loanType);
    if (t > max) setTenure(String(max));
  }, [loanType]);

  const createMutation = useCreateLoan({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetLoansQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        onClose();
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message ?? "Could not save loan.";
        Alert.alert("Error", msg);
      },
    },
  });

  const updateMutation = useUpdateLoan({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetLoansQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        onClose();
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message ?? "Could not update loan.";
        Alert.alert("Error", msg);
      },
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSave = () => {
    if (!name.trim()) return Alert.alert("Required", "Enter a loan name.");
    const P = parseFloat(principal);
    if (!P || P <= 0) return Alert.alert("Required", "Enter a valid loan amount.");
    const R = parseFloat(rate);
    if (isNaN(R) || R < 0) return Alert.alert("Required", "Enter a valid interest rate (≥ 0).");
    const T = parseInt(tenure, 10);
    if (!T || T < 1) return Alert.alert("Required", "Enter a valid tenure (at least 1 year).");
    const max = maxTenure(loanType);
    const min = minTenure(loanType);
    if (T > max) return Alert.alert("Invalid Tenure", `${loanType} allows a maximum of ${max} years.`);
    if (T < min) return Alert.alert("Invalid Tenure", `${loanType} requires a minimum of ${min} year.`);
    if (!startDate || !isValidDisplayDate(startDate)) {
      return Alert.alert("Required", "Enter a valid start date (DD-MM-YYYY).");
    }

    const storedDate = toStorageDate(startDate);
    const emiVal = emiOverride ? parseFloat(emiOverride) : (autoEmi ?? undefined);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      loanType,
      principalAmount: P,
      interestRate: R,
      tenureYears: T,
      startDate: storedDate,
    };
    if (emiVal && emiVal > 0) payload.emi = emiVal;

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload as any });
    } else {
      createMutation.mutate({ data: payload as any });
    }
  };

  const inputStyle = [styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={[styles.cancel, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{editing ? "Edit Loan" : "Add Loan"}</Text>
          <Pressable onPress={handleSave} disabled={isPending} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            {isPending ? (
              <ActivityIndicator color={colors.loan} size="small" />
            ) : (
              <Text style={[styles.save, { color: colors.loan }]}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Loan Name */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Loan Name</Text>
            <View style={inputStyle}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="e.g. HDFC Home Loan"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

          {/* Loan Type */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Loan Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {LOAN_TYPES.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setLoanType(t)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: loanType === t ? colors.loan + "25" : colors.card,
                      borderColor: loanType === t ? colors.loan : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: loanType === t ? colors.loan : colors.text }]}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Principal Amount */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Loan Amount (₹)</Text>
            <View style={inputStyle}>
              <Text style={{ color: colors.textSecondary, fontFamily: "Inter_500Medium" }}>₹</Text>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="e.g. 2000000"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={principal}
                onChangeText={setPrincipal}
              />
            </View>
          </View>

          {/* Interest Rate */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Interest Rate (% p.a.)</Text>
            <View style={inputStyle}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="e.g. 8.5"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={rate}
                onChangeText={setRate}
              />
              <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular" }}>%</Text>
            </View>
          </View>

          {/* Tenure */}
          <View style={styles.field}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Tenure (Years)</Text>
              <Text style={[styles.hint, { color: colors.loan }]}>{tenureHint(loanType)}</Text>
            </View>
            <View style={inputStyle}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={`e.g. ${maxTenure(loanType)}`}
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={tenure}
                onChangeText={setTenure}
              />
              <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular" }}>yrs</Text>
            </View>
          </View>

          {/* Start Date */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Start Date</Text>
            <View style={inputStyle}>
              <Feather name="calendar" size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="DD-MM-YYYY"
                placeholderTextColor={colors.textSecondary}
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>
          </View>

          {/* EMI (auto-calculated, can override) */}
          <View style={styles.field}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Monthly EMI (₹)</Text>
              {autoEmi !== null && !emiOverride && (
                <Text style={[styles.hint, { color: colors.primary }]}>Auto-calculated</Text>
              )}
              {emiOverride ? (
                <Pressable onPress={() => setEmiOverride("")}>
                  <Text style={[styles.hint, { color: colors.loan }]}>Reset to auto</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={[inputStyle, emiOverride ? { borderColor: colors.loan } : {}]}>
              <Text style={{ color: colors.textSecondary, fontFamily: "Inter_500Medium" }}>₹</Text>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={autoEmi !== null ? String(Math.round(autoEmi)) : "Auto-calculated"}
                placeholderTextColor={autoEmi !== null ? colors.primary : colors.textSecondary}
                keyboardType="numeric"
                value={displayEmi}
                onChangeText={(v) => {
                  // If user types, treat as override
                  if (v !== String(autoEmi !== null ? Math.round(autoEmi) : "")) {
                    setEmiOverride(v);
                  }
                }}
              />
            </View>
          </View>

          {/* Loan summary preview */}
          {autoEmi !== null && (
            <View style={[styles.summaryBox, { backgroundColor: colors.loan + "12", borderColor: colors.loan + "30" }]}>
              <Text style={[styles.summaryTitle, { color: colors.loan }]}>Loan Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>Monthly EMI</Text>
                <Text style={[styles.summaryVal, { color: colors.text }]}>
                  ₹{(emiOverride ? parseFloat(emiOverride) : autoEmi).toLocaleString("en-IN")}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>Total Months</Text>
                <Text style={[styles.summaryVal, { color: colors.text }]}>{parseInt(tenure, 10) * 12} months</Text>
              </View>
              {parseFloat(principal) > 0 && parseInt(tenure, 10) >= 1 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>Total Interest</Text>
                  <Text style={[styles.summaryVal, { color: colors.expense }]}>
                    ₹{Math.round(autoEmi * parseInt(tenure, 10) * 12 - parseFloat(principal)).toLocaleString("en-IN")}
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  cancel: { fontSize: 16, fontFamily: "Inter_400Regular" },
  title: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  save: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  form: { padding: 20, gap: 16 },
  field: { gap: 8 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  hint: { fontSize: 12, fontFamily: "Inter_500Medium" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },
  input: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular" },
  chipRow: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  summaryBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  summaryTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryKey: { fontSize: 13, fontFamily: "Inter_400Regular" },
  summaryVal: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
