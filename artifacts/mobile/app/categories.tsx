import { Feather } from "@expo/vector-icons";
import {
  useGetCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  type Category,
} from "@workspace/api-client-react";
import { invalidateFinancialData } from "@/utils/queryInvalidation";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

type CategoryType = "income" | "expense" | "loan" | "goal";

const TABS: { key: CategoryType; label: string; icon: string }[] = [
  { key: "income", label: "Income", icon: "trending-up" },
  { key: "expense", label: "Expense", icon: "trending-down" },
  { key: "loan", label: "Loan", icon: "credit-card" },
  { key: "goal", label: "Goal", icon: "target" },
];

const PRESET_COLORS = [
  "#10b981", "#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#6366f1",
  "#14b8a6", "#e11d48",
];

const PRESET_ICONS: Array<{ name: string; icon: keyof typeof Feather.glyphMap }> = [
  { name: "home", icon: "home" },
  { name: "shopping-bag", icon: "shopping-bag" },
  { name: "coffee", icon: "coffee" },
  { name: "car", icon: "truck" },
  { name: "heart", icon: "heart" },
  { name: "book", icon: "book" },
  { name: "music", icon: "music" },
  { name: "wifi", icon: "wifi" },
  { name: "phone", icon: "phone" },
  { name: "film", icon: "film" },
  { name: "gift", icon: "gift" },
  { name: "briefcase", icon: "briefcase" },
  { name: "activity", icon: "activity" },
  { name: "zap", icon: "zap" },
  { name: "star", icon: "star" },
  { name: "sun", icon: "sun" },
  { name: "umbrella", icon: "umbrella" },
  { name: "dollar-sign", icon: "dollar-sign" },
];

interface EditModalProps {
  visible: boolean;
  editing: Category | null;
  type: CategoryType;
  onClose: () => void;
  onSave: (name: string, icon: string | null, color: string | null) => void;
  saving: boolean;
}

