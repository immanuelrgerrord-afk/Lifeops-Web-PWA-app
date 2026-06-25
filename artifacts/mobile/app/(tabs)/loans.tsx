import { Feather } from "@expo/vector-icons";
import {
  useDeleteLoan,
  useGetLoans,
  getGetLoansQueryKey,
  getGetDashboardQueryKey,
  type Loan,
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
import { AddLoanModal } from "@/components/AddLoanModal";
import { LoanCard } from "@/components/LoanCard";
import { useColors } from "@/hooks/useColors";

export default function LoansScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: loans = [], isLoading, refetch } = useGetLoans();

  const deleteMutation = useDeleteLoan({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetLoansQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      },
    },
  });

  const activeLoans = loans.filter((l) => (l.monthsRemaining ?? 0) > 0);
  const totalOutstanding = activeLoans.reduce((s, l) => s + l.outstandingBalance, 0);
  const totalEmi = activeLoans.reduce((s, l) => s + l.emi, 0);

  const handleDelete = (id: number) => {
    Alert.alert("Delete Loan", "This will remove this loan permanently.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate({ id }) },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

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
        <Text style={[styles.title, { color: colors.text }]}>Loans</Text>
        {activeLoans.length > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.loan + "20" }]}>
            <Text style={[styles.badgeText, { color: colors.loan }]}>{activeLoans.length} active</Text>
          </View>
        )}
      </View>

      {loans.length > 0 && (
        <View style={[styles.summary, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Outstanding</Text>
            <Text style={[styles.summaryValue, { color: colors.loan }]}>
              ₹{totalOutstanding.toLocaleString("en-IN")}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Monthly EMI</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              ₹{totalEmi.toLocaleString("en-IN")}
            </Text>
          </View>
        </View>
      )}

      <FlatList
        data={loans}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        scrollEnabled={!!loans.length}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <LoanCard
            loan={item}
            onEdit={() => { setEditing(item); setModalVisible(true); }}
            onDelete={() => handleDelete(item.id)}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Feather name="credit-card" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No loans yet</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Track your EMIs and outstanding balances</Text>
            </View>
          ) : null
        }
      />

      <Pressable
        onPress={() => { setEditing(null); setModalVisible(true); }}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.loan, bottom: insets.bottom + 90 },
          pressed && { transform: [{ scale: 0.95 }] },
        ]}
      >
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>

      <AddLoanModal
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
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16 },
  badgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  summary: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    gap: 20,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 4 },
  summaryLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  summaryValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  divider: { width: 1 },
  list: { padding: 16 },
  empty: { alignItems: "center", paddingVertical: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
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
