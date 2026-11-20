import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../lib/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const icon = (on: IconName, off: IconName) =>
  ({ color, focused, size }: { color: any; focused: boolean; size: number }) =>
    <Ionicons name={focused ? on : off} size={size + 2} color={color} />;

export default function TabsLayout() {
  const t = useTheme();
  const router = useRouter();
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
      <Tabs.Screen name="scanner-tab" options={{
        title: "Scan",
        tabBarLabel: () => null,
        tabBarButton: () => (
          <View style={{ flex: 1, alignItems: "center" }}>
            <Pressable onPress={() => router.push("/scan" as any)} accessibilityLabel="Karte scannen"
              style={{ marginTop: -18, width: 60, height: 60, borderRadius: 30, backgroundColor: t.accent, alignItems: "center", justifyContent: "center",
                borderWidth: 4, borderColor: t.card, elevation: 6, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }}>
              <Ionicons name="scan" size={28} color={t.accentText} />
            </Pressable>
          </View>
        ),
      }} />
      <Tabs.Screen name="suche" options={{ title: "Suche", tabBarIcon: icon("search", "search-outline") }} />
      <Tabs.Screen name="sets" options={{ title: "Sets", tabBarIcon: icon("grid", "grid-outline") }} />
      <Tabs.Screen name="mehr" options={{ title: "Mehr", tabBarIcon: icon("ellipsis-horizontal-circle", "ellipsis-horizontal-circle-outline") }} />
    </Tabs>
  );
}
