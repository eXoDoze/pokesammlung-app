import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, SectionList, View } from "react-native";
import { Chip, Empty, Field, Panel, Row, Screen, Sub, Txt } from "../../components/ui";
import { useApp } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";

type SetRow = { id: string; name_en: string | null; name_de: string | null; name_ja: string | null; name_ko: string | null; name_zh: string | null; series: string | null; region: string; release_date: string | null; card_count: number | null };
type Section = { title: string; region: string; newest: string; data: SetRow[]; open: boolean; sets: number; withMine: number };

const FLAG: Record<string, string> = { japan: "🇯🇵 ", korea: "🇰🇷 ", china: "🇨🇳 ", taiwan: "🇹🇼 " };
const setTitle = (s: SetRow) => s.name_de ?? s.name_en ?? s.name_ja ?? s.name_zh ?? s.name_ko ?? s.id;

export default function Sets() {
  const router = useRouter();
  const t = useTheme();
  const { active } = useApp();
  const [sets, setSets] = useState<SetRow[]>([]);
  const [mine, setMine] = useState<Map<string, number>>(new Map()); // set_id -> verschiedene Karten im Besitz
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<"all" | "international" | "japan" | "korea" | "china" | "taiwan">("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [openSeries, setOpenSeries] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      const all: SetRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from("sets").select("id,name_en,name_de,name_ja,name_ko,name_zh,series,region,release_date,card_count")
          .order("release_date", { ascending: false, nullsFirst: false }).range(from, from + 999);
        all.push(...((data ?? []) as SetRow[]));
        if (!data || data.length < 1000) break;
      }
      setSets(all); setBusy(false);
    })();
  }, []);

  // Fortschritt: je Set die Zahl verschiedener Karten in der aktiven Sammlung
  useFocusEffect(useCallback(() => {
    if (!active) { setMine(new Map()); return; }
    (async () => {
      const per = new Map<string, Set<string>>();
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from("collection_items").select("card_id, cards(set_id)")
          .eq("collection_id", active.id).range(from, from + 999);
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

  const searching = q.trim().length > 0;
  const sections: Section[] = useMemo(() => {
    const s = q.trim().toLowerCase();
    const filtered = sets.filter((x) =>
      (region === "all" || x.region === region) && (!onlyMine || mine.has(x.id)) &&
      (!s || [x.name_en, x.name_de, x.name_ja, x.name_ko, x.name_zh, x.series, x.id].some((n) => n?.toLowerCase().includes(s))));
    const by = new Map<string, SetRow[]>();
    for (const x of filtered) {
      const key = `${FLAG[x.region] ?? ""}${x.series ?? (x.region === "international" ? "Weitere" : "Sonstige")}`;
      if (!by.has(key)) by.set(key, []);
      by.get(key)!.push(x);
    }
    return [...by].map(([title, data]) => ({
      title, data, region: data[0].region, newest: data[0].release_date ?? "",
      open: searching || onlyMine || openSeries.has(title), sets: data.length, withMine: data.filter((d) => mine.has(d.id)).length,
    })).sort((a, b) => b.newest.localeCompare(a.newest));
  }, [sets, q, region, onlyMine, mine, openSeries, searching]);

  const toggle = (title: string) => setOpenSeries((cur) => { const n = new Set(cur); n.has(title) ? n.delete(title) : n.add(title); return n; });
  const total = sets.filter((x) => mine.has(x.id)).length;

  return (
    <Screen>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <Field label="Set suchen" value={q} onChangeText={setQ} placeholder="z. B. Basis-Set, Evolutions, 151" />
        <Row>
          <Chip label="Alle" on={region === "all"} onPress={() => setRegion("all")} />
          <Chip label="International" on={region === "international"} onPress={() => setRegion("international")} />
          <Chip label="Japan" on={region === "japan"} onPress={() => setRegion("japan")} />
          <Chip label="Korea" on={region === "korea"} onPress={() => setRegion("korea")} />
          <Chip label="China" on={region === "china"} onPress={() => setRegion("china")} />
          <Chip label="Taiwan" on={region === "taiwan"} onPress={() => setRegion("taiwan")} />
          <Chip label={`Nur Sets mit meinen Karten${total ? ` (${total})` : ""}`} on={onlyMine} onPress={() => setOnlyMine(!onlyMine)} />
        </Row>
      </View>
      <SectionList sections={sections} keyExtractor={(s) => s.id} stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        ListEmptyComponent={<Empty text={busy ? "Lade Sets …" : onlyMine ? "Noch keine Karten in dieser Sammlung." : "Keine Sets gefunden."} />}
        renderSectionHeader={({ section }) => (
          <Pressable onPress={() => toggle(section.title)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, marginTop: 6 }}>
            <Txt bold style={{ flex: 1 }}>{section.title}</Txt>
            <Sub>{section.withMine ? `${section.withMine}/` : ""}{section.sets} Sets  {section.open ? "▾" : "▸"}</Sub>
          </Pressable>
        )}
        renderItem={({ item: s, section }) => {
          if (!section.open) return null;
          const have = mine.get(s.id) ?? 0;
          const pct = s.card_count ? Math.min(1, have / s.card_count) : 0;
          return (
            <Pressable onPress={() => router.push(`/set/${encodeURIComponent(s.id)}`)} style={{ marginBottom: 8 }}>
              <Panel>
                <Txt bold>{setTitle(s)}</Txt>
                <Sub>{[s.name_de && s.name_en && s.name_de !== s.name_en ? s.name_en : null, s.release_date?.slice(0, 4), s.card_count ? `${s.card_count} Karten` : null].filter(Boolean).join(" · ")}</Sub>
                {have > 0 && (
                  <View style={{ marginTop: 8 }}>
                    <View style={{ height: 5, backgroundColor: t.chip, borderRadius: 3 }}>
                      <View style={{ height: 5, width: `${pct * 100}%`, backgroundColor: t.accent, borderRadius: 3 }} />
                    </View>
                    <Sub style={{ marginTop: 4 }}>{have}{s.card_count ? ` / ${s.card_count}` : ""} Karten</Sub>
                  </View>
                )}
              </Panel>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