function EditModal({ visible, editing, type, onClose, onSave, saving }: EditModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(editing?.name ?? "");
  const [selectedIcon, setSelectedIcon] = useState<string | null>(editing?.icon ?? null);
  const [selectedColor, setSelectedColor] = useState<string | null>(editing?.color ?? null);

  React.useEffect(() => {
    if (visible) {
      setName(editing?.name ?? "");
      setSelectedIcon(editing?.icon ?? null);
      setSelectedColor(editing?.color ?? null);
    }
  }, [visible, editing]);

  const handleSave = () => {
    if (!name.trim()) return Alert.alert("Required", "Category name cannot be empty.");
    onSave(name.trim(), selectedIcon, selectedColor);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[s.modalHeader, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose}>
            <Text style={[s.modalCancel, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
          <Text style={[s.modalTitle, { color: colors.text }]}>
            {editing ? "Edit Category" : `New ${type.charAt(0).toUpperCase() + type.slice(1)} Category`}
          </Text>
          <Pressable onPress={handleSave} disabled={saving}>
            <Text style={[s.modalSave, { color: colors.primary, opacity: saving ? 0.5 : 1 }]}>
              {saving ? "Saving…" : "Save"}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[s.modalForm, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
          {/* Name */}
          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Name</Text>
          <View style={[s.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="tag" size={16} color={colors.textSecondary} />
            <TextInput
              style={[s.textInput, { color: colors.text }]}
              placeholder="Category name"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </View>

          {/* Color picker */}
          <Text style={[s.fieldLabel, { color: colors.textSecondary, marginTop: 20 }]}>Color</Text>
          <View style={s.colorGrid}>
            {PRESET_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setSelectedColor(c)}
                style={[
                  s.colorSwatch,
                  { backgroundColor: c },
                  selectedColor === c && s.colorSwatchSelected,
                ]}
              >
                {selectedColor === c && <Feather name="check" size={14} color="#fff" />}
              </Pressable>
            ))}
          </View>

          {/* Icon picker */}
          <Text style={[s.fieldLabel, { color: colors.textSecondary, marginTop: 20 }]}>Icon</Text>
          <View style={s.iconGrid}>
            {PRESET_ICONS.map((item) => (
              <Pressable
                key={item.name}
                onPress={() => setSelectedIcon(item.icon)}
                style={[
                  s.iconCell,
                  {
                    backgroundColor: selectedIcon === item.icon
                      ? (selectedColor ?? colors.primary) + "25"
                      : colors.card,
                    borderColor: selectedIcon === item.icon
                      ? (selectedColor ?? colors.primary)
                      : colors.border,
                  },
                ]}
              >
                <Feather
                  name={item.icon as any}
                  size={20}
                  color={selectedIcon === item.icon ? (selectedColor ?? colors.primary) : colors.textSecondary}
                />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function CategoriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<CategoryType>("income");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  const { data: cats = [], refetch } = useGetCategories({
    // OpenAPI query enum is income|expense; server also accepts loan|goal filters
    type: activeTab as "income" | "expense",
  });

  const invalidate = () => {
    invalidateFinancialData(qc);
    refetch();
  };

  const createMutation = useCreateCategory({
    mutation: {
      onSuccess: () => { invalidate(); setModalVisible(false); },
      onError: (err: any) => Alert.alert("Error", err?.response?.data?.message ?? "Could not create category."),
    },
  });

  const updateMutation = useUpdateCategory({
    mutation: {
      onSuccess: () => { invalidate(); setModalVisible(false); },
      onError: (err: any) => Alert.alert("Error", err?.response?.data?.message ?? "Could not update category."),
    },
  });

  const deleteMutation = useDeleteCategory({
    mutation: {
      onSuccess: () => invalidate(),
      onError: (err: any) => Alert.alert("Error", err?.response?.data?.message ?? "Could not delete category."),
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSave = (name: string, icon: string | null, color: string | null) => {
    if (activeTab !== "income" && activeTab !== "expense") {
      Alert.alert("Not Supported", "Custom categories are only available for income and expense.");
      return;
    }
    if (editingCat) {
      updateMutation.mutate({ id: editingCat.id, data: { name, icon: icon ?? undefined, color: color ?? undefined } });
    } else {
      createMutation.mutate({
        data: {
          name,
          type: activeTab as "income" | "expense",
          icon: icon ?? undefined,
          color: color ?? undefined,
        },
      });
    }
  };

  const [reassigning, setReassigning] = useState<Category | null>(null);
  const { token } = useAuth();

  const reassignAndDelete = async (source: Category, targetId: number) => {
    const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "");
    if (!baseUrl || !token) return;
    try {
      const res = await fetch(`${baseUrl}/api/categories/${source.id}/reassign`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ targetCategoryId: targetId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Reassign failed");
      }
      setReassigning(null);
      invalidate();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not reassign category.");
    }
  };

  const handleDelete = (cat: Category) => {
    if (cat.isDefault) {
      Alert.alert("Cannot Delete", "Default categories cannot be deleted.");
      return;
    }
    Alert.alert("Delete Category", `Delete "${cat.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          deleteMutation.mutate(
            { id: cat.id },
            {
              onError: (err: unknown) => {
                const data = (err as { response?: { data?: { code?: string; message?: string; transactionCount?: number } } })
                  ?.response?.data;
                if (data?.code === "CATEGORY_IN_USE") {
                  Alert.alert(
                    "Category In Use",
                    data.message ?? "Move transactions to another category first.",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Move Transactions", onPress: () => setReassigning(cat) },
                    ],
                  );
                } else {
                  Alert.alert("Error", data?.message ?? "Could not delete category.");
                }
              },
            },
          ),
      },
    ]);
  };

  const tabColor = (tab: CategoryType) => {
    switch (tab) {
      case "income": return colors.income;
      case "expense": return colors.expense;
      case "loan": return colors.loan;
      case "goal": return colors.goal;
    }
  };

  const accentColor = tabColor(activeTab);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 20 : 10), borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Categories</Text>
        <Pressable
          onPress={() => { setEditingCat(null); setModalVisible(true); }}
          style={[styles.addBtn, { backgroundColor: accentColor + "20" }]}
        >
          <Feather name="plus" size={20} color={accentColor} />
        </Pressable>
      </View>

      {/* Type tabs */}
      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          const tColor = tabColor(tab.key);
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tab, active && { borderBottomColor: tColor, borderBottomWidth: 2 }]}
            >
              <Feather name={tab.icon as any} size={14} color={active ? tColor : colors.textSecondary} />
              <Text style={[styles.tabText, { color: active ? tColor : colors.textSecondary, fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Category list */}
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        {activeTab !== "income" && activeTab !== "expense" ? (
          <View style={styles.empty}>
            <Feather name="info" size={36} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Loan and goal labels are managed on their respective screens. Custom categories apply to income and expense only.
            </Text>
          </View>
        ) : cats.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="tag" size={36} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No {activeTab} categories yet</Text>
            <Pressable
              onPress={() => { setEditingCat(null); setModalVisible(true); }}
              style={[styles.emptyBtn, { backgroundColor: accentColor, borderRadius: 12 }]}
            >
              <Text style={styles.emptyBtnText}>Add First Category</Text>
            </Pressable>
          </View>
        ) : (
          cats.map((cat) => (
          <View key={cat.id} style={[styles.catRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Icon/color dot */}
            <View style={[styles.catIcon, { backgroundColor: (cat.color ?? accentColor) + "25" }]}>
              {cat.icon ? (
                <Feather name={cat.icon as any} size={18} color={cat.color ?? accentColor} />
              ) : (
                <View style={[styles.catDot, { backgroundColor: cat.color ?? accentColor }]} />
              )}
            </View>

            <View style={styles.catInfo}>
              <Text style={[styles.catName, { color: colors.text }]}>{cat.name}</Text>
              {cat.isDefault && (
                <Text style={[styles.defaultBadge, { color: colors.textSecondary }]}>Default</Text>
              )}
            </View>

            <View style={styles.catActions}>
              <Pressable
                onPress={() => { setEditingCat(cat); setModalVisible(true); }}
                hitSlop={8}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
              >
                <Feather name="edit-2" size={15} color={colors.textSecondary} />
              </Pressable>
              {!cat.isDefault && (
                <Pressable
                  onPress={() => handleDelete(cat)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
                >
                  <Feather name="trash-2" size={15} color={colors.expense} />
                </Pressable>
              )}
            </View>
          </View>
          ))
        )}
      </ScrollView>

      {reassigning && (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReassigning(null)}>
          <View style={[s.modalContainer, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
            <Text style={[s.modalTitle, { color: colors.text, paddingHorizontal: 20, marginBottom: 12 }]}>
              Move transactions from "{reassigning.name}"
            </Text>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 8 }}>
              {cats
                .filter((c) => c.id !== reassigning.id && (c.type === reassigning.type))
                .map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => reassignAndDelete(reassigning, c.id)}
                    style={[styles.catRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <Text style={[styles.catName, { color: colors.text }]}>{c.name}</Text>
                  </Pressable>
                ))}
            </ScrollView>
            <Pressable onPress={() => setReassigning(null)} style={{ padding: 20 }}>
              <Text style={{ color: colors.textSecondary, textAlign: "center" }}>Cancel</Text>
            </Pressable>
          </View>
        </Modal>
      )}

      <EditModal
        visible={modalVisible}
        editing={editingCat}
        type={activeTab}
        onClose={() => { setModalVisible(false); setEditingCat(null); }}
        onSave={handleSave}
        saving={isSaving}
      />
    </View>
  );
}

const s = StyleSheet.create({
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalCancel: { fontSize: 16, fontFamily: "Inter_400Regular" },
  modalTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  modalSave: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  modalForm: { padding: 20, gap: 4 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 50,
  },
  textInput: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular" },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorSwatch: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  colorSwatchSelected: {
    borderWidth: 2, borderColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  iconCell: {
    width: 48, height: 48, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  addBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tabRow: {
    flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 8,
  },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 12,
  },
  tabText: { fontSize: 13 },
  list: { padding: 16, gap: 8 },
  catRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  catIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  catDot: { width: 14, height: 14, borderRadius: 7 },
  catInfo: { flex: 1 },
  catName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  defaultBadge: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  catActions: { flexDirection: "row", gap: 14 },
  actionBtn: { padding: 4 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 14 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 12 },
  emptyBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
