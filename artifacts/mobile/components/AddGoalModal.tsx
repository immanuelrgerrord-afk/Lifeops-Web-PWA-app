import { Feather } from "@expo/vector-icons";
import {
  useCreateGoal,
  useUpdateGoal,
  type Goal,
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
import { AmountInput } from "@/components/NumericInput";
import { toDisplayDate, toStorageDate, storageToDisplay } from "@/utils/date";
import { parseAmount, round2, sanitizeAmountInput } from "@/utils/numeric";
import {
  validateAmount,
  validateDisplayDate,
  validateGoalAmounts,
  validateRequired,
} from "@/utils/validation";

interface Props {
  visible: boolean;
  onClose: () => void;
  editing?: Goal | null;
}

function defaultTargetDateDisplay(): string {
  const sixMonths = new Date();
  sixMonths.setMonth(sixMonths.getMonth() + 6);
  return toDisplayDate(sixMonths.toISOString().split("T")[0]);
}

export function AddGoalModal({ visible, onClose, editing }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0");
  const [targetDate, setTargetDate] = useState(defaultTargetDateDisplay());
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setTargetAmount(String(editing.targetAmount));
      setCurrentAmount(String(editing.currentAmount));
      setTargetDate(storageToDisplay(editing.targetDate));
    } else {
      setName("");
      setTargetAmount("");
      setCurrentAmount("0");
      setTargetDate(defaultTargetDateDisplay());
    }
    setTouched({});
    setSubmitAttempted(false);
  }, [editing, visible]);

  const errors = useMemo(
    () => ({
      name: validateRequired(name, "Goal name"),
      targetAmount: validateAmount(targetAmount, "Target amount"),
      currentAmount: validateGoalAmounts(targetAmount || "1", currentAmount),
      targetDate: validateDisplayDate(targetDate),
    }),
    [name, targetAmount, currentAmount, targetDate],
  );

  const show = (field: keyof typeof errors) =>
    (touched[field] || submitAttempted) ? errors[field] : null;

  const createMutation = useCreateGoal({
    mutation: {
      onSuccess: () => {
        invalidateFinancialData(qc);
        onClose();
      },
    },
  });

  const updateMutation = useUpdateGoal({
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

    const payload = {
      name: name.trim(),
      targetAmount: round2(parseAmount(targetAmount)!),
      currentAmount: round2(parseAmount(currentAmount) ?? 0),
      targetDate: toStorageDate(targetDate),
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
          <Text style={[styles.title, { color: colors.text }]}>{editing ? "Edit Goal" : "New Goal"}</Text>
          <Pressable onPress={handleSave} disabled={isPending} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            {isPending ? (
              <ActivityIndicator color={colors.goal} size="small" />
            ) : (
              <Text style={[styles.save, { color: colors.goal }]}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Goal Name</Text>
            <View style={[inputStyle, show("name") ? { borderColor: colors.expense } : null]}>
              <Feather name="flag" size={16} color={colors.goal} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="e.g. Emergency Fund, New Car"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              />
            </View>
            <FieldError message={show("name")} />
          </View>

          <AmountInput
            label="Target Amount (₹)"
            value={targetAmount}
            onChangeText={(v) => setTargetAmount(sanitizeAmountInput(v))}
            onBlur={() => setTouched((t) => ({ ...t, targetAmount: true }))}
            error={show("targetAmount")}
          />

          <AmountInput
            label="Current Amount (₹)"
            value={currentAmount}
            onChangeText={(v) => setCurrentAmount(sanitizeAmountInput(v))}
            onBlur={() => setTouched((t) => ({ ...t, currentAmount: true }))}
            error={show("currentAmount")}
          />

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Target Date</Text>
            <View style={[inputStyle, show("targetDate") ? { borderColor: colors.expense } : null]}>
              <Feather name="calendar" size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="DD-MM-YYYY"
                placeholderTextColor={colors.textSecondary}
                value={targetDate}
                onChangeText={setTargetDate}
                onBlur={() => setTouched((t) => ({ ...t, targetDate: true }))}
              />
            </View>
            <FieldError message={show("targetDate")} />
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
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 50 },
  input: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular" },
});
