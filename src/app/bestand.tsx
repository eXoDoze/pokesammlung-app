import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View, useWindowDimensions } from "react-native";
import { CardImg, Chip, Empty, Field, Pill, Row, Screen, Segmented, Sub, Thumb } from "../components/ui";
import { Item, Value, fetchItems, valuesForItems } from "../lib/data";
import { FINISH_LABEL, cardName, conditionLabel, eur, isoToDe, setTitle } from "../lib/labels";
import { useApp } from "../lib/session";
import { useTheme } from "../lib/theme";

export default function Bestand() {
  const params = useLocalSearchParams<{ view?: string }>();
  const { active } = useApp();
  const router = useRouter();
  const t = useTheme();
  const [items, setItems] = useState<Item[]>([]);
  const [vals, setVals] = useState<Map<string, Value>>(new Map());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [priceFilter, setPriceFilter] = useState<"alle" | "ohne" | "hand">("alle");
  const [layout, setLayout] = useState<"liste" | "raster">("liste");
  const { width: winW } = useWindowDimensions();
  const GCOLS = 3, GGAP = 10;
  const gridW = Math.floor((Math.min(winW, 760) - 32 - GGAP * (GCOLS - 1)) / GCOLS);
  const [view, setView] = useState<"owned" | "closed">(params.view === "closed" ? "closed" : "owned");

  const load = useCallback(async () => {
    if (!active) return;
    setBusy(true);
    try { const it = await fetchItems(active.id, view === "owned" ? ["owned"] : ["sold", "traded"]); setItems(it); setVals(await valuesForItems(it)); } finally { setBusy(false); }
  }, [active, view]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => {
      if (view === "owned" && priceFilter !== "alle") {
        const v = vals.get(i.id);
        if (priceFilter === "ohne" && v) return false;
        if (priceFilter === "hand" && v?.kind !== "eigen") return false;
      }
      return !s || [i.cards.name_en, i.cards.name_de, i.cards.name_ja, i.cards.number, i.cards.sets?.name_de, i.cards.sets?.name_en].some((x) => x?.toLowerCase().includes(s));
    });
  }, [items, q, vals, view, priceFilter]);
  const noPriceCount = useMemo(() => items.filter((i) => !vals.get(i.id)).length, [items, vals]);

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
        <View style={{ marginBottom: 10 }}>
          <Segmented value={layout} onChange={(v) => setLayout(v as "liste" | "raster")} options={[{ value: "liste", label: "Liste" }, { value: "raster", label: "Raster" }]} />
        </View>
        {view === "owned" && (
          <Row>
            <Chip label="Alle" on={priceFilter === "alle"} onPress={() => setPriceFilter("alle")} />
            <Chip label={`Ohne Preis (${noPriceCount})`} on={priceFilter === "ohne"} onPress={() => setPriceFilter("ohne")} />
            <Chip label="Preis von Hand" on={priceFilter === "hand"} onPress={() => setPriceFilter("hand")} />
          </Row>
        )}
        <Field label="" value={q} onChangeText={setQ} placeholder="In meiner Sammlung suchen: Name, Nummer oder Set" />
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
          <Sub>{sum.cnt} Karten · {list.length} Einträge{view === "closed" ? " · Erlös" : ""}</Sub>
          <Text style={{ color: t.text, fontWeight: "800", fontSize: 13 }}>{eur(sum.value)}</Text>
        </View>
      </View>
      <FlatList data={list} keyExtractor={(i) => i.id} key={layout} numColumns={layout === "raster" ? GCOLS : 1}
        columnWrapperStyle={layout === "raster" ? { gap: GGAP, marginBottom: GGAP } : undefined}
        contentContainerStyle={{ padding: 16, paddingTop: 4, maxWidth: 760, width: "100%", alignSelf: "center" }}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}
        ListEmptyComponent={<Empty text={view === "closed" ? "Noch nichts verkauft oder getauscht." : "Noch nichts in der Sammlung. Suche ein Pokémon oder öffne ein Set."} />}
        renderItem={({ item: i }) => {
          const v = vals.get(i.id);
          const profit = v && i.purchase_price != null ? (v.price - i.purchase_price) * i.quantity : null;
          const setName = setTitle(i.cards.sets as any);
          if (layout === "raster") {
            return (
              <Pressable onPress={() => router.push(`/item/${i.id}`)} style={{ width: gridW }}>
                <View>
                  <CardImg uri={i.cards.image_url} width={gridW} height={Math.round(gridW * 1.4)} label={cardName(i.cards)} radius={8} />
                  {i.quantity > 1 && (
                    <View style={{ position: "absolute", top: 4, left: 4, backgroundColor: t.accent, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
                      <Text style={{ color: t.accentText, fontSize: 11, fontWeight: "800" }}>{i.quantity}×</Text>
                    </View>
                  )}
                  <View style={{ position: "absolute", bottom: 4, right: 4, backgroundColor: "rgba(11,8,32,0.85)", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: t.text, fontSize: 11, fontWeight: "800" }}>{i.status === "sold" ? (i.sold_price != null ? eur(i.sold_price * i.quantity) : "–") : v ? eur(v.price * i.quantity) : "–"}</Text>
                  </View>
                </View>
                <Text numberOfLines={1} style={{ color: t.text, fontSize: 11.5, fontWeight: "700", marginTop: 4 }}>{cardName(i.cards)}</Text>
                <Text numberOfLines={1} style={{ color: t.sub, fontSize: 10.5 }}>{i.is_graded ? `${i.grading_company} ${i.grade}` : conditionLabel(i.condition)} · {i.language.toUpperCase()}</Text>
              </Pressable>
            );
          }
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
                  <Text style={{ color: t.sub, fontSize: 10.5, marginTop: 1 }}>{i.status === "sold" ? isoToDe(i.closed_at) : v?.kind === "eigen" ? "von Hand" : v?.kind === "zustand" ? "Zustand" : v?.kind === "ab" ? "Ab-Preis" : v?.kind === "markt" ? "Trend" : "kein Preis"}</Text>
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
