import React from "react";
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useColors } from "@/hooks/useColors";
import { FieldError } from "./FieldError";
import { parseAmount, formatAmountDisplay, parseInterestRate } from "@/utils/numeric";

type BaseProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  onBlur?: () => void;
  containerStyle?: object;
};

export function AmountInput({
  label,
  value,
  onChangeText,
  error,
  prefix = "₹",
  placeholder = "0.00",
  onBlur,
  containerStyle,
}: BaseProps) {
  const colors = useColors();
  const borderColor = error ? colors.expense : colors.border;
  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}
      <View style={[styles.row, { backgroundColor: colors.card, borderColor }]}>
        {prefix ? (
          <Text style={[styles.affix, { color: colors.textSecondary }]}>{prefix}</Text>
        ) : null}
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          onBlur={() => {
            const n = parseAmount(value);
            if (n !== null) onChangeText(formatAmountDisplay(n));
            onBlur?.();
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          keyboardType={Platform.OS === "web" ? undefined : "decimal-pad"}
          inputMode="decimal"
        />
      </View>
      <FieldError message={error} />
    </View>
  );
}

export function RateInput({
  label,
  value,
  onChangeText,
  error,
  placeholder = "e.g. 8.35",
  onBlur,
  containerStyle,
}: BaseProps) {
  const colors = useColors();
  const borderColor = error ? colors.expense : colors.border;
  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}
      <View style={[styles.row, { backgroundColor: colors.card, borderColor }]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          onBlur={() => {
            const n = parseInterestRate(value);
            if (n !== null) onChangeText(String(n));
            onBlur?.();
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          keyboardType={Platform.OS === "web" ? undefined : "decimal-pad"}
          inputMode="decimal"
        />
        <Text style={[styles.affix, { color: colors.textSecondary }]}>%</Text>
      </View>
      <FieldError message={error} />
    </View>
  );
}

export function IntegerInput({
  label,
  value,
  onChangeText,
  error,
  suffix,
  placeholder,
  onBlur,
  containerStyle,
  ...rest
}: BaseProps & Pick<TextInputProps, "placeholder">) {
  const colors = useColors();
  const borderColor = error ? colors.expense : colors.border;
  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}
      <View style={[styles.row, { backgroundColor: colors.card, borderColor }]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          keyboardType={Platform.OS === "web" ? undefined : "numeric"}
          inputMode="numeric"
          {...rest}
        />
        {suffix ? <Text style={[styles.affix, { color: colors.textSecondary }]}>{suffix}</Text> : null}
      </View>
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    paddingVertical: 10,
  },
  affix: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
});
