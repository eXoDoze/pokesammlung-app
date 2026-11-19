import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Empty, Field, Pill, Screen, Segmented, Sub, Thumb } from "../../components/ui";
import { Item, Value, fetchItems, valuesForItems } from "../../lib/data";
import { FINISH_LABEL, cardName, conditionLabel, eur, setTitle } from "../../lib/labels";
import { useApp } from "../../lib/session";
import { useTheme } from "../../lib/theme";

export default function Sammlung() {
  const { active } = useApp();
  const router = useRouter();
  const t = useTheme();
  const [items, setItems] = useState<Item[]>([]);
  const [vals, setVals] = useState<Map<string, Value>>(new Map());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"owned" | "closed">("owned");

  const load = useCallback(async () => {
    if (!active) return;
    setBusy(true);
    try { const it = await fetchItems(active.id, view === "owned" ? ["owned"] : ["sold", "traded"]); setItems(it); setVals(await valuesForItems(it)); } finally { setBusy(false); }
  }, [active, view]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => !s || [i.cards.name_en, i.cards.name_de, i.cards.name_ja, i.cards.number, i.cards.sets?.name_de, i.cards.sets?.name_en].some((x) => x?.toLowerCase().includes(s)));
  }, [items, q]);

  const sum = useMemo(() => {
    let cnt = 0, value = 0;
    for (const i of list) {
      cnt += i.quantity;
      if (view === "closed") { if (i.sold_price != null) value += i.sold_price * i.quantity; continue; }
      const v = vals.get(i.id); if (v) value += v.price * i.quantity;
    }
    return { cnt, value };
  }, [list, vals, view]);

  return (
    <Screen>
      <View style={{ padding: 16, paddingBottom: 4, maxWidth: 760, width: "100%", alignSelf: "center" }}>
        <View style={{ marginBottom: 10 }}>
          <Segmented value={view} onChange={(v) => setView(v as "owned" | "closed")} options={[{ value: "owned", label: "Bestand" }, { value: "closed", label: "Verkauft & getauscht" }]} />
        </View>
        <Field label="" value={q} onChangeText={setQ} placeholder="In meiner Sammlung suchen: Name, Nummer oder Set" />
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
          <Sub>{sum.cnt} Karten · {list.length} Einträge{view === "closed" ? " · Erlös" : ""}</Sub>
          <Text style={{ color: t.text, fontWeight: "800", fontSize: 13 }}>{eur(sum.value)}</Text>
        </View>
      </View>
      <FlatList data={list} keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4, maxWidth: 760, width: "100%", alignSelf: "center" }}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}
        ListEmptyComponent={<Empty text={view === "closed" ? "Noch nichts verkauft oder getauscht." : "Noch nichts in der Sammlung. Suche ein Pokémon oder öffne ein Set."} />}
        renderItem={({ item: i }) => {
          const v = vals.get(i.id);
          const profit = v && i.purchase_price != null ? (v.price - i.purchase_price) * i.quantity : null;
          const setName = setTitle(i.cards.sets as any);
          return (
            <Pressable onPress={() => router.push(`/item/${i.id}`)} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", gap: 12, backgroundColor: t.card, borderRadius: 18, padding: 12, borderColor: t.line, borderWidth: 1 }}>
                <Thumb uri={i.cards.image_url} w={58} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: t.text, fontSize: 15, fontWeight: "800" }}>{i.quantity > 1 ? `${i.quantity}× ` : ""}{cardName(i.cards)}</Text>
                  <Text numberOfLines={1} style={{ color: t.sub, fontSize: 12, marginTop: 1 }}>{setName}{i.cards.number ? ` · #${i.cards.number}` : ""}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    <Pill label={FINISH_LABEL[i.finish] ?? i.finish} />
                    <Pill label={i.is_graded ? `${i.grading_company} ${i.grade}` : conditionLabel(i.condition)} tone="accent" />
                    <Pill label={i.language.toUpperCase()} />
                    {i.is_first_edition ? <Pill label="1st Edition" tone="accent" /> : null}
                    {i.is_shadowless ? <Pill label="Shadowless" /> : null}
                    {i.stamp ? <Pill label={i.stamp} /> : null}
                  </View>
                </View>
                <View style={{ alignItems: "flex-end", justifyContent: "center", minWidth: 74 }}>
                  {i.status && i.status !== "owned"
                    ? <Pill label={i.status === "sold" ? "Verkauft" : "Getauscht"} tone={i.status === "sold" ? "good" : "accent"} />
                    : null}
                  <Text style={{ color: t.text, fontSize: 15, fontWeight: "800" }}>{i.status === "sold" ? (i.sold_price != null ? eur(i.sold_price * i.quantity) : "–") : v ? eur(v.price * i.quantity) : "–"}</Text>
                  <Text style={{ color: t.sub, fontSize: 10.5, marginTop: 1 }}>{i.status === "sold" ? (i.closed_at ?? "") : v?.kind === "markt" ? "Markt" : v?.kind === "eigen" ? "von Hand" : v?.scope === "other" ? "Ausland" : v ? "Zustand" : "kein Preis"}</Text>
                  {profit != null && <Text style={{ color: profit >= 0 ? t.good : t.bad, fontSize: 12, fontWeight: "700", marginTop: 3 }}>{profit >= 0 ? "+" : ""}{eur(profit)}</Text>}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
