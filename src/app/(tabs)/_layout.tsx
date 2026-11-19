import { Tabs } from "expo-router";
import React from "react";
import { Text } from "react-native";
import { useTheme } from "../../lib/theme";

const icon = (e: string) => () => <Text style={{ fontSize: 18 }}>{e}</Text>;

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: t.card }, headerTintColor: t.text,
      tabBarStyle: { backgroundColor: t.card, borderTopColor: t.line },
      tabBarActiveTintColor: t.accent, tabBarInactiveTintColor: t.sub,
    }}>
      <Tabs.Screen name="index" options={{ title: "Übersicht", tabBarIcon: icon("🏠") }} />
      <Tabs.Screen name="sammlung" options={{ title: "Sammlung", tabBarIcon: icon("📚") }} />
      <Tabs.Screen name="sets" options={{ title: "Sets", tabBarIcon: icon("🗂️") }} />
      <Tabs.Screen name="mehr" options={{ title: "Mehr", tabBarIcon: icon("⚙️") }} />
    </Tabs>
  );
}
