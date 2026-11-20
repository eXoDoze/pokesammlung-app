import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Empty, Panel, Pill, Screen, Sub, Thumb, Txt } from "../components/ui";
import { Item, Value, fetchItems, valuesForItems } from "../lib/data";
import { cardName, conditionLabel, eur, setTitle } from "../lib/labels";
import { useApp } from "../lib/session";

export default function WishlistScreen() {
  const { active } = useApp();
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [vals, setVals] = useState<Map<string, Value>>(new Map());

  useFocusEffect(useCallback(() => {
    if (!active) return;
    (async () => {
      const list = await fetchItems(active.id, ["wishlist"]);
      setItems(list);
      setVals(list.length ? await valuesForItems(list) : new Map());
    })();
  }, [active]));

  const total = (items ?? []).reduce((s, i) => s + (vals.get(i.id)?.price ?? 0) * i.quantity, 0);

  return (
    <Screen>
      <Stack.Screen options={{ title: "Wunschliste" }} />
      <ScrollView contentContainerStyle={{ padding: 16, maxWidth: 760, width: "100%", alignSelf: "center" }}>
        {items === null && <Sub>Lade …</Sub>}
        {items && items.length === 0 && <Empty text="Noch nichts auf der Wunschliste. Öffne eine Karte und tippe auf „Auf die Wunschliste“." />}
        {items && items.length > 0 && (
          <>
            <Sub>{items.length} Karten · zusammen ca. {eur(total)}</Sub>
            <Panel style={{ marginTop: 8 }}>
              {items.map((i) => {
                const v = vals.get(i.id);
                return (
                  <Pressable key={i.id} onPress={() => router.push(`/item/${i.id}` as any)} style={{ flexDirection: "row", gap: 12, paddingVertical: 8, alignItems: "center" }}>
                    <Thumb uri={i.cards.image_url} w={44} />
                    <View style={{ flex: 1 }}>
                      <Txt bold numberOfLines={1}>{cardName(i.cards)}</Txt>
                      <Sub numberOfLines={1}>{setTitle(i.cards.sets as any)}{i.cards.number ? ` · #${i.cards.number}` : ""} · {i.language.toUpperCase()} · {conditionLabel(i.condition)}</Sub>
                    </View>
                    <Pill label={v ? eur(v.price) : "–"} tone={v ? "accent" : "muted"} />
                  </Pressable>
                );
              })}
            </Panel>
            <Sub style={{ marginTop: 8 }}>Antippen: Eintrag öffnen. Dort kannst du Zustand und Kaufpreis eintragen und die Karte nach dem Kauf in die Sammlung übernehmen.</Sub>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
