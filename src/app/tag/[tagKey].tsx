import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, View, useWindowDimensions } from "react-native";
import { CardImg, Chip, Empty, Field, Row, Screen, Sub, Txt } from "../../components/ui";
import { cardName, setTitle, tagByKey } from "../../lib/labels";
import { supabase } from "../../lib/supabase";

type Row = { id: string; number: string; name_en: string | null; name_de: string | null; name_ja: string | null; name_ko: string | null; name_zh: string | null; image_url: string | null; sets: any };

// Alle Karten eines Typs (z. B. Tag Team, SIR) über alle Sets hinweg
export default function TagScreen() {
  const { tagKey: key } = useLocalSearchParams<{ tagKey: string }>();
  const tag = tagByKey(String(key));
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<string>("international");   // Sprachfilter: Karten nach Herkunft des Sets

  useEffect(() => {
    if (!tag) return;
    (async () => {
      setBusy(true);
      let query = supabase.from("cards")
        .select("id,number,name_en,name_de,name_ja,name_ko,name_zh,image_url,sets!inner(name_en,name_de,name_ja,name_ko,name_zh,region,release_date)")
        .limit(600);
      if (region !== "all") query = query.eq("sets.region", region); else query = query.neq("sets.region", "taiwan");
      const pats = Array.isArray(tag.pat) ? tag.pat : [tag.pat];
      if (pats.length === 1) query = tag.op === "like" ? query.like(tag.col, pats[0]) : query.ilike(tag.col, pats[0]);
      else query = query.or(pats.map((p) => `${tag.col}.${tag.op}.${p.replace(/%/g, "*")}`).join(","));
      const { data } = await query;
      const list = ((data ?? []) as any as Row[]).sort((a, b) => String(b.sets?.release_date ?? "").localeCompare(String(a.sets?.release_date ?? "")));
      setRows(list); setBusy(false);
    })();
  }, [key, region]);

  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => rows.filter((r) => !needle || [r.name_en, r.name_de, r.name_ja, r.name_ko, r.name_zh, r.number, setTitle(r.sets)].filter(Boolean).join(" ").toLowerCase().includes(needle)), [rows, needle]);
  const cols = width > 900 ? 5 : 3;
  const inner = Math.min(width, 900) - 32;
  const w = (inner - (cols - 1) * 8) / cols;

  return (
    <Screen>
      <Stack.Screen options={{ title: tag?.label ?? "Typ" }} />
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Txt bold>{busy ? "Lade …" : `${shown.length} Karten`}{rows.length >= 600 ? " (die ersten 600)" : ""}</Txt>
        <Row>
          {[["all", "Alle"], ["international", "Englisch/Deutsch"], ["japan", "Japanisch"], ["korea", "Koreanisch"], ["china", "Chinesisch"]].map(([k, l]) => (
            <Chip key={k} label={l} on={region === k} onPress={() => setRegion(k)} />
          ))}
        </Row>
        <Field label="" value={q} onChangeText={setQ} placeholder="Filtern: Name, Nummer oder Set" autoCorrect={false} />
      </View>
      <FlatList data={shown} keyExtractor={(r) => r.id} numColumns={cols} key={cols}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }} columnWrapperStyle={{ gap: 8, alignSelf: "center", width: inner }}
        ListEmptyComponent={<Empty text={busy ? "Lade …" : "Keine Karten gefunden."} />}
        renderItem={({ item: r }) => (
          <Pressable onPress={() => router.push(`/card/${encodeURIComponent(r.id)}`)} style={{ width: w, marginBottom: 10 }}>
            <CardImg uri={r.image_url} width={w} height={w * 1.4} label={cardName(r)} sub={r.number} />
            <Sub numberOfLines={1}>{cardName(r)}</Sub>
            <Sub numberOfLines={1}>{setTitle(r.sets)} · {r.number}</Sub>
          </Pressable>
        )}
      />
    </Screen>
  );
}
