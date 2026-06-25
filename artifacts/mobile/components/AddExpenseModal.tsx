import { Feather } from "@expo/vector-icons";
import {
  useCreateExpense,
  useGetCategories,
  useUpdateExpense,
  getGetExpensesQueryKey,
  getGetDashboardQueryKey,
  type Expense,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
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
  }, [editing, visible]);

  const createMutation = useCreateExpense({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetExpensesQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        onClose();
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message ?? "Could not save expense.";
        Alert.alert("Error", msg);
      },
    },
  });

  const updateMutation = useUpdateExpense({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetExpensesQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        onClose();
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message ?? "Could not update expense.";
        Alert.alert("Error", msg);
      },
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSave = () => {
    const amt = parseFloat(amount);
    if (!selectedCat) return Alert.alert("Required", "Select a category.");
    if (!amt || amt <= 0) return Alert.alert("Required", "Enter a valid amount (must be > 0).");
    if (!date || !isValidDisplayDate(date)) return Alert.alert("Required", "Enter a valid date (DD-MM-YYYY).");
    const occ = parseInt(occurrences, 10);
    if (isNaN(occ) || occ < 1) return Alert.alert("Required", "Number of occurrences must be at least 1.");

    const storedDate = toStorageDate(date);
    const payload = {
      categoryId: selectedCat,
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
          {/* Amount */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Amount (₹)</Text>
            <View style={inputStyle}>
              <Feather name="trending-down" size={16} color={colors.expense} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>
          </View>

          {/* Category */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {categories.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setSelectedCat(c.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selectedCat === c.id ? colors.expense + "25" : colors.card,
                      borderColor: selectedCat === c.id ? colors.expense : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: selectedCat === c.id ? colors.expense : colors.text }]}>
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Date */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Date</Text>
            <View style={inputStyle}>
              <Feather name="calendar" size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="DD-MM-YYYY"
                placeholderTextColor={colors.textSecondary}
                value={date}
                onChangeText={setDate}
              />
            </View>
          </View>

          {/* Recurrence */}
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

          {/* Occurrences (only if not one-time) */}
          {recurrenceType !== "one-time" && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Number of Occurrences
              </Text>
              <View style={inputStyle}>
                <Feather name="repeat" size={16} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="e.g. 12"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={occurrences}
                  onChangeText={setOccurrences}
                />
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular" }}>
                  × {recurrenceType}
                </Text>
              </View>
            </View>
          )}

          {/* Notes */}
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
