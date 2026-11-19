import { CameraView, useCameraPermissions } from "expo-camera";
import { Stack, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Btn, CardImg, Field, Screen, Segmented, Sub } from "../components/ui";
import { Hit, OcrLine, Parsed, parseOcr, scoreHit } from "../lib/scan";
import { cardName } from "../lib/labels";
import { useApp } from "../lib/session";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Texterkennung läuft nur auf dem Handy (nicht im Browser)
const ML: any = Platform.OS === "web" ? null : require("@react-native-ml-kit/text-recognition");

type Mode = "auto" | "zh" | "ko";
type Cand = { hit: Hit; score: number };

const REGION_LANG: Record<string, string> = { japan: "ja", korea: "ko", china: "zh-cn", taiwan: "zh-tw" };

async function readText(uri: string, mode: Mode): Promise<OcrLine[]> {
  if (!ML) return [];
  const T = ML.TextRecognitionScript ?? {};
  const lines: OcrLine[] = [];
  const run = async (script?: any) => {
    try {
      const r = script ? await ML.default.recognize(uri, script) : await ML.default.recognize(uri);
      for (const b of r.blocks ?? []) for (const l of b.lines ?? []) lines.push({ text: l.text, h: l.frame?.height ?? l.bounds?.height });
    } catch { /* Schrift nicht verfügbar: ignorieren */ }
  };
  await run(); // Latein
  if (mode === "auto") await run(T.JAPANESE);
  if (mode === "zh") await run(T.CHINESE);
  if (mode === "ko") await run(T.KOREAN);
  const seen = new Set<string>();
  return lines.filter((l) => (seen.has(l.text) ? false : (seen.add(l.text), true)));
}

async function search(term: string): Promise<Hit[]> {
  const { data } = await supabase.rpc("search_cards", { p_q: term, p_region: "all", p_limit: 40, p_offset: 0 });
  return (data ?? []) as Hit[];
}

async function byNumber(num: string, total: string): Promise<Hit[]> {
  if (!/^\d+$/.test(total)) return [];
  const { data } = await supabase.rpc("find_cards_by_number", { p_num: num, p_total: Number(total) });
  return (data ?? []) as Hit[];
}

async function findCandidates(p: Parsed): Promise<Cand[]> {
  const queries = [...p.tokens.slice(0, 4), ...p.codes.slice(0, 2)];
  const found = new Map<string, { hit: Hit; n: number }>();
  const [results, numResults] = await Promise.all([
    Promise.all(queries.map((q) => search(q))),
    Promise.all(p.numbers.slice(0, 3).map((n) => byNumber(n.num, n.total ?? ""))),
  ]);
  const numIds = new Set<string>();
  numResults.forEach((hits) => hits.forEach((h) => { numIds.add(h.id); if (!found.has(h.id)) found.set(h.id, { hit: h, n: 0 }); }));
  results.forEach((hits) => {
    const seen = new Set<string>();
    for (const h of hits) {
      if (seen.has(h.id)) continue; seen.add(h.id);
      const cur = found.get(h.id);
      if (cur) cur.n++; else found.set(h.id, { hit: h, n: 1 });
    }
  });
  return [...found.values()].map(({ hit, n }) => ({ hit, score: scoreHit(hit, p, n) + (numIds.has(hit.id) ? 12 : 0) })).sort((a, b) => b.score - a.score).slice(0, 12);
}

