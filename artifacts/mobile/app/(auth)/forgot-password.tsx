import { Feather } from "@expo/vector-icons";
import { useForgotPassword } from "@workspace/api-client-react";
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

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [mobileFocused, setMobileFocused] = useState(false);
  const [sent, setSent] = useState(false);

  const mutation = useForgotPassword({
    mutation: {
      onSuccess: () => {
        setSent(true);
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message ?? "Something went wrong. Try again.";
        Alert.alert("Error", msg);
      },
    },
  });

  const handleSubmit = () => {
    const trimmed = mobile.trim();
    if (!trimmed || trimmed.length < 7) return Alert.alert("Required", "Please enter a valid mobile number.");
    mutation.mutate({ data: { mobile: trimmed } });
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: insets.top + (Platform.OS === "web" ? 20 : 10),
      paddingBottom: 16,
      gap: 12,
    },
    backBtn: { padding: 6 },
    headerTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: colors.text },
    inner: { flex: 1, paddingHorizontal: 28, paddingTop: 32, paddingBottom: 40 },
    iconRow: { alignItems: "center", marginBottom: 28 },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary + "20",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    title: { fontSize: 24, fontFamily: "Inter_700Bold", color: colors.text, textAlign: "center" },
    subtitle: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 8,
      lineHeight: 22,
    },
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
    button: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      height: 56,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 24,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.primaryForeground },
    successBox: {
      backgroundColor: colors.income + "15",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.income + "30",
      padding: 20,
      alignItems: "center",
      gap: 12,
      marginTop: 24,
    },
    successText: { fontSize: 15, fontFamily: "Inter_500Medium", color: colors.text, textAlign: "center", lineHeight: 22 },
    backLink: { alignItems: "center", marginTop: 24 },
    backLinkText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.primary },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.headerTitle}>Forgot Password</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.inner}>
            <View style={s.iconRow}>
              <View style={s.iconCircle}>
                <Feather name="key" size={30} color={colors.primary} />
              </View>
              <Text style={s.title}>Reset Password</Text>
              <Text style={s.subtitle}>
                Enter your registered mobile number and we'll send reset instructions.
              </Text>
            </View>

            {!sent ? (
              <>
                <Text style={s.label}>Mobile Number</Text>
                <View style={[s.inputWrap, mobileFocused && s.inputFocused]}>
                  <Feather name="phone" size={18} color={mobileFocused ? colors.primary : colors.textSecondary} />
                  <TextInput
                    style={s.input}
                    placeholder="e.g. +91 9876543210"
                    placeholderTextColor={colors.textSecondary}
                    value={mobile}
                    onChangeText={setMobile}
                    keyboardType="phone-pad"
                    onFocus={() => setMobileFocused(true)}
                    onBlur={() => setMobileFocused(false)}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [s.button, mutation.isPending && s.buttonDisabled, pressed && { opacity: 0.85 }]}
                  onPress={handleSubmit}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <ActivityIndicator color={colors.primaryForeground} />
                  ) : (
                    <Text style={s.buttonText}>Send Reset Instructions</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <View style={s.successBox}>
                <Feather name="check-circle" size={32} color={colors.income} />
                <Text style={s.successText}>
                  If this number is registered, reset instructions have been sent to you.
                </Text>
              </View>
            )}

            <Pressable style={s.backLink} onPress={() => router.back()}>
              <Text style={s.backLinkText}>Back to Login</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
