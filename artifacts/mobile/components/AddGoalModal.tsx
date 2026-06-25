import { Feather } from "@expo/vector-icons";
import {
  useCreateGoal,
  useUpdateGoal,
  getGetGoalsQueryKey,
  getGetDashboardQueryKey,
  type Goal,
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

interface Props {
  visible: boolean;
  onClose: () => void;
  editing?: Goal | null;
}

export function AddGoalModal({ visible, onClose, editing }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0");
  const [targetDate, setTargetDate] = useState("");

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setTargetAmount(String(editing.targetAmount));
      setCurrentAmount(String(editing.currentAmount));
      setTargetDate(editing.targetDate);
    } else {
      setName("");
      setTargetAmount("");
      setCurrentAmount("0");
      const sixMonths = new Date();
      sixMonths.setMonth(sixMonths.getMonth() + 6);
      setTargetDate(sixMonths.toISOString().split("T")[0]);
    }
  }, [editing, visible]);

  const createMutation = useCreateGoal({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetGoalsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        onClose();
      },
      onError: () => Alert.alert("Error", "Could not save goal."),
    },
  });

  const updateMutation = useUpdateGoal({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetGoalsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        onClose();
      },
      onError: () => Alert.alert("Error", "Could not update goal."),
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSave = () => {
    if (!name.trim()) return Alert.alert("Required", "Enter a goal name.");
    const T = parseFloat(targetAmount);
    const C = parseFloat(currentAmount) || 0;
    if (!T || T <= 0) return Alert.alert("Required", "Enter a valid target amount.");
    if (!targetDate) return Alert.alert("Required", "Enter a target date.");

    const payload = { name: name.trim(), targetAmount: T, currentAmount: C, targetDate };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  };

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
            <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="flag" size={16} color={colors.goal} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="e.g. Emergency Fund, New Car"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Target Amount (₹)</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="target" size={16} color={colors.goal} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="e.g. 500000"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={targetAmount}
                onChangeText={setTargetAmount}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Current Amount (₹)</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="dollar-sign" size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={currentAmount}
                onChangeText={setCurrentAmount}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Target Date</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="calendar" size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                value={targetDate}
                onChangeText={setTargetDate}
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
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 50 },
  input: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular" },
});