export default function Scan() {
  const t = useTheme();
  const router = useRouter();
  const { active } = useApp();
  const [perm, askPerm] = useCameraPermissions();
  const cam = useRef<any>(null);
  const [mode, setMode] = useState<Mode>("auto");
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<string[] | null>(null);
  const [cands, setCands] = useState<Cand[]>([]);
  const [manual, setManual] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(0);
  const insets = useSafeAreaInsets();

  const evaluate = async (ol: OcrLine[]) => {
    const p = parseOcr(ol);
    const ls = ol.map((o) => o.text);
    setLines(ls);
    setManual(p.tokens.slice(0, 2).join(" "));
    setCands(await findCandidates(p));
  };

  const snap = async () => {
    if (!cam.current || busy) return;
    setBusy(true); setMsg("");
    try {
      const pic = await cam.current.takePictureAsync({ quality: 0.9 });
      await evaluate(await readText(pic.uri, mode));
    } catch (e: any) { setMsg(e?.message ?? "Foto fehlgeschlagen"); }
    setBusy(false);
  };

  const manualSearch = async () => {
    if (manual.trim().length < 2) return;
    setBusy(true);
    const hits = await search(manual.trim());
    const p = parseOcr(lines ?? []);
    setCands(hits.map((h) => ({ hit: h, score: scoreHit(h, p, 1) })).sort((a, b) => b.score - a.score).slice(0, 20));
    setBusy(false);
  };

  const quickAdd = async (h: Hit) => {
    if (!active) { setMsg("Keine Sammlung aktiv"); return; }
    setBusy(true); setMsg("");
    const { data: vs } = await supabase.from("card_variants").select("id,finish,subtype").eq("card_id", h.id);
    const list = (vs ?? []) as any[];
    const v = list.find((x) => x.finish === "non_holo" && !/1st|first|shadowless/i.test(x.subtype ?? "")) ?? list[0];
    const { error } = await supabase.from("collection_items").insert({
      collection_id: active.id, card_id: h.id, variant_id: v?.id ?? null,
      language: REGION_LANG[h.region] ?? "de", finish: v?.finish ?? "non_holo", condition: "NM", quantity: 1,
    });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setAdded((a) => [...a, cardName(h)]);
    setLines(null); setCands([]); setManual("");
    setMsg(`✓ ${cardName(h)} hinzugefügt – nächste Karte`);
  };

  if (Platform.OS === "web") {
    return <Screen><Stack.Screen options={{ title: "Karte scannen" }} /><Sub style={{ padding: 16 }}>Der Scanner funktioniert nur in der App auf dem Handy. Im Browser kannst du die Suche benutzen.</Sub></Screen>;
  }
  if (!perm) return <Screen><ActivityIndicator style={{ marginTop: 40 }} color={t.accent} /></Screen>;
  if (!perm.granted) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Karte scannen" }} />
        <View style={{ padding: 16 }}>
          <Sub style={{ marginBottom: 12 }}>Für den Scanner braucht die App Zugriff auf die Kamera.</Sub>
          <Btn title="Kamera erlauben" onPress={askPerm} />
        </View>
      </Screen>
    );
  }

  const showResults = lines !== null;
  return (
    <Screen>
      <Stack.Screen options={{ title: added.length ? `Scanner · ${added.length} hinzugefügt` : "Karte scannen" }} />
      {!showResults && (
        <View style={{ flex: 1 }}>
          <CameraView ref={cam} style={{ flex: 1 }} facing="back" zoom={zoom} enableTorch={torch} autofocus="on" />
          <View pointerEvents="none" style={{ position: "absolute", top: 24, left: 0, right: 0, bottom: 150, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: "72%", aspectRatio: 0.716, borderWidth: 2, borderColor: t.accent, borderRadius: 14 }} />
          </View>
          <View style={{ padding: 12, backgroundColor: t.card, gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><Btn kind="ghost" title={torch ? "💡 Licht aus" : "💡 Licht an"} onPress={() => setTorch((x) => !x)} /></View>
              <View style={{ flex: 1 }}><Btn kind="ghost" title="− Zoom" onPress={() => setZoom((z) => Math.max(0, Math.round((z - 0.1) * 10) / 10))} /></View>
              <View style={{ flex: 1 }}><Btn kind="ghost" title={`+ Zoom${zoom ? ` (${Math.round(zoom * 100)}%)` : ""}`} onPress={() => setZoom((z) => Math.min(0.6, Math.round((z + 0.1) * 10) / 10))} /></View>
            </View>
            <Segmented value={mode} onChange={(v) => setMode(v as Mode)} options={[{ value: "auto", label: "EN/DE/JA" }, { value: "zh", label: "Chinesisch" }, { value: "ko", label: "Koreanisch" }]} />
            {!!msg && <Text style={{ color: t.sub, fontSize: 12, textAlign: "center" }}>{msg}</Text>}
            <Btn title={busy ? "Erkenne …" : "Karte fotografieren"} onPress={snap} busy={busy} />
          </View>
        </View>
      )}
      {showResults && (
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Field label="Suchbegriff (anpassen, wenn nichts passt)" value={manual} onChangeText={setManual} onSubmitEditing={manualSearch} autoCorrect={false} />
          <Btn kind="ghost" title="Suchen" onPress={manualSearch} />
          {busy && <ActivityIndicator color={t.accent} style={{ marginVertical: 12 }} />}
          {!busy && cands.length === 0 && <Sub style={{ marginVertical: 12 }}>Keine passende Karte gefunden. Passe den Suchbegriff an oder fotografiere noch einmal.</Sub>}
          {cands.map(({ hit: h }) => (
            <View key={h.id} style={{ flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: t.card, borderColor: t.line, borderWidth: 1, borderRadius: 14, padding: 10, marginBottom: 10 }}>
              <Pressable onPress={() => router.push(`/card/${encodeURIComponent(h.id)}`)}>
                <CardImg uri={h.image_url} width={56} height={78} label={cardName(h)} radius={4} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={{ color: t.text, fontSize: 14, fontWeight: "700" }}>{cardName(h)}</Text>
                <Text numberOfLines={1} style={{ color: t.sub, fontSize: 12 }}>{h.set_name}</Text>
                <Text numberOfLines={1} style={{ color: t.sub, fontSize: 12 }}>{[h.number ? `#${h.number}` : null, h.rarity].filter(Boolean).join(" · ")}</Text>
              </View>
              <Pressable onPress={() => quickAdd(h)} style={{ backgroundColor: t.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
                <Text style={{ color: t.accentText, fontWeight: "700" }}>+ Hinzufügen</Text>
              </Pressable>
            </View>
          ))}
          <Btn kind="ghost" title="Zurück zur Kamera" onPress={() => { setLines(null); setCands([]); setMsg(""); }} />
          <Sub style={{ marginTop: 12 }}>Erkannter Text:</Sub>
          <Text style={{ color: t.sub, fontSize: 11 }}>{(lines ?? []).join(" · ") || "(nichts erkannt)"}</Text>
        </ScrollView>
      )}
    </Screen>
  );
}
