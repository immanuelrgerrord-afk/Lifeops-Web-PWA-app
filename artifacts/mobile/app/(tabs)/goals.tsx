import { Feather } from "@expo/vector-icons";
import { useDeleteGoal, useGetGoals, type Goal } from "@workspace/api-client-react";
import { invalidateFinancialData } from "@/utils/queryInvalidation";
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
import { AddGoalModal } from "@/components/AddGoalModal";
import { GoalCard } from "@/components/GoalCard";
import { useColors } from "@/hooks/useColors";

export default function GoalsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: goals = [], isLoading, refetch } = useGetGoals();

  const deleteMutation = useDeleteGoal({
    mutation: {
      onSuccess: () => invalidateFinancialData(qc),
    },
  });

  const handleDelete = (id: number) => {
    Alert.alert("Delete Goal", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate({ id }) },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const avgProgress = goals.length > 0
    ? goals.reduce((s, g) => s + g.progressPercentage, 0) / goals.length
    : 0;

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
        <Text style={[styles.title, { color: colors.text }]}>Goals</Text>
        {goals.length > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.goal + "20" }]}>
            <Text style={[styles.badgeText, { color: colors.goal }]}>
              {avgProgress.toFixed(0)}% avg
            </Text>
          </View>
        )}
      </View>

      <FlatList
        data={goals}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        scrollEnabled={!!goals.length}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <GoalCard
            name={item.name}
            targetAmount={item.targetAmount}
            currentAmount={item.currentAmount}
            targetDate={item.targetDate}
            progressPercentage={item.progressPercentage}
            onEdit={() => { setEditing(item); setModalVisible(true); }}
            onDelete={() => handleDelete(item.id)}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Feather name="flag" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No goals yet</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Set financial goals and track your progress
              </Text>
            </View>
          ) : null
        }
      />

      <Pressable
        onPress={() => { setEditing(null); setModalVisible(true); }}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.goal, bottom: insets.bottom + 90 },
          pressed && { transform: [{ scale: 0.95 }] },
        ]}
      >
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>

      <AddGoalModal
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
  list: { padding: 16 },
  empty: { alignItems: "center", paddingVertical: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
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
