import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Btn, Chip, Empty, Field, Panel, Row, Screen, Segmented, Sub } from "../components/ui";
import { Binder, Layout, fetchBinders, fetchSlots, layoutLabel, saveBinderOrder, slotsPerPage } from "../lib/binder";
import { Item, Value, valuesForItems } from "../lib/data";
import { eur } from "../lib/labels";
import { useApp } from "../lib/session";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/theme";

export default function BinderListe() {
  const { active, collections, session } = useApp();
  const router = useRouter();
  const t = useTheme();
  const [binders, setBinders] = useState<Binder[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [worth, setWorth] = useState<Map<string, number>>(new Map());
  const [sorting, setSorting] = useState(false);
  const [allCols, setAllCols] = useState(false);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [layout, setLayout] = useState<Layout>("3x3");
  const [pages, setPages] = useState("10");

  const load = useCallback(async () => {
    if (!active) return;
    setBusy(true);
    try {
      const b = await fetchBinders(allCols ? null : active.id);
      setBinders(b);
      // Karten und Wert je Binder
      const per = await Promise.all(b.map(async (x) => [x.id, await fetchSlots(x.id)] as const));
      setCounts(new Map(per.map(([id, sl]) => [id, sl.length] as const)));
      const items = new Map<string, Item>();
      for (const [, sl] of per) for (const sx of sl) if (sx.item) items.set(sx.item.id, sx.item);
      const vals: Map<string, Value> = await valuesForItems([...items.values()]);
      setWorth(new Map(per.map(([id, sl]) => [id, sl.reduce((sum, sx) => sum + (sx.item ? vals.get(sx.item.id)?.price ?? 0 : 0), 0)] as const)));
    } catch (e: any) { Alert.alert("Fehler", e.message); } finally { setBusy(false); }
  }, [active, allCols]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    if (!active || !session || !name.trim()) return;
    const n = Math.max(1, Math.min(500, parseInt(pages, 10) || 10));
    const { data, error } = await supabase.from("binders").insert({ owner_id: session.user.id, collection_id: active.id, name: name.trim(), layout, pages: n, sort_order: binders.reduce((m, x) => Math.max(m, x.sort_order ?? 0), 0) + 1 }).select("id").single();
    if (error) return Alert.alert("Fehler", error.message);
    setName(""); setCreating(false);
    if (data) router.push(`/binder-inhalt?binderId=${data.id}`);
  };
  const move = async (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= binders.length) return;
    const next = [...binders]; [next[i], next[j]] = [next[j], next[i]];
    setBinders(next);
    const err = await saveBinderOrder(next.map((x) => x.id));
    if (err) Alert.alert("Fehler", err);
  };
  const colName = (id: string | null) => collections.find((c) => c.id === id)?.name ?? "";

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, maxWidth: 760, width: "100%", alignSelf: "center" }} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}>
        <Row>
          <Chip label={`Nur „${active?.name ?? ""}“`} on={!allCols} onPress={() => setAllCols(false)} />
          <Chip label="Alle meine Binder" on={allCols} onPress={() => setAllCols(true)} />
        </Row>
        {binders.length === 0 && !busy && <Empty text="Noch kein Binder. Lege unten deinen ersten an." />}
        {binders.length > 1 && <View style={{ marginTop: 6 }}><Chip label={sorting ? "Sortieren beenden" : "Reihenfolge ändern"} on={sorting} onPress={() => setSorting(!sorting)} /></View>}
        {binders.map((b, bi) => {
          const n = counts.get(b.id) ?? 0;
          const per = slotsPerPage(b.layout);
          return (
            <Pressable key={b.id} onPress={() => (sorting ? undefined : router.push(`/binder-inhalt?binderId=${b.id}`))} style={{ marginTop: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.card, borderRadius: 18, padding: 14, borderColor: t.line, borderWidth: 1 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.chip, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="book" size={24} color={t.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: t.text, fontSize: 16, fontWeight: "800" }}>{b.name}</Text>
                  <Text style={{ color: t.sub, fontSize: 12, marginTop: 2 }}>
                    {layoutLabel(b.layout)} · {n} Karten · {eur(worth.get(b.id) ?? 0)}{per ? ` · ${b.pages} Seiten (${b.pages * per} Plätze)` : ""}{allCols && b.collection_id ? ` · ${colName(b.collection_id)}` : ""}
                  </Text>
                </View>
                {sorting ? (
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Pressable onPress={() => move(bi, -1)} hitSlop={6} style={{ padding: 6, opacity: bi === 0 ? 0.3 : 1 }}><Ionicons name="arrow-up" size={22} color={t.accent} /></Pressable>
                    <Pressable onPress={() => move(bi, 1)} hitSlop={6} style={{ padding: 6, opacity: bi === binders.length - 1 ? 0.3 : 1 }}><Ionicons name="arrow-down" size={22} color={t.accent} /></Pressable>
                  </View>
                ) : <Ionicons name="chevron-forward" size={20} color={t.sub} />}
              </View>
            </Pressable>
          );
        })}
        {creating ? (
          <Panel style={{ marginTop: 16 }}>
            <Field label="Name des Binders" value={name} onChangeText={setName} placeholder="z. B. Glurak-Binder, Base Set" />
            <Sub style={{ marginBottom: 6 }}>Aufbau</Sub>
            <Segmented value={layout} onChange={(v) => setLayout(v as Layout)} options={[{ value: "3x3", label: "3×3 (9 Plätze)" }, { value: "3x4", label: "4×3 (12 Plätze)" }]} />
            {<View style={{ marginTop: 10 }}><Field label="Anzahl Seiten (jederzeit erweiterbar)" value={pages} onChangeText={setPages} keyboardType="number-pad" /></View>}
            <Sub style={{ marginBottom: 6 }}>Das Raster wählst du passend zu deinem echten Binder; die Listenansicht kannst du später jederzeit im Binder umschalten. Ein Binder gehört zu „{active?.name}“, darf aber Karten aus all deinen Sammlungen enthalten.</Sub>
            <Btn title="Binder anlegen" onPress={create} disabled={!name.trim()} />
            <Btn kind="ghost" title="Abbrechen" onPress={() => setCreating(false)} />
          </Panel>
        ) : <View style={{ marginTop: 16 }}><Btn title="Neuer Binder" onPress={() => setCreating(true)} /></View>}
      </ScrollView>
    </Screen>
  );
}
