import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { Empty, Field, Panel, Screen, Sub, Thumb, Txt } from "../../components/ui";
import { Item, Value, fetchItems, valuesForItems } from "../../lib/data";
import { FINISH_LABEL, cardName, conditionLabel, eur } from "../../lib/labels";
import { useApp } from "../../lib/session";

export default function Sammlung() {
  const { active } = useApp();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [vals, setVals] = useState<Map<string, Value>>(new Map());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!active) return;
    setBusy(true);
    try { const it = await fetchItems(active.id); setItems(it); setVals(await valuesForItems(it)); } finally { setBusy(false); }
  }, [active]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => !s || [i.cards.name_en, i.cards.name_de, i.cards.name_ja, i.cards.number, i.cards.sets?.name_de, i.cards.sets?.name_en].some((x) => x?.toLowerCase().includes(s)));
  }, [items, q]);

  return (
    <Screen>
      <View style={{ padding: 16, paddingBottom: 0 }}><Field label="Suchen" value={q} onChangeText={setQ} placeholder="Name, Nummer oder Set" /></View>
      <FlatList data={list} keyExtractor={(i) => i.id} contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}
        ListEmptyComponent={<Empty text="Noch nichts in der Sammlung. Öffne ein Set und füge Karten hinzu." />}
        renderItem={({ item: i }) => {
          const v = vals.get(i.id);
          const profit = v && i.purchase_price != null ? (v.price - i.purchase_price) * i.quantity : null;
          return (
            <Pressable onPress={() => router.push(`/item/${i.id}`)} style={{ marginBottom: 8 }}>
              <Panel style={{ flexDirection: "row", gap: 12 }}>
                <Thumb uri={i.cards.image_url} w={48} />
                <View style={{ flex: 1 }}>
                  <Txt bold>{i.quantity > 1 ? `${i.quantity}× ` : ""}{cardName(i.cards)}</Txt>
                  <Sub>{i.cards.sets?.name_de ?? i.cards.sets?.name_en ?? i.cards.sets?.name_ja ?? i.cards.sets?.name_zh ?? i.cards.sets?.name_ko} · {i.cards.number}</Sub>
                  <Sub>{FINISH_LABEL[i.finish]}{i.is_first_edition ? " · 1st Edition" : ""}{i.is_shadowless ? " · Shadowless" : ""}{i.stamp ? ` · ${i.stamp}` : ""} · {i.is_graded ? `${i.grading_company} ${i.grade}` : conditionLabel(i.condition)} · {i.language.toUpperCase()}</Sub>
                  <Sub>
                    Kauf {eur(i.purchase_price)} · Wert {v ? eur(v.price) : "–"}{v?.kind === "markt" ? " (Markt)" : v?.kind === "eigen" ? " (von Hand)" : v?.scope === "other" ? " (Ausland)" : ""}
                    {profit != null ? `  ·  ${profit >= 0 ? "+" : ""}${eur(profit)}` : ""}
                  </Sub>
                </View>
              </Panel>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
