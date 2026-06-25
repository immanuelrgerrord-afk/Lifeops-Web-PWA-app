import { Feather } from "@expo/vector-icons";
import {
  useCreateExpense,
  useGetCategories,
  useUpdateExpense,
  type Expense,
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
import { CategoryChip } from "@/components/CategoryChip";
import { FieldError } from "@/components/FieldError";
import { AmountInput, IntegerInput } from "@/components/NumericInput";
import { todayDisplay, toStorageDate, storageToDisplay } from "@/utils/date";
import { parseAmount, round2, sanitizeAmountInput } from "@/utils/numeric";
import {
  validateAmount,
  validateDisplayDate,
  validateOccurrences,
} from "@/utils/validation";

const RECURRENCE_OPTIONS = [
  { key: "one-time", label: "One Time" },
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
  { key: "half-yearly", label: "Half Yearly" },
  { key: "yearly", label: "Yearly" },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  editing?: Expense | null;
}

export function AddExpenseModal({ visible, onClose, editing }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data: categories = [] } = useGetCategories({ type: "expense" });

  const [amount, setAmount] = useState("");
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [date, setDate] = useState(todayDisplay());
  const [notes, setNotes] = useState("");
  const [recurrenceType, setRecurrenceType] = useState("one-time");
  const [occurrences, setOccurrences] = useState("1");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (editing) {
      setAmount(String(editing.amount));
      setSelectedCat(editing.categoryId);
      setDate(storageToDisplay(editing.date));
      setNotes(editing.notes ?? "");
      setRecurrenceType(editing.recurrenceType ?? "one-time");
      setOccurrences(String(editing.occurrences ?? 1));
    } else {
      setAmount("");
      setSelectedCat(null);
      setDate(todayDisplay());
      setNotes("");
      setRecurrenceType("one-time");
      setOccurrences("1");
    }
    setTouched({});
    setSubmitAttempted(false);
  }, [editing, visible]);

  const errors = useMemo(
    () => ({
      amount: validateAmount(amount),
      category: selectedCat ? null : "Select a category.",
      date: validateDisplayDate(date),
      occurrences:
        recurrenceType === "one-time" ? null : validateOccurrences(occurrences),
    }),
    [amount, selectedCat, date, occurrences, recurrenceType],
  );

  const show = (field: keyof typeof errors) =>
    (touched[field] || submitAttempted) ? errors[field] : null;

  const createMutation = useCreateExpense({
    mutation: {
      onSuccess: () => {
        invalidateFinancialData(qc);
        onClose();
      },
    },
  });

  const updateMutation = useUpdateExpense({
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

    const amt = round2(parseAmount(amount)!);
    const storedDate = toStorageDate(date);
    const occ = recurrenceType === "one-time" ? 1 : parseInt(occurrences, 10);
    const payload = {
      categoryId: selectedCat!,
      amount: amt,
      date: storedDate,
      notes: notes || undefined,
      recurrenceType,
      occurrences: occ,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate({ data: payload });
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
          <Text style={[styles.title, { color: colors.text }]}>{editing ? "Edit Expense" : "Add Expense"}</Text>
          <Pressable onPress={handleSave} disabled={isPending} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            {isPending ? (
              <ActivityIndicator color={colors.expense} size="small" />
            ) : (
              <Text style={[styles.save, { color: colors.expense }]}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          <AmountInput
            label="Amount (₹)"
            value={amount}
            onChangeText={(v) => setAmount(sanitizeAmountInput(v))}
            onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
            error={show("amount")}
          />

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {categories.map((c) => (
                <CategoryChip
                  key={c.id}
                  name={c.name}
                  icon={c.icon}
                  color={c.color}
                  selected={selectedCat === c.id}
                  accentColor={colors.expense}
                  onPress={() => {
                    setSelectedCat(c.id);
                    setTouched((t) => ({ ...t, category: true }));
                  }}
                />
              ))}
            </ScrollView>
            <FieldError message={show("category")} />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Date</Text>
            <View style={[inputStyle, show("date") ? { borderColor: colors.expense } : null]}>
              <Feather name="calendar" size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="DD-MM-YYYY"
                placeholderTextColor={colors.textSecondary}
                value={date}
                onChangeText={setDate}
                onBlur={() => setTouched((t) => ({ ...t, date: true }))}
              />
            </View>
            <FieldError message={show("date")} />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Recurrence</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {RECURRENCE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => setRecurrenceType(opt.key)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: recurrenceType === opt.key ? colors.expense + "25" : colors.card,
                      borderColor: recurrenceType === opt.key ? colors.expense : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: recurrenceType === opt.key ? colors.expense : colors.text }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {recurrenceType !== "one-time" && (
            <IntegerInput
              label="Number of Occurrences"
              value={occurrences}
              onChangeText={setOccurrences}
              onBlur={() => setTouched((t) => ({ ...t, occurrences: true }))}
              error={show("occurrences")}
              suffix={`× ${recurrenceType}`}
              placeholder="e.g. 12"
            />
          )}

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Notes (optional)</Text>
            <View style={[styles.textareaRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.textarea, { color: colors.text }]}
                placeholder="Add a note..."
                placeholderTextColor={colors.textSecondary}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

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
  form: { padding: 20, gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 50,
  },
  input: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular" },
  chipRow: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  textareaRow: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  textarea: { fontSize: 15, fontFamily: "Inter_400Regular", minHeight: 70 },
});
