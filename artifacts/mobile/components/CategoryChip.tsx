import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

type FeatherIcon = keyof typeof Feather.glyphMap;

interface CategoryChipProps {
  name: string;
  icon?: string | null;
  color?: string | null;
  selected?: boolean;
  accentColor: string;
  onPress?: () => void;
  compact?: boolean;
}

export function CategoryChip({
  name,
  icon,
  color,
  selected,
  accentColor,
  onPress,
  compact,
}: CategoryChipProps) {
  const colors = useColors();
  const chipColor = color ?? accentColor;
  const bg = selected ? chipColor + "28" : colors.card;
  const border = selected ? chipColor : colors.border;

  const content = (
    <View style={[styles.chip, compact && styles.chipCompact, { backgroundColor: bg, borderColor: border }]}>
      <View style={[styles.iconDot, { backgroundColor: chipColor + "30" }]}>
        <Feather
          name={(icon as FeatherIcon) ?? "tag"}
          size={compact ? 12 : 14}
          color={chipColor}
        />
      </View>
      <Text
        style={[
          styles.label,
          compact && styles.labelCompact,
          { color: selected ? chipColor : colors.text },
        ]}
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
      {content}
    </Pressable>
  );
}

interface CategoryBadgeProps {
  name: string;
  icon?: string | null;
  color?: string | null;
  fallbackAccent: string;
  size?: number;
}

export function CategoryBadge({ name, icon, color, fallbackAccent, size = 40 }: CategoryBadgeProps) {
  const chipColor = color ?? fallbackAccent;
  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size * 0.28,
          backgroundColor: chipColor + "22",
        },
      ]}
      accessibilityLabel={name}
    >
      <Feather name={(icon as FeatherIcon) ?? "tag"} size={size * 0.38} color={chipColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  iconDot: {
    width: 22,
    height: 22,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    maxWidth: 120,
  },
  labelCompact: {
    fontSize: 12,
  },
  badge: {
    alignItems: "center",
    justifyContent: "center",
  },
});
