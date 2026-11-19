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
  { value: "international", label: "🌍 International (EN/DE)" },
  { value: "japan", label: "🇯🇵 Japanisch" },
  { value: "korea", label: "🇰🇷 Koreanisch" },
  { value: "china", label: "🇨🇳 Chinesisch (vereinfacht)" },
  { value: "taiwan", label: "🇹🇼 Chinesisch (traditionell)" },
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
  const [region, setRegion] = useState("all");
  const [rows, setRows] = useState<Hit[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const reqId = useRef(0);

  const load = useCallback(async (term: string, reg: string, offset: number) => {
    const my = ++reqId.current;
    setBusy(true); setErr("");
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
    const term = q.trim();
    if (term.length < 2) { reqId.current++; setRows([]); setTotal(0); setDone(false); setBusy(false); setErr(""); return; }
    const timer = setTimeout(() => load(term, region, 0), 350);
    return () => clearTimeout(timer);
  }, [q, region]); // eslint-disable-line react-hooks/exhaustive-deps

  const more = () => { if (!busy && !done && rows.length > 0) load(q.trim(), region, rows.length); };
  const hint = q.trim().length < 2 ? "Gib einen Pokémon-Namen ein, z. B. Pikachu, Glurak oder Charizard." : busy ? "Suche …" : err ? `Fehler: ${err}` : "Keine Karten gefunden.";

  return (
    <Screen>
      <View style={{ padding: 16, paddingBottom: 8, maxWidth: 760, width: "100%", alignSelf: "center" }}>
        <Field label="" value={q} onChangeText={setQ} placeholder="Pokémon suchen (Deutsch, Englisch, Japanisch …)" autoCorrect={false} autoCapitalize="none" />
        <Btn kind="ghost" title="📷 Karte scannen" onPress={() => router.push("/scan")} />
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
          <Dropdown label="Sprache" value={region} options={REGIONS} onChange={setRegion} />
          <Text style={{ color: t.sub, fontSize: 12, paddingBottom: 12, minWidth: 90, textAlign: "right" }}>{rows.length ? `${total.toLocaleString("de-DE")} Karten` : ""}</Text>
        </View>
      </View>
      <FlatList data={rows} key={COLS} numColumns={COLS} keyExtractor={(h) => h.id}
        columnWrapperStyle={{ gap: GAP, marginBottom: GAP, alignSelf: "center", width: inner }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled" onEndReached={more} onEndReachedThreshold={0.6}
        initialNumToRender={12} windowSize={7}
        ListEmptyComponent={<View><Empty text={hint} />{q.trim().length >= 2 && !busy ? <Btn title="Nicht gefunden? Eigene Karte anlegen" kind="ghost" onPress={() => router.push({ pathname: "/custom-card", params: { name: q.trim() } })} /> : null}</View>}
        ListFooterComponent={busy && rows.length > 0 ? <ActivityIndicator color={t.accent} style={{ marginVertical: 16 }} /> : (rows.length > 0 && done ? <View style={{ alignSelf: "center", width: inner }}><Btn title="Karte fehlt? Eigene Karte anlegen" kind="ghost" onPress={() => router.push({ pathname: "/custom-card", params: { name: q.trim() } })} /></View> : undefined)}
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
                  <Text numberOfLines={1} style={{ color: t.sub, fontSize: 10.5 }}>{[h.number ? `#${h.number}` : null, h.rarity].filter(Boolean).join(" · ")}</Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
