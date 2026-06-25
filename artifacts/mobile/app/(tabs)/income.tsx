import { Feather } from "@expo/vector-icons";
import {
  useDeleteIncome,
  useGetIncomes,
  getGetIncomesQueryKey,
  getGetDashboardQueryKey,
  type Income,
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
import { AddIncomeModal } from "@/components/AddIncomeModal";
import { TransactionItem } from "@/components/TransactionItem";
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

export default function IncomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: incomes = [], isLoading, refetch } = useGetIncomes({ month });

  const deleteMutation = useDeleteIncome({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetIncomesQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      },
    },
  });

  const total = incomes.reduce((s, i) => s + i.amount, 0);

  const handleDelete = (id: number) => {
    Alert.alert("Delete Income", "Are you sure?", [
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
        <Text style={[styles.title, { color: colors.text }]}>Income</Text>
        <View style={[styles.totalPill, { backgroundColor: colors.income + "20" }]}>
          <Text style={[styles.totalText, { color: colors.income }]}>
            +₹{total.toLocaleString("en-IN")}
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
        data={incomes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        scrollEnabled={!!incomes.length}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const ext = item as Income & { recurrenceLabel?: string; totalPlannedCost?: number };
          return (
          <TransactionItem
            categoryName={item.categoryName ?? ""}
            categoryIcon={item.categoryIcon}
            categoryColor={item.categoryColor}
            amount={item.amount}
            perOccurrenceAmount={(item as Income & { perOccurrenceAmount?: number }).perOccurrenceAmount}
            date={item.date}
            notes={item.notes}
            type="income"
            recurrenceType={item.recurrenceType}
            recurrenceLabel={ext.recurrenceLabel}
            occurrences={item.occurrences}
            totalPlannedCost={ext.totalPlannedCost}
            onEdit={() => { setEditing(item); setModalVisible(true); }}
            onDelete={() => handleDelete(item.id)}
          />
        );}}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Feather name="trending-up" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No income yet</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Tap + to record your first income</Text>
            </View>
          ) : null
        }
      />

      <Pressable
        onPress={() => { setEditing(null); setModalVisible(true); }}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.income, bottom: insets.bottom + 90 },
          pressed && { transform: [{ scale: 0.95 }] },
        ]}
      >
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>

      <AddIncomeModal
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
