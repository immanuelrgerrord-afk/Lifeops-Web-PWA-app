import { Feather } from "@expo/vector-icons";
import {
  useDeleteExpense,
  useGetExpenses,
  getGetExpensesQueryKey,
  getGetDashboardQueryKey,
  type Expense,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddExpenseModal } from "@/components/AddExpenseModal";
import { ExpenseCard } from "@/components/ExpenseCard";
import type { ComponentProps } from "react";

type ExpenseCardProps = ComponentProps<typeof ExpenseCard>;
import { useColors } from "@/hooks/useColors";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ExpensesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: expenses = [], isLoading, refetch } = useGetExpenses({ month });

  const deleteMutation = useDeleteExpense({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetExpensesQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      },
    },
  });

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const handleDelete = (id: number) => {
    Alert.alert("Delete Expense", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate({ id }) },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const canGoNext = month < currentMonth();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 30 : 12),
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>Expenses</Text>
        <View style={[styles.totalPill, { backgroundColor: colors.expense + "20" }]}>
          <Text style={[styles.totalText, { color: colors.expense }]}>
            -₹{total.toLocaleString("en-IN")}
          </Text>
        </View>
      </View>

      <View style={styles.monthRow}>
        <Pressable onPress={() => setMonth(prevMonth(month))} style={[styles.monthBtn, { backgroundColor: colors.card }]}>
          <Feather name="chevron-left" size={18} color={colors.text} />
        </Pressable>
        <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel(month)}</Text>
        <Pressable
          onPress={() => canGoNext && setMonth(nextMonth(month))}
          style={[styles.monthBtn, { backgroundColor: colors.card, opacity: canGoNext ? 1 : 0.3 }]}
        >
          <Feather name="chevron-right" size={18} color={colors.text} />
        </Pressable>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        scrollEnabled={!!expenses.length}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const ext = item as Expense & {
            emiDetails?: ExpenseCardProps["emiDetails"];
            recurrenceLabel?: string;
            totalPlannedCost?: number;
          };
          return (
          <ExpenseCard
            id={item.id}
            categoryName={item.categoryName ?? ""}
            amount={item.amount}
            date={item.date}
            notes={item.notes}
            recurrenceType={item.recurrenceType ?? "one-time"}
            occurrences={item.occurrences ?? 1}
            recurrenceLabel={ext.recurrenceLabel}
            totalPlannedCost={ext.totalPlannedCost}
            emiDetails={ext.emiDetails}
            onEdit={() => { setEditing(item); setModalVisible(true); }}
            onDelete={() => handleDelete(item.id)}
          />
        );}}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Feather name="trending-down" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No expenses yet</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Tap + to record your first expense</Text>
            </View>
          ) : null
        }
      />

      <Pressable
        onPress={() => { setEditing(null); setModalVisible(true); }}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.expense, bottom: insets.bottom + 90 },
          pressed && { transform: [{ scale: 0.95 }] },
        ]}
      >
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>

      <AddExpenseModal
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setEditing(null); }}
        editing={editing}
      />
    </View>
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
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  totalPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  totalText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, paddingVertical: 12 },
  monthBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  monthLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", minWidth: 130, textAlign: "center" },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  empty: { alignItems: "center", paddingVertical: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
