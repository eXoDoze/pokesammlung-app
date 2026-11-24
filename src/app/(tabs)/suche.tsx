import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View, useWindowDimensions } from "react-native";
import { Btn, Dropdown, Empty, Field, Screen, CardImg } from "../../components/ui";
import { cardName } from "../../lib/labels";
import { supabase } from "../../lib/supabase";
import { hueFor, useTheme } from "../../lib/theme";

type Hit = {
  id: string; number: string; name_en: string | null; name_de: string | null; name_ja: string | null; name_ko: string | null; name_zh: string | null;
  rarity: string | null; image_url: string | null; set_id: string; set_name: string; region: string; release_date: string | null; total: number;
};
const REGIONS = [
  { value: "all", label: "Alle Sprachen" },
  { value: "international", label: "🌍 Europäisch (DE/EN/FR/ES/IT/PT)" },
  { value: "japan", label: "🇯🇵 Japanisch" },
  { value: "korea", label: "🇰🇷 Koreanisch" },
  { value: "china", label: "🇨🇳 Chinesisch (vereinfacht)" },
];
const PAGE = 60;
const COLS = 3;
const GAP = 10;

export default function Suche() {
  const t = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const inner = Math.min(width, 760) - 32;
  const tileW = Math.floor((inner - GAP * (COLS - 1)) / COLS);

  const [q, setQ] = useState("");
  const [nr, setNr] = useState(""); // Pokédex-Nr. (nur Ziffern), Kartennummer (123/456) oder Promo-Code (BW83)
  const [region, setRegion] = useState("all");
  const [rows, setRows] = useState<Hit[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const reqId = useRef(0);
  const [levels, setLevels] = useState<Record<string, string>>({});

  const load = useCallback(async (term: string, reg: string, offset: number, num = "") => {
    const my = ++reqId.current;
    setBusy(true); setErr("");
    if (num) {
      // Suche über das Feld "Nummer"; ein zusätzlicher Name filtert die Treffer
      const slash = num.match(/^0*(\d+)\s*\/\s*(\d+)$/);
      let res: any;
      if (/^\d{1,4}$/.test(num)) res = await supabase.rpc("find_cards_by_dex", { p_dex: Number(num), p_region: reg });
      else if (slash) res = await supabase.rpc("find_cards_by_number", { p_num: slash[1], p_total: Number(slash[2]) });
      else res = await supabase.rpc("search_cards", { p_q: num, p_region: reg, p_limit: PAGE, p_offset: 0 });
      if (my !== reqId.current) return;
      setBusy(false);
      if (res.error) { setErr(res.error.message); return; }
      let list = ((res.data ?? []) as Hit[]).filter((h) => reg === "all" || h.region === reg);
      const w = term.toLowerCase();
      if (w.length >= 2) list = list.filter((h: any) => [h.name_en, h.name_de, h.name_ja, h.name_ko, h.name_zh, h.set_name].some((x) => x && String(x).toLowerCase().includes(w)));
      setRows(list); setTotal(list.length); setDone(true);
      return;
    }
    // Nummern wie "205/165" und Illustratoren werden serverseitig in search_cards gefunden (SQL 090)
    const { data, error } = await supabase.rpc("search_cards", { p_q: term, p_region: reg, p_limit: PAGE, p_offset: offset });
    if (my !== reqId.current) return; // veraltete Antwort
    setBusy(false);
    if (error) { setErr(error.message); return; }
    const list = (data ?? []) as Hit[];
    setRows((cur) => (offset === 0 ? list : [...cur, ...list]));
    setTotal(list[0]?.total ?? (offset === 0 ? 0 : total));
    setDone(list.length < PAGE);
  }, [total]);

  // Suche mit kurzer Verzögerung beim Tippen
  useEffect(() => {
    const term = q.trim(), num = nr.trim();
    if (num) { const timer = setTimeout(() => load(term, region, 0, num), 350); return () => clearTimeout(timer); }
    if (term.length < 2 && !/^v$/i.test(term)) { reqId.current++; setRows([]); setTotal(0); setDone(false); setBusy(false); setErr(""); return; }
    const timer = setTimeout(() => load(term, region, 0), 350);
    return () => clearTimeout(timer);
  }, [q, nr, region]); // eslint-disable-line react-hooks/exhaustive-deps

  // Level der angezeigten Karten nachladen (die Suchfunktion liefert es nicht mit)
  useEffect(() => {
    const need = rows.map((h) => h.id).filter((i) => !(i in levels)).slice(0, 100);
    if (!need.length) return;
    (async () => {
      const { data } = await supabase.from("cards").select("id,level").in("id", need);
      const add: Record<string, string> = {};
      for (const id of need) add[id] = "";
      for (const r of (data ?? []) as any[]) if (r.level) add[r.id] = String(r.level);
      setLevels((c) => ({ ...c, ...add }));
    })();
  }, [rows, levels]);

  const more = () => { if (!busy && !done && rows.length > 0) load(q.trim(), region, rows.length, nr.trim()); };
  const hint = q.trim().length < 2 && !/^v$/i.test(q.trim()) && !nr.trim() ? "Gib einen Pokémon-Namen, ein Set oder eine Nummer ein, z. B. Pikachu, 205/165 oder einen Illustrator wie Arita." : busy ? "Suche …" : err ? `Fehler: ${err}` : "Keine Karten gefunden.";

  return (
    <Screen>
      <View style={{ padding: 16, paddingBottom: 8, maxWidth: 760, width: "100%", alignSelf: "center" }}>
        <Field label="" value={q} onChangeText={setQ} placeholder="Name, Nummer (205/165) oder Illustrator" autoCorrect={false} autoCapitalize="none" />
        <Field label="" value={nr} onChangeText={setNr} placeholder="Nummer: Pokédex-Nr. (49), Kartennummer (123/456) oder Code (BW83)" autoCorrect={false} autoCapitalize="characters" />
        <Btn kind="ghost" title="📷 Karte scannen" onPress={() => router.push("/scan")} />
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
          <Dropdown label="Sprache" value={region} options={REGIONS} onChange={setRegion} />
          <Text style={{ color: t.sub, fontSize: 12, paddingBottom: 12, minWidth: 90, textAlign: "right" }}>{rows.length ? `${total.toLocaleString("de-DE")} Karten` : ""}</Text>
        </View>
      </View>
      <FlatList data={rows} key={COLS} numColumns={COLS} keyExtractor={(h) => h.id}
        columnWrapperStyle={{ gap: GAP, marginBottom: GAP, alignSelf: "center", width: inner }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onEndReached={more} onEndReachedThreshold={0.6}
        initialNumToRender={12} windowSize={7}
        ListEmptyComponent={<View><Empty text={hint} />{q.trim().length >= 2 && !busy ? <Btn title="Nicht gefunden? Eigene Karte anlegen" kind="ghost" onPress={() => router.push({ pathname: "/custom-card", params: { name: q.trim() } })} /> : null}</View>}
        ListFooterComponent={busy && rows.length > 0 ? <ActivityIndicator color={t.accent} style={{ marginVertical: 16 }} /> : (rows.length > 0 && !done ? <View style={{ alignSelf: "center", width: inner }}><Btn title={`Weitere laden (${rows.length} von ${total.toLocaleString("de-DE")})`} onPress={more} /></View> : rows.length > 0 && done ? <View style={{ alignSelf: "center", width: inner }}><Btn title="Karte fehlt? Eigene Karte anlegen" kind="ghost" onPress={() => router.push({ pathname: "/custom-card", params: { name: q.trim() } })} /></View> : undefined)}
        renderItem={({ item: h }) => {
          const hue = hueFor(h.set_id);
          return (
            <Pressable onPress={() => router.push(`/card/${encodeURIComponent(h.id)}`)} style={{ width: tileW }}>
              <View style={{ backgroundColor: t.card, borderRadius: 14, overflow: "hidden", borderColor: t.line, borderWidth: 1 }}>
                <View style={{ height: tileW * 1.38, alignItems: "center", justifyContent: "center", backgroundColor: `hsl(${hue}, 40%, 17%)` }}>
                  <CardImg uri={h.image_url} width="92%" height="92%" label={cardName(h)} radius={4} />
                </View>
                <View style={{ padding: 7 }}>
                  <Text numberOfLines={1} style={{ color: t.text, fontSize: 12, fontWeight: "700" }}>{cardName(h)}</Text>
                  <Text numberOfLines={1} style={{ color: t.sub, fontSize: 10.5, marginTop: 1 }}>{h.set_name}</Text>
                  <Text numberOfLines={1} style={{ color: t.sub, fontSize: 10.5 }}>{[h.number ? `#${h.number}` : null, h.rarity, levels[h.id] ? `Lv.${levels[h.id]}` : null].filter(Boolean).join(" · ")}</Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
