import { Feather } from "@expo/vector-icons";
import { useLogin, useRegister } from "@workspace/api-client-react";
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
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

type Mode = "login" | "register";

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [nameFocused, setNameFocused] = useState(false);
  const [mobileFocused, setMobileFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  const loginMutation = useLogin({
    mutation: {
      onSuccess: async (data) => {
        if (data.token) {
          await login(data.token);
        }
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message ?? "Invalid mobile number or password.";
        Alert.alert("Login Failed", msg);
      },
    },
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: async (data) => {
        if (data.token) {
          await login(data.token);
        }
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message ?? "Registration failed. Please try again.";
        Alert.alert("Registration Failed", msg);
      },
    },
  });

  const isPending = loginMutation.isPending || registerMutation.isPending;

  const switchMode = (m: Mode) => {
    setMode(m);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleSubmit = () => {
    const trimMobile = mobile.trim();
    const trimName = fullName.trim();

    if (mode === "login") {
      if (!trimMobile || trimMobile.length < 7) return Alert.alert("Required", "Please enter a valid mobile number.");
      if (!password) return Alert.alert("Required", "Please enter your password.");
      loginMutation.mutate({ data: { mobile: trimMobile, password } });
    } else {
      if (!trimName) return Alert.alert("Required", "Please enter your full name.");
      if (!trimMobile || trimMobile.length < 7) return Alert.alert("Required", "Please enter a valid mobile number.");
      if (!password || password.length < 6) return Alert.alert("Required", "Password must be at least 6 characters.");
      if (password !== confirmPassword) return Alert.alert("Required", "Passwords do not match.");
      registerMutation.mutate({ data: { fullName: trimName, mobile: trimMobile, password, confirmPassword } });
    }
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    inner: {
      flex: 1,
      paddingHorizontal: 28,
      paddingTop: insets.top + (Platform.OS === "web" ? 40 : 60),
      paddingBottom: insets.bottom + 40,
    },
    logoRow: { alignItems: "center", marginBottom: 32 },
    logoCircle: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: colors.primary + "20",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    heading: { fontSize: 32, fontFamily: "Inter_700Bold", color: colors.text, textAlign: "center" },
    subheading: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 8,
      lineHeight: 22,
    },
    tabRow: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 4,
      marginBottom: 28,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: 9,
    },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.textSecondary },
    tabTextActive: { color: colors.primaryForeground },
    form: { gap: 16 },
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
    button: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      height: 56,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 24,
      flexDirection: "row",
      gap: 8,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.primaryForeground },
    forgotRow: { alignItems: "center", marginTop: 16 },
    forgotText: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.primary },
  });

  return (
    <View style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.inner}>
            <View style={s.logoRow}>
              <View style={s.logoCircle}>
                <Feather name="activity" size={32} color={colors.primary} />
              </View>
              <Text style={s.heading}>LifeOps</Text>
              <Text style={s.subheading}>Your personal finance command center.</Text>
            </View>

            <View style={s.tabRow}>
              <Pressable style={[s.tab, mode === "login" && s.tabActive]} onPress={() => switchMode("login")}>
                <Text style={[s.tabText, mode === "login" && s.tabTextActive]}>Log In</Text>
              </Pressable>
              <Pressable style={[s.tab, mode === "register" && s.tabActive]} onPress={() => switchMode("register")}>
                <Text style={[s.tabText, mode === "register" && s.tabTextActive]}>Register</Text>
              </Pressable>
            </View>

            <View style={s.form}>
              {mode === "register" && (
                <View>
                  <Text style={s.label}>Full Name</Text>
                  <View style={[s.inputWrap, nameFocused && s.inputFocused]}>
                    <Feather name="user" size={18} color={nameFocused ? colors.primary : colors.textSecondary} />
                    <TextInput
                      style={s.input}
                      placeholder="e.g. Alex Johnson"
                      placeholderTextColor={colors.textSecondary}
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                      onFocus={() => setNameFocused(true)}
                      onBlur={() => setNameFocused(false)}
                      returnKeyType="next"
                    />
                  </View>
                </View>
              )}

              <View>
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
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View>
                <Text style={s.label}>Password</Text>
                <View style={[s.inputWrap, passwordFocused && s.inputFocused]}>
                  <Feather name="lock" size={18} color={passwordFocused ? colors.primary : colors.textSecondary} />
                  <TextInput
                    style={s.input}
                    placeholder={mode === "register" ? "Min. 6 characters" : "Your password"}
                    placeholderTextColor={colors.textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    returnKeyType={mode === "register" ? "next" : "done"}
                    onSubmitEditing={mode === "login" ? handleSubmit : undefined}
                  />
                  <Pressable style={s.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
                    <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </View>

              {mode === "register" && (
                <View>
                  <Text style={s.label}>Confirm Password</Text>
                  <View style={[s.inputWrap, confirmFocused && s.inputFocused]}>
                    <Feather name="lock" size={18} color={confirmFocused ? colors.primary : colors.textSecondary} />
                    <TextInput
                      style={s.input}
                      placeholder="Re-enter password"
                      placeholderTextColor={colors.textSecondary}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      onFocus={() => setConfirmFocused(true)}
                      onBlur={() => setConfirmFocused(false)}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                    />
                    <Pressable style={s.eyeBtn} onPress={() => setShowConfirmPassword((v) => !v)}>
                      <Feather name={showConfirmPassword ? "eye-off" : "eye"} size={18} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                </View>
              )}

              <Pressable
                style={({ pressed }) => [s.button, isPending && s.buttonDisabled, pressed && { opacity: 0.85 }]}
                onPress={handleSubmit}
                disabled={isPending}
              >
                {isPending ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={s.buttonText}>{mode === "login" ? "Log In" : "Create Account"}</Text>
                )}
              </Pressable>

              {mode === "login" && (
                <Pressable
                  style={s.forgotRow}
                  onPress={() => router.push("/(auth)/forgot-password" as any)}
                >
                  <Text style={s.forgotText}>Forgot Password?</Text>
                </Pressable>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
