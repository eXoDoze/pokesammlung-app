import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Chip, Empty, H, Panel, Row, Screen, Sub, Thumb, Txt } from "../../components/ui";
import { fetchItems, valueHistory, valuesForItems } from "../../lib/data";
import { cardName, eur, pct } from "../../lib/labels";
import { useApp } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";

type Mover = { kind: string; card_id: string; name_en: string | null; image_url: string | null; price_then: number; price_now: number; change_pct: number; aus_verlauf?: boolean; condition?: string; is_graded?: boolean; grading_company?: string; grade?: number; then_at?: string; now_at?: string };
const dm = (s?: string) => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.` : "");

function MoverList({ rows, own }: { rows: Mover[]; own?: boolean }) {
  const t = useTheme();
  const router = useRouter();
  if (!rows.length) return <Empty text={own ? "Noch keine Daten: Zustandspreise brauchen zwei Messzeitpunkte im gewählten Zeitraum." : "Noch keine Daten."} />;
  return (
    <Panel>
      {rows.map((r, i) => (
        <Pressable key={r.card_id + i + (r.condition ?? "")} onPress={() => router.push(`/card/${encodeURIComponent(r.card_id)}`)}
          style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, gap: 10 }}>
          <Thumb uri={r.image_url} w={34} />
          <View style={{ flex: 1 }}>
            <Txt>{r.name_en}</Txt>
            <Sub>{own && r.condition ? `${r.is_graded ? `${r.grading_company} ${r.grade}` : r.condition} · ` : ""}{eur(r.price_then)}{r.then_at ? ` am ${dm(r.then_at)}` : ""} → {eur(r.price_now)}{r.now_at ? ` am ${dm(r.now_at)}` : ""}</Sub>
          </View>
          <Txt bold style={{ color: r.change_pct >= 0 ? t.good : t.bad }}>{pct(r.change_pct)}</Txt>
        </Pressable>
      ))}
    </Panel>
  );
}

export default function Start() {
  const { active } = useApp();
  const [days, setDays] = useState(7);
  const [sum, setSum] = useState<{ count: number; invested: number; value: number; missing: number; own: number; manual: number } | null>(null);
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
        let invested = 0, value = 0, missing = 0, count = 0, ownPrice = 0, manual = 0;
        for (const i of items) {
          count += i.quantity;
          if (i.purchase_price != null) invested += i.purchase_price * i.quantity;
          const v = vals.get(i.id);
          if (v) { value += v.price * i.quantity; if (v.kind === "zustand") ownPrice += 1; if (v.kind === "eigen") manual += 1; } else missing += 1;
        }
        setSum({ count, invested, value, missing, own: ownPrice, manual });
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
  const diff = sum ? sum.value - sum.invested : 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}>
        <Sub>{active ? `Sammlung: ${active.name}` : "Keine Sammlung"}</Sub>
        {sum && (
          <Panel style={{ marginTop: 8 }}>
            <Sub>Sammlungswert</Sub>
            <Txt bold style={{ fontSize: 32, marginTop: 2 }}>{eur(sum.value)}</Txt>
            <Txt style={{ color: diff >= 0 ? t.good : t.bad, marginBottom: 10 }}>
              {diff >= 0 ? "▲" : "▼"} {eur(Math.abs(diff))} gegenüber investiertem Geld
            </Txt>
            {hist.length >= 2 ? (
              <View>
                <View style={{ flexDirection: "row", alignItems: "flex-end", height: 56, gap: 2 }}>
                  {(() => {
                    const lo = Math.min(...hist.map((h) => h.value)), hi = Math.max(...hist.map((h) => h.value));
                    return hist.map((h) => (
                      <View key={h.date} style={{ flex: 1, backgroundColor: t.accent, borderRadius: 2,
                        height: 8 + (hi === lo ? 24 : ((h.value - lo) / (hi - lo)) * 40) }} />
                    ));
                  })()}
                </View>
                <Sub style={{ marginTop: 4 }}>Marktwert, letzte {hist.length} Tage ({hist[0].date.slice(5)} bis {hist[hist.length - 1].date.slice(5)})</Sub>
              </View>
            ) : (
              <Sub>Der Verlauf entsteht ab heute aus den täglichen Preisen und erscheint nach dem zweiten Tag.</Sub>
            )}
            <View style={{ height: 12 }} />
            <Row>
              <View style={{ width: "50%", marginBottom: 10 }}><Sub>Karten</Sub><Txt bold>{sum.count}</Txt></View>
              <View style={{ width: "50%", marginBottom: 10 }}><Sub>Investiert</Sub><Txt bold>{eur(sum.invested)}</Txt></View>
              <View style={{ width: "50%" }}><Sub>Aktueller Wert</Sub><Txt bold>{eur(sum.value)}</Txt></View>
              <View style={{ width: "50%" }}><Sub>Gewinn / Verlust</Sub><Txt bold style={{ color: diff >= 0 ? t.good : t.bad }}>{eur(diff)}</Txt></View>
            </Row>
            <Sub style={{ marginTop: 8 }}>
              {sum.own} Einträge mit Zustandspreis, übrige mit Marktwert (Cardmarket-Trend, Mischzustände).
              {sum.manual > 0 ? ` ${sum.manual} Einträge mit selbst gesetztem Wert.` : ""}{sum.missing > 0 ? ` ${sum.missing} Einträge ohne Preis, sie fehlen in der Summe.` : ""}
            </Sub>
          </Panel>
        )}
        <Row>
          <View style={{ marginTop: 16 }} />
        </Row>
        <Row>
          <Chip label="7 Tage" on={days === 7} onPress={() => setDays(7)} />
          <Chip label="30 Tage" on={days === 30} onPress={() => setDays(30)} />
        </Row>
        <H>Meine Sammlung (nach Zustand)</H>
        <MoverList rows={own} own />
        <H>Gesamtmarkt</H>
        <Sub style={{ marginBottom: 6 }}>Cardmarket-Trend über alle Zustände gemischt, Karten ab 5 €. Ohne eigenen Verlauf wird der 7-/30-Tage-Durchschnitt als Vergleich genutzt.</Sub>
        <MoverList rows={market} />
      </ScrollView>
    </Screen>
  );
}
