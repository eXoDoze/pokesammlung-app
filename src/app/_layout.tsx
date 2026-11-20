import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { AppProvider, useApp } from "../lib/session";
import { useTheme } from "../lib/theme";

// Beim Start nach App-Updates suchen, im Hintergrund laden und dann fragen: später oder jetzt neu starten.
function UpdatePrompt() {
  const { isUpdatePending } = Updates.useUpdates();
  const asked = useRef(false);
  useEffect(() => {
    if (!Updates.isEnabled) return;
    (async () => {
      try { const r = await Updates.checkForUpdateAsync(); if (r.isAvailable) await Updates.fetchUpdateAsync(); } catch { /* offline o. ä.: ignorieren */ }
    })();
  }, []);
  useEffect(() => {
    if (!isUpdatePending || asked.current) return;
    asked.current = true;
    Alert.alert("Update verfügbar", "Eine neue Version der App ist bereit.", [
      { text: "Später", style: "cancel" },
      { text: "Jetzt installieren", onPress: () => { Updates.reloadAsync().catch(() => {}); } },
    ]);
  }, [isUpdatePending]);
  return null;
}

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
      <Stack.Screen name="set/[setId]" options={{ title: "Set" }} />
      <Stack.Screen name="card/[cardId]" options={{ title: "Karte" }} />
      <Stack.Screen name="item/[itemId]" options={{ title: "Sammlungseintrag" }} />
      <Stack.Screen name="tag/[tagKey]" options={{ title: "Typ" }} />
      <Stack.Screen name="bestand" options={{ title: "Sammlung" }} />
      <Stack.Screen name="scan" options={{ title: "Karte scannen" }} />
      <Stack.Screen name="mastersets" options={{ title: "Mastersets" }} />
      <Stack.Screen name="investiert" options={{ title: "Investiert" }} />
      <Stack.Screen name="wunschliste" options={{ title: "Wunschliste" }} />
      <Stack.Screen name="karte-hinzufuegen" options={{ title: "Zur Sammlung hinzufügen" }} />
      <Stack.Screen name="card-versions" options={{ title: "Weitere Versionen" }} />
      <Stack.Screen name="custom-card" options={{ title: "Eigene Karte anlegen" }} />
    </Stack>
  );
}

export default function Root() {
  return (
    <AppProvider>
      <StatusBar style="light" />
      <UpdatePrompt />
      <Gate />
    </AppProvider>
  );
}
