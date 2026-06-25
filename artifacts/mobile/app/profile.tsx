import { Feather } from "@expo/vector-icons";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const qc = useQueryClient();

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: async () => {
        qc.clear();
        await logout();
      },
    },
  });

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: () => logoutMutation.mutate(undefined as any),
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 30 : 16),
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}>
          <Feather name="x" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.avatarSection}>
            <View style={[styles.avatar, { backgroundColor: colors.primary + "25" }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {(user?.fullName ?? "?")[0].toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.name, { color: colors.text }]}>{user?.fullName}</Text>
            <View style={[styles.mobilePill, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="phone" size={14} color={colors.textSecondary} />
              <Text style={[styles.mobile, { color: colors.textSecondary }]}>{user?.mobile}</Text>
            </View>
          </View>

          {/* Account Info */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <Feather name="user" size={16} color={colors.textSecondary} />
              <View style={styles.infoText}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Full Name</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{user?.fullName}</Text>
              </View>
            </View>
            <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
            <View style={styles.infoRow}>
              <Feather name="smartphone" size={16} color={colors.textSecondary} />
              <View style={styles.infoText}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Mobile Number</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{user?.mobile}</Text>
              </View>
            </View>
          </View>

          {/* Categories */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable
              style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
              onPress={() => router.push("/categories" as any)}
            >
              <Feather name="tag" size={16} color={colors.primary} />
              <View style={styles.infoText}>
                <Text style={[styles.actionLabel, { color: colors.text }]}>Manage Categories</Text>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Create, rename, or delete categories</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Security */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable
              style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
              onPress={() => router.push("/change-password" as any)}
            >
              <Feather name="lock" size={16} color={colors.primary} />
              <View style={styles.infoText}>
                <Text style={[styles.actionLabel, { color: colors.text }]}>Change Password</Text>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Update your account password</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textSecondary} />
            </Pressable>
            <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
            <Pressable
              style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
              onPress={() => router.push("/(auth)/forgot-password" as any)}
            >
              <Feather name="key" size={16} color={colors.textSecondary} />
              <View style={styles.infoText}>
                <Text style={[styles.actionLabel, { color: colors.text }]}>Forgot Password</Text>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Reset via mobile number</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Data Security */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <Feather name="shield" size={16} color={colors.textSecondary} />
              <View style={styles.infoText}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Data Security</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>Passwords hashed with bcrypt</Text>
              </View>
            </View>
            <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
            <View style={styles.infoRow}>
              <Feather name="database" size={16} color={colors.textSecondary} />
              <View style={styles.infoText}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Storage</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>Cloud database (synced across devices)</Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={handleLogout}
            disabled={logoutMutation.isPending}
            style={({ pressed }) => [
              styles.logoutBtn,
              { backgroundColor: colors.expense + "15", borderColor: colors.expense + "40" },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Feather name="log-out" size={18} color={colors.expense} />
            <Text style={[styles.logoutText, { color: colors.expense }]}>
              {logoutMutation.isPending ? "Logging out..." : "Log Out"}
            </Text>
          </Pressable>

          <Text style={[styles.version, { color: colors.textSecondary }]}>LifeOps v1.0.0</Text>
        </View>
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
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  content: { padding: 20, gap: 16 },
  avatarSection: { alignItems: "center", paddingVertical: 24, gap: 12 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 36, fontFamily: "Inter_700Bold" },
  name: { fontSize: 22, fontFamily: "Inter_700Bold" },
  mobilePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  mobile: { fontSize: 14, fontFamily: "Inter_500Medium" },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 2 },
  infoValue: { fontSize: 15, fontFamily: "Inter_500Medium" },
  actionLabel: { fontSize: 15, fontFamily: "Inter_500Medium", marginBottom: 2 },
  rowDivider: { height: 1, marginLeft: 46 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  logoutText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  version: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 },
});
