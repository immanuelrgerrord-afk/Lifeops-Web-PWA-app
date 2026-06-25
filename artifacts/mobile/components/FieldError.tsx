import React from "react";
import { Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

export function FieldError({ message }: { message?: string | null }) {
  const colors = useColors();
  if (!message) return null;
  return <Text style={[styles.error, { color: colors.expense }]}>{message}</Text>;
}

const styles = StyleSheet.create({
  error: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
});
