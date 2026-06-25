import { Feather } from "@expo/vector-icons";
import { useGetDashboard } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { StatCard } from "@/components/StatCard";
import { TransactionItem } from "@/components/TransactionItem";
import { toDisplayDate } from "@/utils/date";
import { formatINR } from "@/utils/numeric";
import { CategoryBadge } from "@/components/CategoryChip";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
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

function fmtShort(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function recurrenceLabel(type: string) {
  const map: Record<string, string> = {
    monthly: "Monthly",
    quarterly: "Quarterly",
    "half-yearly": "Half-Yearly",
    yearly: "Yearly",
  };
  return map[type] ?? type;
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useGetDashboard({ month });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const canGoNext = month < currentMonth();

  const recentTransactions = [
    ...(data?.monthlyIncomes ?? []).map((i) => ({ ...i, type: "income" as const })),
    ...(data?.monthlyExpenses ?? []).map((e) => ({ ...e, type: "expense" as const })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  const upcomingIncome = data?.upcomingRecurringIncome ?? [];
  const upcomingExpenses = data?.upcomingRecurringExpenses ?? [];
  const topSpending = data?.topSpendingCategories ?? [];
  const topIncome = data?.topIncomeCategories ?? [];
  const emiDue = data?.emiDueThisMonth ?? 0;

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
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>{greeting()}</Text>
          <Text style={[styles.userName, { color: colors.text }]}>
            {user?.fullName.split(" ")[0] ?? "User"}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/profile")}
          style={({ pressed }) => [
            styles.avatar,
            { backgroundColor: colors.primary + "30" },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {(user?.fullName ?? "?")[0].toUpperCase()}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Month selector */}
        <View style={styles.monthSelector}>
          <Pressable
            onPress={() => setMonth(prevMonth(month))}
            style={({ pressed }) => [styles.monthBtn, { backgroundColor: colors.card }, pressed && { opacity: 0.6 }]}
          >
            <Feather name="chevron-left" size={18} color={colors.text} />
          </Pressable>
          <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel(month)}</Text>
          <Pressable
            onPress={() => canGoNext && setMonth(nextMonth(month))}
            style={({ pressed }) => [
              styles.monthBtn,
              { backgroundColor: colors.card, opacity: canGoNext ? 1 : 0.3 },
              pressed && canGoNext && { opacity: 0.6 },
            ]}
          >
            <Feather name="chevron-right" size={18} color={colors.text} />
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Row 1: Income + Expenses */}
            <View style={styles.statsGrid}>
              <StatCard
                label="Income"
                value={fmtShort(data?.totalIncome ?? 0)}
                icon="trending-up"
                accentColor={colors.income}
              />
              <StatCard
                label="Expenses"
                value={fmtShort(data?.totalExpenses ?? 0)}
                icon="trending-down"
                accentColor={colors.expense}
              />
            </View>

            {/* Row 2: EMI Due + Net Savings */}
            <View style={styles.statsGrid}>
              <StatCard
                label="EMI This Month"
                value={fmtShort(emiDue)}
                icon="calendar"
                accentColor={colors.loan}
                subtitle={emiDue > 0 ? `${data?.activeLoans ?? 0} loan${(data?.activeLoans ?? 0) !== 1 ? "s" : ""}` : "No active loans"}
              />
              <StatCard
                label="Net Savings"
                value={fmtShort(data?.savings ?? 0)}
                icon="save"
                accentColor={colors.primary}
                subtitle={(data?.savings ?? 0) < 0 ? "Overspent" : "After EMI"}
              />
            </View>

            {/* Row 3: Total Outstanding */}
            <StatCard
              label="Total Outstanding"
              value={fmtShort(data?.totalOutstanding ?? 0)}
              icon="credit-card"
              accentColor={colors.loan}
              subtitle={`${data?.activeLoans ?? 0} active loan${(data?.activeLoans ?? 0) !== 1 ? "s" : ""}`}
            />

            {/* Goals */}
            {(data?.goalsCount ?? 0) > 0 && (
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Goals</Text>
                  <Text style={[styles.sectionBadge, { color: colors.goal }]}>
                    {(data?.avgGoalProgress ?? 0).toFixed(0)}% avg
                  </Text>
                </View>
                <View style={[styles.goalProgress, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.goalFill,
                      {
                        width: `${Math.min(100, data?.avgGoalProgress ?? 0)}%` as `${number}%`,
                        backgroundColor: colors.goal,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.goalSubtext, { color: colors.textSecondary }]}>
                  {data?.goalsCount} goal{(data?.goalsCount ?? 0) !== 1 ? "s" : ""} active
                </Text>
              </View>
            )}

            {(topSpending.length > 0 || topIncome.length > 0) && (
              <View style={styles.recentSection}>
                <Text style={[styles.recentTitle, { color: colors.text }]}>Monthly Breakdown</Text>
                {topSpending.length > 0 && (
                  <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Spending Categories</Text>
                    {topSpending.map((cat) => (
                      <View key={`spend-${cat.categoryId}`} style={styles.categoryRow}>
                        <CategoryBadge
                          name={cat.categoryName}
                          icon={cat.categoryIcon}
                          color={cat.categoryColor}
                          fallbackAccent={colors.expense}
                          size={32}
                        />
                        <Text style={[styles.categoryName, { color: colors.text }]}>{cat.categoryName}</Text>
                        <Text style={[styles.categoryAmount, { color: colors.expense }]}>
                          {formatINR(cat.total)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                {topIncome.length > 0 && (
                  <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 10 }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Income Categories</Text>
                    {topIncome.map((cat) => (
                      <View key={`income-${cat.categoryId}`} style={styles.categoryRow}>
                        <CategoryBadge
                          name={cat.categoryName}
                          icon={cat.categoryIcon}
                          color={cat.categoryColor}
                          fallbackAccent={colors.income}
                          size={32}
                        />
                        <Text style={[styles.categoryName, { color: colors.text }]}>{cat.categoryName}</Text>
                        <Text style={[styles.categoryAmount, { color: colors.income }]}>
                          {formatINR(cat.total)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {(upcomingIncome.length > 0 || upcomingExpenses.length > 0) && (
              <View style={styles.recentSection}>
                <Text style={[styles.recentTitle, { color: colors.text }]}>Upcoming (next 30 days)</Text>
                {upcomingIncome.length > 0 && (
                  <>
                    <Text style={[styles.subSectionTitle, { color: colors.income }]}>Upcoming Income</Text>
                    {upcomingIncome.map((item) => (
                      <View
                        key={`inc-${item.id}-${item.nextDate}`}
                        style={[
                          styles.recurringItem,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            borderLeftColor: colors.income,
                          },
                        ]}
                      >
                        <View style={styles.recurringLeft}>
                          <Feather name="trending-up" size={14} color={colors.income} />
                          <View>
                            <Text style={[styles.recurringName, { color: colors.text }]}>{item.categoryName}</Text>
                            <Text style={[styles.recurringMeta, { color: colors.textSecondary }]}>
                              {recurrenceLabel(item.recurrenceType)} · {toDisplayDate(item.nextDate)}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.recurringAmount, { color: colors.income }]}>
                          +{fmtShort(item.amount)}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
                {upcomingExpenses.length > 0 && (
                  <>
                    <Text style={[styles.subSectionTitle, { color: colors.expense, marginTop: upcomingIncome.length ? 12 : 0 }]}>
                      Upcoming Expenses
                    </Text>
                    {upcomingExpenses.map((item) => (
                      <View
                        key={`exp-${item.id}-${item.nextDate}`}
                        style={[
                          styles.recurringItem,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            borderLeftColor: colors.expense,
                          },
                        ]}
                      >
                        <View style={styles.recurringLeft}>
                          <Feather name="trending-down" size={14} color={colors.expense} />
                          <View>
                            <Text style={[styles.recurringName, { color: colors.text }]}>{item.categoryName}</Text>
                            <Text style={[styles.recurringMeta, { color: colors.textSecondary }]}>
                              {recurrenceLabel(item.recurrenceType)} · {toDisplayDate(item.nextDate)}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.recurringAmount, { color: colors.expense }]}>
                          -{fmtShort(item.amount)}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}

            {/* Recent Activity */}
            {recentTransactions.length > 0 && (
              <View style={styles.recentSection}>
                <Text style={[styles.recentTitle, { color: colors.text }]}>Recent Activity</Text>
                {recentTransactions.map((t) => (
                  <TransactionItem
                    key={`${t.type}-${t.id}`}
                    categoryName={t.categoryName ?? ""}
                    categoryIcon={(t as { categoryIcon?: string }).categoryIcon}
                    categoryColor={(t as { categoryColor?: string }).categoryColor}
                    amount={t.amount}
                    perOccurrenceAmount={(t as { perOccurrenceAmount?: number }).perOccurrenceAmount}
                    date={t.date}
                    notes={t.notes}
                    type={t.type}
                    recurrenceType={t.recurrenceType}
                    recurrenceLabel={(t as { recurrenceLabel?: string }).recurrenceLabel}
                    occurrences={t.occurrences}
                    totalPlannedCost={(t as { totalPlannedCost?: number }).totalPlannedCost}
                  />
                ))}
              </View>
            )}

            {recentTransactions.length === 0 && !isLoading && (
              <View style={styles.emptyState}>
                <Feather name="bar-chart-2" size={40} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No data yet</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Add income or expenses to see your financial summary.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular" },
  userName: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 2 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  scroll: { padding: 20, gap: 12 },
  monthSelector: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 4 },
  monthBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  monthLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold", minWidth: 160, textAlign: "center" },
  statsGrid: { flexDirection: "row", gap: 12 },
  emiCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  emiCardLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  emiIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  emiLabel: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.5 },
  emiAmount: { fontSize: 20, fontFamily: "Inter_700Bold", marginTop: 2 },
  section: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 10 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sectionBadge: { fontSize: 13, fontFamily: "Inter_700Bold" },
  goalProgress: { height: 8, borderRadius: 8, overflow: "hidden" },
  goalFill: { height: "100%", borderRadius: 8 },
  goalSubtext: { fontSize: 12, fontFamily: "Inter_400Regular" },
  recentSection: { marginTop: 4 },
  recentTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 12 },
  recurringItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: 12,
    marginBottom: 8,
  },
  recurringLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  recurringName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  recurringMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  recurringAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  subSectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 },
  categoryRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  categoryName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  categoryAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
