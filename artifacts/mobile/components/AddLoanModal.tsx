import { Feather } from "@expo/vector-icons";
import {
  useCreateLoan,
  useUpdateLoan,
  type Loan,
} from "@workspace/api-client-react";
import { invalidateFinancialData } from "@/utils/queryInvalidation";
import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { FieldError } from "@/components/FieldError";
import { AmountInput, IntegerInput, RateInput } from "@/components/NumericInput";
import { todayDisplay, toStorageDate, storageToDisplay } from "@/utils/date";
import {
  parseAmount,
  parseInterestRate,
  round2,
  sanitizeAmountInput,
  sanitizeRateInput,
} from "@/utils/numeric";
import {
  validateAmount,
  validateDisplayDate,
  validateInterestRate,
  validateRequired,
  validateTenureYears,
} from "@/utils/validation";

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

function tenureHint(loanType: string): string {
  const lt = loanType.toLowerCase();
  if (lt.includes("personal")) return "1–5 years";
  if (lt.includes("car")) return "1–7 years";
  if (lt.includes("home")) return "1–30 years";
  return "1–30 years";
}

function calcEMI(principal: number, annualRate: number, tenureYears: number): number {
  const n = tenureYears * 12;
  if (annualRate === 0) return round2(principal / n);
  const r = annualRate / 100 / 12;
  const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return round2(emi);
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
  const [emiTouched, setEmiTouched] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const autoEmi = useMemo(() => {
    const P = parseAmount(principal);
    const R = parseInterestRate(rate);
    const T = parseInt(tenure, 10);
    if (P && P > 0 && R !== null && T >= 1) return calcEMI(P, R, T);
    return null;
  }, [principal, rate, tenure]);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setLoanType(editing.loanType);
      setPrincipal(String(editing.principalAmount));
      setRate(String(editing.interestRate));
      setTenure(String(editing.tenureYears ?? 5));
      setStartDate(storageToDisplay(editing.startDate));
      const storedEmi = editing.emi;
      const computed = calcEMI(
        editing.principalAmount,
        editing.interestRate,
        editing.tenureYears ?? 5,
      );
      setEmiOverride(
        storedEmi && Math.abs(storedEmi - computed) >= 0.01 ? String(storedEmi) : "",
      );
      setEmiTouched(false);
    } else {
      setName("");
      setLoanType("Personal Loan");
      setPrincipal("");
      setRate("");
      setTenure("5");
      setStartDate(todayDisplay());
      setEmiOverride("");
      setEmiTouched(false);
    }
    setTouched({});
    setSubmitAttempted(false);
  }, [editing, visible]);

  useEffect(() => {
    const t = parseInt(tenure, 10);
    const max = maxTenure(loanType);
    if (t > max) setTenure(String(max));
  }, [loanType, tenure]);

  const displayEmi =
    emiOverride || (autoEmi !== null ? String(autoEmi) : "");

  const errors = useMemo(
    () => ({
      name: validateRequired(name, "Loan name"),
      principal: validateAmount(principal, "Loan amount"),
      rate: validateInterestRate(rate),
      tenure: validateTenureYears(tenure, 1, maxTenure(loanType)),
      startDate: validateDisplayDate(startDate),
      emi:
        emiOverride && (parseAmount(emiOverride) === null || parseAmount(emiOverride)! <= 0)
          ? "Enter a valid EMI amount."
          : null,
    }),
    [name, principal, rate, tenure, loanType, startDate, emiOverride],
  );

  const show = (field: keyof typeof errors) =>
    (touched[field] || submitAttempted) ? errors[field] : null;

  const createMutation = useCreateLoan({
    mutation: {
      onSuccess: () => {
        invalidateFinancialData(qc);
        onClose();
      },
    },
  });

  const updateMutation = useUpdateLoan({
    mutation: {
      onSuccess: () => {
        invalidateFinancialData(qc);
        onClose();
      },
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const saveError =
    (createMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (updateMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message;

  const handleSave = () => {
    setSubmitAttempted(true);
    if (Object.values(errors).some(Boolean)) return;

    const P = round2(parseAmount(principal)!);
    const R = parseInterestRate(rate)!;
    const T = parseInt(tenure, 10);
    const emiVal = emiOverride ? round2(parseAmount(emiOverride)!) : (autoEmi ?? undefined);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      loanType,
      principalAmount: P,
      interestRate: R,
      tenureYears: T,
      startDate: toStorageDate(startDate),
    };
    if (emiVal && emiVal > 0) payload.emi = emiVal;

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload as never });
    } else {
      createMutation.mutate({ data: payload as never });
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
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Loan Name</Text>
            <View style={[inputStyle, show("name") ? { borderColor: colors.expense } : null]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="e.g. HDFC Home Loan"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              />
            </View>
            <FieldError message={show("name")} />
          </View>

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

          <AmountInput
            label="Loan Amount (₹)"
            value={principal}
            onChangeText={(v) => setPrincipal(sanitizeAmountInput(v))}
            onBlur={() => setTouched((t) => ({ ...t, principal: true }))}
            error={show("principal")}
            placeholder="e.g. 2500000"
          />

          <RateInput
            label="Interest Rate (% p.a.)"
            value={rate}
            onChangeText={(v) => setRate(sanitizeRateInput(v))}
            onBlur={() => setTouched((t) => ({ ...t, rate: true }))}
            error={show("rate")}
            placeholder="e.g. 8.35"
          />

          <IntegerInput
            label="Tenure (Years)"
            value={tenure}
            onChangeText={setTenure}
            onBlur={() => setTouched((t) => ({ ...t, tenure: true }))}
            error={show("tenure")}
            suffix="yrs"
            placeholder={`e.g. ${maxTenure(loanType)}`}
          />
          <Text style={[styles.hint, { color: colors.loan }]}>{tenureHint(loanType)}</Text>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Start Date</Text>
            <View style={[inputStyle, show("startDate") ? { borderColor: colors.expense } : null]}>
              <Feather name="calendar" size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="DD-MM-YYYY"
                placeholderTextColor={colors.textSecondary}
                value={startDate}
                onChangeText={setStartDate}
                onBlur={() => setTouched((t) => ({ ...t, startDate: true }))}
              />
            </View>
            <FieldError message={show("startDate")} />
          </View>

          <View style={styles.field}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Monthly EMI (₹)</Text>
              {autoEmi !== null && !emiOverride && (
                <Text style={[styles.hint, { color: colors.primary }]}>Auto-calculated</Text>
              )}
              {emiOverride ? (
                <Pressable onPress={() => { setEmiOverride(""); setEmiTouched(false); }}>
                  <Text style={[styles.hint, { color: colors.loan }]}>Reset to auto</Text>
                </Pressable>
              ) : null}
            </View>
            <AmountInput
              label=""
              value={displayEmi}
              onChangeText={(v) => {
                setEmiTouched(true);
                const cleaned = sanitizeAmountInput(v);
                if (!emiTouched && autoEmi !== null && cleaned === String(autoEmi)) {
                  setEmiOverride("");
                } else {
                  setEmiOverride(cleaned);
                }
              }}
              onBlur={() => setTouched((t) => ({ ...t, emi: true }))}
              error={show("emi")}
              placeholder={autoEmi !== null ? String(autoEmi) : "Auto-calculated"}
            />
          </View>

          {autoEmi !== null && (
            <View style={[styles.summaryBox, { backgroundColor: colors.loan + "12", borderColor: colors.loan + "30" }]}>
              <Text style={[styles.summaryTitle, { color: colors.loan }]}>Loan Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>Monthly EMI</Text>
                <Text style={[styles.summaryVal, { color: colors.text }]}>
                  ₹{(emiOverride ? parseAmount(emiOverride) : autoEmi)?.toLocaleString("en-IN")}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>Total Months</Text>
                <Text style={[styles.summaryVal, { color: colors.text }]}>
                  {parseInt(tenure, 10) * 12} months
                </Text>
              </View>
            </View>
          )}

          {saveError ? <FieldError message={saveError} /> : null}
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
  hint: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: -8 },
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
