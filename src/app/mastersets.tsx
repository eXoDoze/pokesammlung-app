import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Chip, Empty, Field, Screen, Segmented, Sub } from "../components/ui";
import { setTitle } from "../lib/labels";
import { useApp } from "../lib/session";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/theme";

type Row = { id: string; name: string; have: number; total: number; logo: string | null; hay: string };

export default function Mastersets() {
  const { active } = useApp();
  const router = useRouter();
  const t = useTheme();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState("");
  const [showEmpty, setShowEmpty] = useState(false);
  const [empty, setEmpty] = useState<Row[]>([]);
  const [sort, setSort] = useState<"pct" | "missing">("pct");

  useFocusEffect(useCallback(() => {
    if (!active) return;
    (async () => {
      setBusy(true);
      const per = new Map<string, Set<string>>();
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from("collection_items").select("card_id, cards(set_id)")
          .eq("collection_id", active.id).eq("status", "owned").range(from, from + 999);
        for (const r of (data ?? []) as any[]) {
          const sid = r.cards?.set_id; if (!sid) continue;
          if (!per.has(sid)) per.set(sid, new Set());
          per.get(sid)!.add(r.card_id);
        }
        if (!data || data.length < 1000) break;
      }
      const ids = [...per.keys()];
      const out: Row[] = [];
      for (let i = 0; i < ids.length; i += 100) {
        const { data } = await supabase.from("sets").select("id,name_en,name_de,name_ja,name_ko,name_zh,region,card_count,logo_url,cover_url").in("id", ids.slice(i, i + 100));
        for (const s of (data ?? []) as any[]) {
          out.push({ id: s.id, name: setTitle(s, s.id), have: per.get(s.id)!.size, total: s.card_count ?? 0, logo: s.logo_url ?? s.cover_url ?? null, hay: [s.name_en, s.name_de, s.name_ja, s.name_ko, s.name_zh, s.id].filter(Boolean).join(" ").toLowerCase() });
        }
      }
      setRows(out); setBusy(false);
    })();
  }, [active]));

  // Sets ohne eigene Karten werden erst auf Wunsch geladen
  const toggleEmpty = async () => {
    const on = !showEmpty; setShowEmpty(on);
    if (!on || empty.length) return;
    const have = new Set(rows.map((r) => r.id));
    const out: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from("sets").select("id,name_en,name_de,name_ja,name_ko,name_zh,card_count,logo_url,cover_url").eq("hidden", false).range(from, from + 999);
      for (const s of (data ?? []) as any[]) {
        if (have.has(s.id)) continue;
        out.push({ id: s.id, name: setTitle(s, s.id), have: 0, total: s.card_count ?? 0, logo: s.logo_url ?? s.cover_url ?? null, hay: [s.name_en, s.name_de, s.name_ja, s.name_ko, s.name_zh, s.id].filter(Boolean).join(" ").toLowerCase() });
      }
      if (!data || data.length < 1000) break;
    }
    setEmpty(out);
  };
  const needle = q.trim().toLowerCase();
  const sorted = [...rows, ...(showEmpty ? empty : [])].filter((r) => !needle || r.hay.includes(needle)).sort((a, b) => sort === "pct"
    ? (b.total ? b.have / b.total : 0) - (a.total ? a.have / a.total : 0)
    : (a.total ? a.total - a.have : 1e9) - (b.total ? b.total - b.have : 1e9));

  return (
    <Screen>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Field label="" value={q} onChangeText={setQ} placeholder="Set suchen, z. B. Vending, Arceus, Crystal" autoCorrect={false} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <Chip label={showEmpty ? "Sets ohne Karten: eingeblendet" : "Sets ohne Karten ausgeblendet · einblenden"} on={showEmpty} onPress={toggleEmpty} />
        </View>
        <Segmented value={sort} onChange={(v) => setSort(v as "pct" | "missing")} options={[{ value: "pct", label: "Fortschritt" }, { value: "missing", label: "Wenig fehlt" }]} />
      </View>
      <FlatList data={sorted} keyExtractor={(r) => r.id} contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        ListEmptyComponent={<Empty text={busy ? "Lade …" : "Noch keine Karten in dieser Sammlung."} />}
        renderItem={({ item: r }) => {
          const pct = r.total ? Math.min(1, r.have / r.total) : 0;
          return (
            <Pressable onPress={() => router.push(`/set/${encodeURIComponent(r.id)}`)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.card, borderRadius: 14, borderColor: t.line, borderWidth: 1, padding: 12, marginBottom: 10 }}>
              <View style={{ width: 56, height: 40, alignItems: "center", justifyContent: "center" }}>
                {r.logo ? <Image source={{ uri: r.logo }} style={{ width: 56, height: 40 }} contentFit="contain" /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: t.text, fontSize: 14, fontWeight: "700" }}>{r.name}</Text>
                <View style={{ height: 6, backgroundColor: t.chip, borderRadius: 3, marginTop: 8 }}>
                  <View style={{ height: 6, width: `${pct * 100}%`, backgroundColor: pct >= 1 ? t.good : t.accent2, borderRadius: 3 }} />
                </View>
                <Sub>{r.have}{r.total ? ` / ${r.total}` : ""} Karten{r.total ? ` · ${Math.round(pct * 100)} %` : ""}</Sub>
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
