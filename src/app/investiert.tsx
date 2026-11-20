import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Empty, Panel, Pill, Screen, Segmented, Stat, Sub, Thumb, Txt } from "../components/ui";
import { Item, Value, fetchItems, valuesForItems } from "../lib/data";
import { cardName, conditionLabel, eur, isoToDe, setTitle } from "../lib/labels";
import { useApp } from "../lib/session";
import { useTheme } from "../lib/theme";

export default function InvestedScreen() {
  const { active } = useApp();
  const router = useRouter();
  const t = useTheme();
  const [items, setItems] = useState<Item[] | null>(null);
  const [vals, setVals] = useState<Map<string, Value>>(new Map());
  const [sort, setSort] = useState("paid");

  useFocusEffect(useCallback(() => {
    if (!active) return;
    (async () => {
      const all = await fetchItems(active.id, ["owned"]);
      const list = all.filter((i) => i.purchase_price != null);
      setItems(list);
      setVals(list.length ? await valuesForItems(list) : new Map());
    })();
  }, [active]));

  const rows = useMemo(() => {
    const r = (items ?? []).map((i) => {
      const paid = Number(i.purchase_price) * i.quantity;
      const v = vals.get(i.id);
      const now = v ? v.price * i.quantity : null;
      return { i, paid, now, diff: now != null ? now - paid : null };
    });
    r.sort((a, b) =>
      sort === "diff_asc" ? (a.diff ?? 1e12) - (b.diff ?? 1e12)
      : sort === "diff_desc" ? (b.diff ?? -1e12) - (a.diff ?? -1e12)
      : b.paid - a.paid);
    return r;
  }, [items, vals, sort]);

  const paidSum = rows.reduce((s, r) => s + r.paid, 0);
  const priced = rows.filter((r) => r.now != null);
  const nowSum = priced.reduce((s, r) => s + (r.now ?? 0), 0);
  const paidPriced = priced.reduce((s, r) => s + r.paid, 0);
  const diffSum = nowSum - paidPriced;

  return (
    <Screen>
      <Stack.Screen options={{ title: "Investiert" }} />
      <ScrollView contentContainerStyle={{ padding: 16, maxWidth: 760, width: "100%", alignSelf: "center" }}>
        {items === null && <Sub>Lade …</Sub>}
        {items && items.length === 0 && <Empty text="Noch keine Karte mit Kaufpreis. Trage beim Eintrag einen Kaufpreis ein." />}
        {items && items.length > 0 && (
          <>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Stat label="Investiert" value={eur(paidSum)} />
              <Stat label="Aktueller Wert" value={eur(nowSum)} />
              <Stat label="Gewinn/Verlust" value={eur(diffSum)} color={diffSum >= 0 ? t.good : t.bad} />
            </View>
            <Sub style={{ marginTop: 8 }}>{rows.length} Einträge mit Kaufpreis{priced.length < rows.length ? ` · ${rows.length - priced.length} ohne aktuellen Preis (nicht in Wert und Gewinn/Verlust)` : ""}.</Sub>
            <View style={{ marginTop: 10 }}>
              <Segmented value={sort} onChange={setSort} options={[{ value: "paid", label: "Kaufpreis" }, { value: "diff_asc", label: "Verlust zuerst" }, { value: "diff_desc", label: "Gewinn zuerst" }]} />
            </View>
            <Panel style={{ marginTop: 10 }}>
              {rows.map(({ i, paid, now, diff }) => (
                <Pressable key={i.id} onPress={() => router.push(`/item/${i.id}` as any)} style={{ flexDirection: "row", gap: 12, paddingVertical: 8, alignItems: "center" }}>
                  <Thumb uri={i.cards.image_url} w={44} />
                  <View style={{ flex: 1 }}>
                    <Txt bold numberOfLines={1}>{i.quantity > 1 ? `${i.quantity}× ` : ""}{cardName(i.cards)}</Txt>
                    <Sub numberOfLines={1}>{setTitle(i.cards.sets as any)}{i.cards.number ? ` · #${i.cards.number}` : ""} · {i.is_graded ? `${i.grading_company} ${i.grade}` : conditionLabel(i.condition)} · {i.language.toUpperCase()}</Sub>
                    <Sub numberOfLines={1}>Gekauft für {eur(Number(i.purchase_price))}{i.quantity > 1 ? ` je Stück (${eur(paid)})` : ""}{i.purchased_at ? ` · ${isoToDe(i.purchased_at)}` : ""}</Sub>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Txt bold>{now != null ? eur(now) : "–"}</Txt>
                    {diff != null ? <Pill label={`${diff >= 0 ? "+" : ""}${eur(diff)}`} tone={diff >= 0 ? "good" : "bad"} /> : null}
                  </View>
                </Pressable>
              ))}
            </Panel>
            <Sub style={{ marginTop: 8 }}>Antippen öffnet den Eintrag, dort kannst du den Kaufpreis prüfen und ändern.</Sub>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
