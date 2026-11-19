import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppProvider, useApp } from "../lib/session";
import { useTheme } from "../lib/theme";

function Gate() {
  const { session, ready } = useApp();
  const segments = useSegments();
  const router = useRouter();
  const t = useTheme();

  useEffect(() => {
    if (!ready) return;
    const onLogin = segments[0] === "login";
    if (!session && !onLogin) router.replace("/login");
    if (session && onLogin) router.replace("/");
  }, [session, ready, segments]);

  if (!ready) return <View style={{ flex: 1, justifyContent: "center", backgroundColor: t.bg }}><ActivityIndicator /></View>;
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: t.card }, headerTintColor: t.text, contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="set/[id]" options={{ title: "Set" }} />
      <Stack.Screen name="card/[id]" options={{ title: "Karte" }} />
      <Stack.Screen name="item/[id]" options={{ title: "Sammlungseintrag" }} />
      <Stack.Screen name="tag/[key]" options={{ title: "Typ" }} />
      <Stack.Screen name="bestand" options={{ title: "Sammlung" }} />
      <Stack.Screen name="scan" options={{ title: "Karte scannen" }} />
      <Stack.Screen name="mastersets" options={{ title: "Mastersets" }} />
      <Stack.Screen name="custom-card" options={{ title: "Eigene Karte anlegen" }} />
    </Stack>
  );
}

export default function Root() {
  return (
    <AppProvider>
      <StatusBar style="light" />
      <Gate />
    </AppProvider>
  );
}
