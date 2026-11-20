import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { CardTags } from "../../components/CardTags";
import { Empty, H, Panel, Pill, Screen, Segmented, Stat, Sub, Thumb, Txt } from "../../components/ui";
import { fetchItems, valueHistory, valuesForItems } from "../../lib/data";
import { cardName, cardTags, eur, pct } from "../../lib/labels";
import { useApp } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";

type Mover = { kind: string; card_id: string; name_en: string | null; image_url: string | null; price_then: number; price_now: number; change_pct: number; aus_verlauf?: boolean; variant_label?: string | null; rarity?: string | null; price_trend?: number | null; condition?: string; is_graded?: boolean; grading_company?: string; grade?: number; then_at?: string; now_at?: string };
const dm = (s?: string) => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.` : "");

function MoverList({ rows, own }: { rows: Mover[]; own?: boolean }) {
  const t = useTheme();
  const router = useRouter();
  if (!rows.length) return <Empty text={own ? "Noch keine Daten: Zustandspreise brauchen zwei Messzeitpunkte im gewählten Zeitraum." : "Noch keine Daten."} />;
  return (
    <Panel style={{ padding: 6 }}>
      {rows.map((r, i) => (
        <Pressable key={r.card_id + i + (r.condition ?? "")} onPress={() => router.push(`/card/${encodeURIComponent(r.card_id)}`)}
          style={{ flexDirection: "row", alignItems: "center", padding: 8, gap: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}>
          <Thumb uri={r.image_url} w={40} />
          <View style={{ flex: 1 }}>
            <Txt bold numberOfLines={1}>{r.name_en}</Txt>
            {!own ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {/* "Holo" weglassen, wenn schon ein genauerer Typ (Full Art, SIR, Tag Team …) angezeigt wird */}
                {(r.variant_label ? r.variant_label.split(" · ") : [])
                  .filter((v) => !(v === "Holo" && cardTags({ name_en: r.name_en, rarity: r.rarity }).some((t) => ["tagteam", "sir", "ir", "hyper", "megahyper", "secret", "fullart", "vmax", "vstar"].includes(t.key))))
                  .map((v) => <Pill key={v} label={v} />)}
                <CardTags card={{ name_en: r.name_en, rarity: r.rarity }} />
              </View>
            ) : null}
            <Sub>{own && r.condition ? `${r.is_graded ? `${r.grading_company} ${r.grade}` : r.condition} · ` : ""}{eur(r.price_then)} → {eur(r.price_now)}</Sub>
            {!own && r.price_trend != null ? <Sub>Preis-Trend aktuell: {eur(r.price_trend)}</Sub> : null}
          </View>
          <Pill label={pct(r.change_pct)} tone={r.change_pct >= 0 ? "good" : "bad"} />
        </Pressable>
      ))}
    </Panel>
  );
}

export default function Start() {
  const { active } = useApp();
  const [days, setDays] = useState(7);
  const [sum, setSum] = useState<{ count: number; invested: number; value: number; pricedValue: number; missing: number; own: number; manual: number } | null>(null);
  const [market, setMarket] = useState<Mover[]>([]);
  const [own, setOwn] = useState<Mover[]>([]);
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState<{ date: string; value: number }[]>([]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      if (active) {
        const items = await fetchItems(active.id);
        const vals = await valuesForItems(items);
        let invested = 0, pricedValue = 0, value = 0, missing = 0, count = 0, ownPrice = 0, manual = 0;
        for (const i of items) {
          count += i.quantity;
          if (i.purchase_price != null) invested += i.purchase_price * i.quantity;
          const v = vals.get(i.id);
          if (v && i.purchase_price != null) pricedValue += v.price * i.quantity;
          if (v) { value += v.price * i.quantity; if (v.kind === "zustand") ownPrice += 1; if (v.kind === "eigen") manual += 1; } else missing += 1;
        }
        setSum({ count, invested, pricedValue, value, missing, own: ownPrice, manual });
        setHist(await valueHistory(items, 30));
        const o = await supabase.rpc("collection_movers", { p_collection: active.id, p_days: days, p_limit: 5 });
        setOwn((o.data ?? []) as Mover[]);
      }
      const m = await supabase.rpc("market_movers", { p_days: days, p_limit: 5, p_min_price: 5 });
      setMarket((m.data ?? []) as Mover[]);
    } finally { setBusy(false); }
  }, [active, days]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const t = useTheme();
  const router = useRouter();
  // Pille unter dem Sammlungswert: Wert aller Karten minus Investiert; Kachel „Gewinn/Verlust“: nur Karten mit Kaufpreis
  const diffAll = sum ? sum.value - sum.invested : 0;
  const diff = sum ? sum.pricedValue - sum.invested : 0;

  const lo = hist.length ? Math.min(...hist.map((h) => h.value)) : 0;
  const hi = hist.length ? Math.max(...hist.map((h) => h.value)) : 0;
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, maxWidth: 760, width: "100%", alignSelf: "center" }} refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}>
        <Sub>{active ? active.name : "Keine Sammlung"}</Sub>
        {sum && (
          <Panel style={{ marginTop: 8, borderColor: t.accent + "88" }}>
            <Sub>Sammlungswert</Sub>
            <Txt bold style={{ fontSize: 36, marginTop: 2, letterSpacing: -0.5 }}>{eur(sum.value)}</Txt>
            <View style={{ flexDirection: "row", marginBottom: 12 }}>
              <Pill tone={diffAll >= 0 ? "good" : "bad"} label={`${diffAll >= 0 ? "▲" : "▼"} ${eur(Math.abs(diffAll))} zum eingesetzten Geld`} />
            </View>
            {hist.length >= 2 ? (
              <View>
                <View style={{ flexDirection: "row", alignItems: "flex-end", height: 64, gap: 3 }}>
                  {hist.map((h, k) => (
                    <View key={h.date} style={{ flex: 1, borderRadius: 3, backgroundColor: k === hist.length - 1 ? t.accent : t.accent2 + "99",
                      height: 10 + (hi === lo ? 28 : ((h.value - lo) / (hi - lo)) * 44) }} />
                  ))}
                </View>
                <Sub style={{ marginTop: 6 }}>Marktwert, letzte {hist.length} Tage</Sub>
              </View>
            ) : (
              <Sub>Der Verlauf erscheint nach dem zweiten Tag mit Preisen.</Sub>
            )}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
              <Pressable onPress={() => router.push("/bestand" as any)} style={{ flex: 1 }}>
                <Stat label="Karten ›" value={String(sum.count)} />
              </Pressable>
              <Pressable onPress={() => router.push("/investiert" as any)} style={{ flex: 1 }}>
                <Stat label="Investiert ›" value={eur(sum.invested)} />
              </Pressable>
              <Pressable onPress={() => router.push("/investiert" as any)} style={{ flex: 1 }}>
                <Stat label="Gewinn/Verlust ›" value={eur(diff)} color={diff >= 0 ? t.good : t.bad} />
              </Pressable>
            </View>
            <Sub style={{ marginTop: 10 }}>
              {sum.own} Einträge mit Zustandspreis, übrige mit Marktwert (Cardmarket-Trend).
              {sum.manual > 0 ? ` ${sum.manual} mit selbst gesetztem Wert.` : ""}{sum.missing > 0 ? ` ${sum.missing} ohne Preis, nicht in der Summe.` : ""}
            </Sub>
          </Panel>
        )}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          {([["scan", "Scannen", "/scan"], ["ribbon", "Mastersets", "/mastersets"], ["search", "Suchen", "/suche"], ["albums", "Sammlung", "/bestand"]] as const).map(([ic, label, href]) => (
            <Pressable key={label} onPress={() => router.push(href as any)}
              style={{ flex: 1, backgroundColor: t.card, borderColor: t.line, borderWidth: 1, borderRadius: 16, paddingVertical: 12, alignItems: "center", gap: 4 }}>
              <Ionicons name={ic} size={22} color={t.accent} />
              <Text style={{ color: t.text, fontSize: 12, fontWeight: "700" }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ marginTop: 18 }}>
          <Segmented value={String(days)} onChange={(v) => setDays(Number(v))} options={[{ value: "7", label: "7 Tage" }, { value: "30", label: "30 Tage" }]} />
        </View>
        <H>Top-Mover: meine Sammlung</H>
        <MoverList rows={own} own />
        <H>Top-Mover: Gesamtmarkt</H>
        <Sub style={{ marginBottom: 8 }}>Cardmarket-Durchschnitt (7 bzw. 30 Tage, alle Zustände gemischt), Karten ab 5 €.</Sub>
        <MoverList rows={market} />
      </ScrollView>
    </Screen>
  );
}
