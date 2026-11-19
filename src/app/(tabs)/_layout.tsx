import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../lib/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const icon = (on: IconName, off: IconName) =>
  ({ color, focused, size }: { color: any; focused: boolean; size: number }) =>
    <Ionicons name={focused ? on : off} size={size + 2} color={color} />;

export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: t.card }, headerTintColor: t.text,
      tabBarStyle: { backgroundColor: t.card, borderTopColor: t.line, height: 56 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8) },
      tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      tabBarActiveTintColor: t.accent, tabBarInactiveTintColor: t.sub,
    }}>
      <Tabs.Screen name="index" options={{ title: "Übersicht", tabBarIcon: icon("stats-chart", "stats-chart-outline") }} />
      <Tabs.Screen name="sammlung" options={{ title: "Sammlung", tabBarIcon: icon("albums", "albums-outline") }} />
      <Tabs.Screen name="suche" options={{ title: "Suche", tabBarIcon: icon("search", "search-outline") }} />
      <Tabs.Screen name="sets" options={{ title: "Sets", tabBarIcon: icon("grid", "grid-outline") }} />
      <Tabs.Screen name="mehr" options={{ title: "Mehr", tabBarIcon: icon("ellipsis-horizontal-circle", "ellipsis-horizontal-circle-outline") }} />
    </Tabs>
  );
}
