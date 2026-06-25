import { Feather } from "@expo/vector-icons";
import { useChangePassword } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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

export default function ChangePasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [currentFocused, setCurrentFocused] = useState(false);
  const [newFocused, setNewFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  const mutation = useChangePassword({
    mutation: {
      onSuccess: () => {
        Alert.alert("Success", "Your password has been changed successfully.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message ?? "Failed to change password. Please try again.";
        Alert.alert("Error", msg);
      },
    },
  });

  const handleSubmit = () => {
    if (!currentPassword) return Alert.alert("Required", "Please enter your current password.");
    if (!newPassword || newPassword.length < 6) return Alert.alert("Required", "New password must be at least 6 characters.");
    if (newPassword !== confirmPassword) return Alert.alert("Required", "Passwords do not match.");
    mutation.mutate({ data: { currentPassword, newPassword, confirmPassword } });
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: insets.top + (Platform.OS === "web" ? 20 : 10),
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: colors.text },
    inner: { flex: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40, gap: 16 },
    label: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.textSecondary,
      marginBottom: 6,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      height: 54,
      gap: 12,
    },
    inputFocused: { borderColor: colors.primary },
    input: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular", color: colors.text },
    eyeBtn: { padding: 4 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
    button: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      height: 56,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.primaryForeground },
    hint: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.textSecondary, lineHeight: 18 },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.headerTitle}>Change Password</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.inner}>
            <View>
              <Text style={s.label}>Current Password</Text>
              <View style={[s.inputWrap, currentFocused && s.inputFocused]}>
                <Feather name="lock" size={18} color={currentFocused ? colors.primary : colors.textSecondary} />
                <TextInput
                  style={s.input}
                  placeholder="Enter current password"
                  placeholderTextColor={colors.textSecondary}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrent}
                  onFocus={() => setCurrentFocused(true)}
                  onBlur={() => setCurrentFocused(false)}
                  returnKeyType="next"
                />
                <Pressable style={s.eyeBtn} onPress={() => setShowCurrent((v) => !v)}>
                  <Feather name={showCurrent ? "eye-off" : "eye"} size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>

            <View style={s.divider} />

            <View>
              <Text style={s.label}>New Password</Text>
              <View style={[s.inputWrap, newFocused && s.inputFocused]}>
                <Feather name="lock" size={18} color={newFocused ? colors.primary : colors.textSecondary} />
                <TextInput
                  style={s.input}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={colors.textSecondary}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNew}
                  onFocus={() => setNewFocused(true)}
                  onBlur={() => setNewFocused(false)}
                  returnKeyType="next"
                />
                <Pressable style={s.eyeBtn} onPress={() => setShowNew((v) => !v)}>
                  <Feather name={showNew ? "eye-off" : "eye"} size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>

            <View>
              <Text style={s.label}>Confirm New Password</Text>
              <View style={[s.inputWrap, confirmFocused && s.inputFocused]}>
                <Feather name="lock" size={18} color={confirmFocused ? colors.primary : colors.textSecondary} />
                <TextInput
                  style={s.input}
                  placeholder="Re-enter new password"
                  placeholderTextColor={colors.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirm}
                  onFocus={() => setConfirmFocused(true)}
                  onBlur={() => setConfirmFocused(false)}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <Pressable style={s.eyeBtn} onPress={() => setShowConfirm((v) => !v)}>
                  <Feather name={showConfirm ? "eye-off" : "eye"} size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>

            <Text style={s.hint}>Password must be at least 6 characters long.</Text>

            <Pressable
              style={({ pressed }) => [s.button, mutation.isPending && s.buttonDisabled, pressed && { opacity: 0.85 }]}
              onPress={handleSubmit}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={s.buttonText}>Change Password</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
