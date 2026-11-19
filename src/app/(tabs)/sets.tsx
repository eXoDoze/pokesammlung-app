import { setNative, setTitle } from "../../lib/labels";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View, useWindowDimensions } from "react-native";
import { Chip, Dropdown, Empty, Field, Row, Screen } from "../../components/ui";
import { useApp } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { hueFor, useTheme } from "../../lib/theme";

type SetRow = { id: string; name_en: string | null; name_de: string | null; name_ja: string | null; name_ko: string | null; name_zh: string | null; series: string | null; region: string; release_date: string | null; card_count: number | null; logo_url?: string | null; cover_url?: string | null };

const REGIONS = [
  { value: "all", label: "Alle Sprachen" },
  { value: "international", label: "🌍 International (EN/DE)" },
  { value: "japan", label: "🇯🇵 Japanisch" },
  { value: "korea", label: "🇰🇷 Koreanisch" },
  { value: "china", label: "🇨🇳 Chinesisch (vereinfacht)" },
  { value: "taiwan", label: "🇹🇼 Chinesisch (traditionell)" },
];
const COLS = 2;
const GAP = 12;

export default function Sets() {
  const router = useRouter();
  const t = useTheme();
  const { active } = useApp();
  const { width } = useWindowDimensions();
  const inner = Math.min(width, 760) - 32;
  const tileW = Math.floor((inner - GAP * (COLS - 1)) / COLS);

  const [sets, setSets] = useState<SetRow[]>([]);
  const [mine, setMine] = useState<Map<string, number>>(new Map());
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");
  const [series, setSeries] = useState("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      const all: SetRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from("sets").select("*")
          .order("release_date", { ascending: false, nullsFirst: false }).range(from, from + 999);
        all.push(...((data ?? []) as SetRow[]));
        if (!data || data.length < 1000) break;
      }
      setSets(all); setBusy(false);
    })();
  }, []);

  useFocusEffect(useCallback(() => {
    if (!active) { setMine(new Map()); return; }
    (async () => {
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
      setMine(new Map([...per].map(([k, v]) => [k, v.size])));
    })();
  }, [active]));

  const byRegion = useMemo(() => sets.filter((x) => region === "all" || x.region === region), [sets, region]);
  const seriesOptions = useMemo(() => {
    const c = new Map<string, number>();
    for (const x of byRegion) { const k = x.series ?? "Sonstige"; c.set(k, (c.get(k) ?? 0) + 1); }
    return [{ value: "all", label: "Alle Serien", sub: String(byRegion.length) },
      ...[...c].map(([k, n]) => ({ value: k, label: k, sub: String(n) }))];
  }, [byRegion]);
  useEffect(() => { if (series !== "all" && !seriesOptions.some((o) => o.value === series)) setSeries("all"); }, [seriesOptions, series]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return byRegion.filter((x) =>
      (series === "all" || (x.series ?? "Sonstige") === series) && (!onlyMine || mine.has(x.id)) &&
      (!s || [x.name_en, x.name_de, x.name_ja, x.name_ko, x.name_zh, x.series, x.id].some((n) => n?.toLowerCase().includes(s))));
  }, [byRegion, series, onlyMine, mine, q]);
  const total = sets.filter((x) => mine.has(x.id)).length;

  return (
    <Screen>
      <View style={{ padding: 16, paddingBottom: 8, maxWidth: 760, width: "100%", alignSelf: "center" }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Dropdown label="Sprache" value={region} options={REGIONS} onChange={setRegion} />
          <Dropdown label="Serie" value={series} options={seriesOptions} onChange={setSeries} />
        </View>
        <View style={{ marginTop: 10 }}>
          <Field label="" value={q} onChangeText={setQ} placeholder="Set suchen, z. B. 151, Evolutions, Gem Pack" />
        </View>
        <Row>
          <Chip label={`Nur Sets mit meinen Karten${total ? ` (${total})` : ""}`} on={onlyMine} onPress={() => setOnlyMine(!onlyMine)} />
          <Text style={{ color: t.sub, fontSize: 12, alignSelf: "center", marginLeft: 6, marginBottom: 6 }}>{list.length} Sets</Text>
        </Row>
      </View>
      <FlatList data={list} key={COLS} numColumns={COLS} keyExtractor={(s) => s.id}
        columnWrapperStyle={{ gap: GAP, marginBottom: GAP, alignSelf: "center", width: inner }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        initialNumToRender={12} windowSize={7}
        ListEmptyComponent={<Empty text={busy ? "Lade Sets …" : onlyMine ? "Noch keine Karten in dieser Sammlung." : "Keine Sets gefunden."} />}
        renderItem={({ item: s }) => {
          const have = mine.get(s.id) ?? 0;
          const pct = s.card_count ? Math.min(1, have / s.card_count) : 0;
          const img = s.logo_url ?? s.cover_url ?? null;
          const code = s.id.includes(":") ? s.id.split(":")[1] : s.id;
          const hue = hueFor(s.id);
          return (
            <Pressable onPress={() => router.push(`/set/${encodeURIComponent(s.id)}`)} style={{ width: tileW }}>
              <View style={{ backgroundColor: t.card, borderRadius: 18, overflow: "hidden", borderColor: have > 0 ? t.accent : t.line, borderWidth: have > 0 ? 1.5 : 1 }}>
                <View style={{ height: tileW * 0.72, alignItems: "center", justifyContent: "center", backgroundColor: `hsl(${hue}, 45%, 19%)` }}>
                  {img
                    ? <Image source={{ uri: img }} style={{ width: "84%", height: "84%" }} contentFit="contain" />
                    : <Text style={{ color: `hsl(${hue}, 85%, 82%)`, fontSize: 24, fontWeight: "800", textAlign: "center", paddingHorizontal: 8 }} numberOfLines={2}>{code}</Text>}
                  {have > 0 && (
                    <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: t.accent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color: t.accentText, fontSize: 11, fontWeight: "700" }}>{have}{s.card_count ? `/${s.card_count}` : ""}</Text>
                    </View>
                  )}
                </View>
                <View style={{ padding: 10, minHeight: 64 }}>
                  <Text numberOfLines={2} style={{ color: t.text, fontSize: 14, fontWeight: "700" }}>{setTitle(s, s.id)}</Text>
                  {setNative(s) ? <Text numberOfLines={1} style={{ color: t.sub, fontSize: 11, marginTop: 1 }}>{setNative(s)}</Text> : null}
                  <Text style={{ color: t.sub, fontSize: 12, marginTop: 3 }}>{[s.release_date?.slice(0, 4), s.card_count ? `${s.card_count} Karten` : null].filter(Boolean).join(" · ")}</Text>
                </View>
                {have > 0 && (
                  <View style={{ height: 4, backgroundColor: t.chip }}>
                    <View style={{ height: 4, width: `${pct * 100}%`, backgroundColor: t.accent2 }} />
                  </View>
                )}
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
