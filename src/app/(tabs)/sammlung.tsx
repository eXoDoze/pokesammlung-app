import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Screen } from "../../components/ui";
import { fetchItems, valuesForItems } from "../../lib/data";
import { eur } from "../../lib/labels";
import { useApp } from "../../lib/session";
import { useTheme } from "../../lib/theme";

type Tile = { key: string; icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; href?: string; soon?: boolean };

export default function SammlungHub() {
  const { active } = useApp();
  const router = useRouter();
  const t = useTheme();
  const [stat, setStat] = useState({ cards: 0, value: 0, closed: 0, wish: 0 });

  useFocusEffect(useCallback(() => {
    if (!active) return;
    (async () => {
      const owned = await fetchItems(active.id, ["owned"]);
      const vals = await valuesForItems(owned);
      let cards = 0, value = 0;
      for (const i of owned) { cards += i.quantity; const v = vals.get(i.id); if (v) value += v.price * i.quantity; }
      const closed = await fetchItems(active.id, ["sold", "traded"]);
      const wish = await fetchItems(active.id, ["wishlist"]);
      setStat({ cards, value, closed: closed.length, wish: wish.length });
    })();
  }, [active]));

  const tiles: Tile[] = [
    { key: "bestand", icon: "albums", title: "Sammlung", sub: `${stat.cards} Karten · ${eur(stat.value)}`, href: "/bestand" },
    { key: "wish", icon: "heart", title: "Wunschliste", sub: `${stat.wish} Karten`, href: "/wunschliste" },
    { key: "master", icon: "ribbon", title: "Mastersets", sub: "Fortschritt pro Set", href: "/mastersets" },
    { key: "scan", icon: "scan", title: "Karte scannen", sub: "Mit der Kamera hinzufügen", href: "/scan" },
    { key: "binder", icon: "book", title: "Binder", sub: "Kommt als Nächstes", soon: true },
    { key: "closed", icon: "swap-horizontal", title: "Verkauft & getauscht", sub: `${stat.closed} Einträge`, href: "/bestand?view=closed" },
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {tiles.map((x) => (
          <Pressable key={x.key} disabled={x.soon} onPress={() => x.href && router.push(x.href as any)}
            style={{ width: "48%", flexGrow: 1, backgroundColor: t.card, borderRadius: 18, borderColor: t.line, borderWidth: 1, padding: 16, minHeight: 140, opacity: x.soon ? 0.55 : 1 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.chip, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <Ionicons name={x.icon} size={24} color={t.accent} />
            </View>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: "800" }}>{x.title}</Text>
            <Text style={{ color: t.sub, fontSize: 12, marginTop: 4 }}>{x.sub}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
