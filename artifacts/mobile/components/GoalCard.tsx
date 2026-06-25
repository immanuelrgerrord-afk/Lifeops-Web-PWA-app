import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface GoalCardProps {
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  progressPercentage: number;
  onEdit?: () => void;
  onDelete?: () => void;
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

function daysLeft(targetDate: string) {
  const target = new Date(targetDate + "T00:00:00");
  const today = new Date();
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Today";
  if (diff < 30) return `${diff}d left`;
  if (diff < 365) return `${Math.round(diff / 30)}mo left`;
  return `${(diff / 365).toFixed(1)}yr left`;
}

export function GoalCard({ name, targetAmount, currentAmount, targetDate, progressPercentage, onEdit, onDelete }: GoalCardProps) {
  const colors = useColors();
  const pct = Math.min(100, progressPercentage);
  const isComplete = pct >= 100;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: isComplete ? colors.income + "50" : colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: colors.goal + "20" }]}>
          <Feather name={isComplete ? "check-circle" : "flag"} size={16} color={isComplete ? colors.income : colors.goal} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
          <Text style={[styles.timeline, { color: colors.textSecondary }]}>{daysLeft(targetDate)}</Text>
        </View>
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

      <View style={styles.amounts}>
        <Text style={[styles.current, { color: colors.text }]}>{fmt(currentAmount)}</Text>
        <Text style={[styles.target, { color: colors.textSecondary }]}>of {fmt(targetAmount)}</Text>
      </View>

      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${pct}%` as `${number}%`, backgroundColor: isComplete ? colors.income : colors.goal },
          ]}
        />
      </View>
      <Text style={[styles.pctLabel, { color: isComplete ? colors.income : colors.goal }]}>
        {pct.toFixed(0)}%{isComplete ? " Complete" : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 12, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  titleBlock: { flex: 1 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  timeline: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  actions: { flexDirection: "row", gap: 14 },
  actionBtn: { padding: 2 },
  amounts: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  current: { fontSize: 20, fontFamily: "Inter_700Bold" },
  target: { fontSize: 13, fontFamily: "Inter_400Regular" },
  progressBar: { height: 6, borderRadius: 6, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 6 },
  pctLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
