import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { Chip, Empty, Field, Pill, Row, Screen, Segmented, Sub, Thumb } from "../components/ui";
import { Slot, fetchSlots, moveSlot, placeItem } from "../lib/binder";
import { Item, fetchItems } from "../lib/data";
import { FINISH_LABEL, cardName, conditionLabel, setTitle } from "../lib/labels";
import { useApp } from "../lib/session";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/theme";

type Tab = "ohne" | "platz" | "sammlung";

// Karte für einen leeren Binder-Platz auswählen:
//  "Ohne Platz"  = Karten, die schon im Binder liegen, aber noch keinen Platz haben (einsortieren)
//  "Im Binder"   = schon einsortierte Karten (verschieben)
//  "Sammlung"    = Karten aus der Sammlung (auch aus anderen Sammlungen), neu in den Binder legen
export default function BinderKarteWaehlen() {
  const { binderId, page, slot } = useLocalSearchParams<{ binderId: string; page: string; slot: string }>();
  const { collections } = useApp();
  const router = useRouter();
  const t = useTheme();
  const [tab, setTab] = useState<Tab>("sammlung");
  const [tabSet, setTabSet] = useState(false);
  const [colId, setColId] = useState<string>("");   // "" = alle Sammlungen
  const [items, setItems] = useState<Item[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.from("binders").select("collection_id").eq("id", binderId).single().then(({ data }) => { setColId((data as any)?.collection_id ?? ""); setReady(true); });
  }, [binderId]);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      setBusy(true);
      try {
        const sl = await fetchSlots(binderId);
        setSlots(sl);
        if (!tabSet) { setTabSet(true); if (sl.some((x) => x.page == null)) setTab("ohne"); }
        const ids = colId ? [colId] : collections.map((c) => c.id);
        setItems((await Promise.all(ids.map((id) => fetchItems(id, ["owned"])))).flat());
      } catch (e: any) { Alert.alert("Fehler", e.message); } finally { setBusy(false); }
    })();
  }, [ready, colId, collections, binderId]);

  const placedCount = useMemo(() => { const m = new Map<string, number>(); for (const s of slots) m.set(s.item_id, (m.get(s.item_id) ?? 0) + 1); return m; }, [slots]);
  const nOhne = slots.filter((s) => s.page == null).length;
  const nPlatz = slots.length - nOhne;

  const match = (it: Item | null) => {
    const s = q.trim().toLowerCase();
    return !!it && (!s || [it.cards.name_en, it.cards.name_de, it.cards.name_ja, it.cards.number, it.cards.sets?.name_de, it.cards.sets?.name_en].some((x) => x?.toLowerCase().includes(s)));
  };
  const rows: { key: string; item: Item; slotRow?: Slot }[] = useMemo(() => {
    if (tab === "sammlung") return items.filter(match).map((i) => ({ key: i.id, item: i }));
    return slots.filter((s) => (tab === "ohne" ? s.page == null : s.page != null) && match(s.item))
      .sort((a, b) => (a.page ?? 0) - (b.page ?? 0) || (a.slot ?? 0) - (b.slot ?? 0))
      .map((s) => ({ key: s.id, item: s.item as Item, slotRow: s }));
  }, [tab, items, slots, q]);

  const pick = async (r: { item: Item; slotRow?: Slot }) => {
    const p = Number(page), sl = Number(slot);
    const err = r.slotRow ? await moveSlot(binderId, r.slotRow, p, sl, null) : await placeItem(binderId, p, sl, r.item.id);
    if (err) return Alert.alert("Binder", err);
    router.back();
  };

  return (
    <Screen>
      <View style={{ padding: 16, paddingBottom: 4, maxWidth: 760, width: "100%", alignSelf: "center" }}>
        <View style={{ marginBottom: 8 }}>
          <Segmented value={tab} onChange={(v) => setTab(v as Tab)} options={[{ value: "ohne", label: `Ohne Platz (${nOhne})` }, { value: "platz", label: `Im Binder (${nPlatz})` }, { value: "sammlung", label: "Sammlung" }]} />
        </View>
        {tab === "sammlung" && collections.length > 1 && (
          <Row>
            {collections.map((c) => <Chip key={c.id} label={c.name} on={colId === c.id} onPress={() => setColId(c.id)} />)}
            <Chip label="Alle Sammlungen" on={colId === ""} onPress={() => setColId("")} />
          </Row>
        )}
        <Field label="" value={q} onChangeText={setQ} placeholder="Karte suchen: Name, Nummer oder Set" />
        <Sub>Platz {Number(slot) + 1} auf Seite {Number(page) + 1} · {rows.length} Karten{tab === "platz" ? " · Tippen verschiebt die Karte hierher" : tab === "ohne" ? " · Tippen sortiert die Karte hier ein" : ""}</Sub>
      </View>
      <FlatList data={rows} keyExtractor={(r) => r.key} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: 16, paddingTop: 4, maxWidth: 760, width: "100%", alignSelf: "center" }}
        ListEmptyComponent={<Empty text={busy ? "Lade …" : tab === "ohne" ? "Keine Karten ohne Platz. Füge unter „Sammlung“ welche hinzu." : "Keine passende Karte."} />}
        renderItem={({ item: r }) => {
          const i = r.item, n = placedCount.get(i.id) ?? 0, sr = r.slotRow;
          return (
            <Pressable onPress={() => pick(r)} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", gap: 12, backgroundColor: t.card, borderRadius: 18, padding: 12, borderColor: t.line, borderWidth: 1 }}>
                <Thumb uri={i.cards.image_url} w={52} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: t.text, fontSize: 15, fontWeight: "800" }}>{i.quantity > 1 ? `${i.quantity}× ` : ""}{cardName(i.cards)}</Text>
                  <Text numberOfLines={1} style={{ color: t.sub, fontSize: 12, marginTop: 1 }}>{setTitle(i.cards.sets as any)}{i.cards.number ? ` · #${i.cards.number}` : ""}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    <Pill label={FINISH_LABEL[i.finish] ?? i.finish} />
                    <Pill label={i.is_graded ? `${i.grading_company} ${i.grade}` : conditionLabel(i.condition)} tone="accent" />
                    <Pill label={i.language.toUpperCase()} />
                    {sr && sr.page != null ? <Pill label={`jetzt S. ${sr.page + 1} · P. ${(sr.slot ?? 0) + 1}`} tone="good" /> : null}
                    {!sr && n > 0 ? <Pill label={`schon ${n}× im Binder`} tone={n >= i.quantity ? "bad" : "good"} /> : null}
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }} />
    </Screen>
  );
}
