import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "chart.pie", selected: "chart.pie.fill" }} />
        <Label>Dashboard</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="income">
        <Icon sf={{ default: "arrow.down.circle", selected: "arrow.down.circle.fill" }} />
        <Label>Income</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="expenses">
        <Icon sf={{ default: "arrow.up.circle", selected: "arrow.up.circle.fill" }} />
        <Label>Expenses</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="loans">
        <Icon sf={{ default: "building.columns", selected: "building.columns.fill" }} />
        <Label>Loans</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="goals">
        <Icon sf={{ default: "target", selected: "target" }} />
        <Label>Goals</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 11,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={90}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "LifeOps",
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.pie.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="pie-chart" size={20} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="income"
        options={{
          title: "LifeOps",
          tabBarLabel: "Income",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="arrow.down.circle.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="trending-up" size={20} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "LifeOps",
          tabBarLabel: "Expenses",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="arrow.up.circle.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="trending-down" size={20} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="loans"
        options={{
          title: "LifeOps",
          tabBarLabel: "Loans",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="building.columns.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="credit-card" size={20} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: "LifeOps",
          tabBarLabel: "Goals",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="flag.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="flag" size={20} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
