import { CameraView, useCameraPermissions } from "expo-camera";
import { Stack, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Btn, CardImg, Field, H, Screen, Segmented, Sub } from "../components/ui";
import { FormValues, ItemForm } from "../components/ItemForm";
import type { Variant } from "../lib/data";
import { Hit, OcrLine, Parsed, allowedRegions, parseOcr, scoreHit } from "../lib/ocrParser";
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

// Suche je erlaubter Region (so verdrängen viele internationale Karten gleichen Namens nicht die gesuchte asiatische Karte)
async function search(term: string, regions: string[]): Promise<Hit[]> {
  const res = await Promise.all(regions.map((r) => supabase.rpc("search_cards", { p_q: term, p_region: r, p_limit: 60, p_offset: 0 })));
  return res.flatMap((x) => (x.data ?? []) as Hit[]);
}

async function byNumber(num: string, total: string): Promise<Hit[]> {
  if (!/^\d+$/.test(total)) return [];
  const { data } = await supabase.rpc("find_cards_by_number", { p_num: num, p_total: Number(total) });
  return (data ?? []) as Hit[];
}

// Alte japanische Karten tragen unten rechts die Pokédex-Nummer ("No. 049"): damit lassen sich auch Karten finden, deren Name nicht erkannt wurde
async function byDex(dex: number | undefined, japanese: boolean | undefined): Promise<Hit[]> {
  if (!dex) return [];
  const { data } = await supabase.rpc("find_cards_by_dex", { p_dex: dex, p_region: japanese ? "japan" : "all" });
  return (data ?? []) as Hit[];
}

async function findCandidates(p: Parsed): Promise<Cand[]> {
  const regions = allowedRegions(p);
  const regionOk = (hits: Hit[]) => hits.filter((h) => regions.includes(h.region));
  const queries = [...p.tokens.slice(0, 4), ...p.codes.slice(0, 2)];
  const found = new Map<string, { hit: Hit; n: number }>();
  const [results, numResults, dexHits] = await Promise.all([
    Promise.all(queries.map((q) => search(q, regions))),
    Promise.all(p.numbers.slice(0, 3).map(async (n) => regionOk(await byNumber(n.num, n.total ?? "")))),
    byDex(p.dex, p.japanese).then(regionOk),
  ]);
  const dexIds = new Set<string>();
  dexHits.forEach((h) => { dexIds.add(h.id); if (!found.has(h.id)) found.set(h.id, { hit: h, n: 0 }); });
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
  // Illustrator der Kandidaten nachladen (falls vorhanden) und beim Bewerten berücksichtigen
  const ids = [...found.keys()].slice(0, 400);
  if (p.artist && ids.length) {
    const { data } = await supabase.from("cards").select("id, artist").in("id", ids);
    for (const r of (data ?? []) as any[]) { const f = found.get(r.id); if (f) f.hit.artist = r.artist; }
  }
  return [...found.values()].map(({ hit, n }) => ({ hit, score: scoreHit(hit, p, n) + (numIds.has(hit.id) ? 12 : 0) + (dexIds.has(hit.id) ? 6 : 0) })).sort((a, b) => b.score - a.score).slice(0, 12);
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
  const [manualNum, setManualNum] = useState(""); // Pokédex-Nummer (von "No. 049"), zusätzlich zum Namen durchsuchbar
  const [added, setAdded] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(0);
  const insets = useSafeAreaInsets();

  const evaluate = async (ol: OcrLine[]) => {
    const p = parseOcr(ol);
    const ls = ol.map((o) => o.text);
    setLines(ls);
    setManualNum(p.dex ? String(p.dex) : (p.numbers[0] ? `${p.numbers[0].num}${p.numbers[0].total ? "/" + p.numbers[0].total : ""}` : (p.codes[0] ?? "")));
    setManual(p.tokens.slice(0, 1).join(" ")); // nur der größte Text (Name); mehrere Wörter würden die Suche einengen
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
    // Feld "Nummer": nur Ziffern = Pokédex-Nr. ("No. 049"); 123/456 = Kartennummer; BW83 / SWSH123 = Promo-Code
    const nr = manualNum.trim();
    const dexNum = /^\d{1,4}$/.test(nr) ? Number(nr) : undefined;
    const slash = nr.match(/^0*(\d+)\s*\/\s*(\d+)$/);
    const code = !dexNum && !slash && /^[A-Za-z]{1,6}-?\d+[A-Za-z]?$/.test(nr) ? nr : "";
    if (manual.trim().length < 2 && !nr) return;
    setBusy(true);
    const p = parseOcr(lines ?? []);
    const [nameHits, dexHits, numHits, codeHits] = await Promise.all([
      manual.trim().length >= 2 ? search(manual.trim(), ["all"]) : Promise.resolve([] as Hit[]),
      byDex(dexNum, false),
      slash ? byNumber(slash[1], slash[2]) : Promise.resolve([] as Hit[]),
      code ? search(code, ["all"]) : Promise.resolve([] as Hit[]),
    ]);
    const nrIds = new Set([...dexHits, ...numHits, ...codeHits].map((h) => h.id));
    const nameIds = new Set(nameHits.map((h) => h.id));
    const map = new Map<string, Hit>();
    [...nameHits, ...dexHits, ...numHits, ...codeHits].forEach((h) => { if (!map.has(h.id)) map.set(h.id, h); });
    // Wenn Name UND Nummer passen, steht die Karte ganz oben; dann zählt auch das Veröffentlichungsjahr nicht mehr als Abzug
    setCands([...map.values()].map((h) => {
      const both = nameIds.has(h.id) && nrIds.has(h.id);
      return { hit: h, score: scoreHit(h, p, 1) + (both ? 60 : 0) + (nrIds.has(h.id) ? 4 : 0) };
    }).sort((x, y) => y.score - x.score).slice(0, 30));
    setBusy(false);
  };

  // Nach dem Antippen von "Hinzufügen": Abfrage wie bei "Zur Sammlung hinzufügen" (Ausführung, Sprache, Zustand, Anzahl …)
  const [pick, setPick] = useState<{ hit: Hit; variants: Variant[] } | null>(null);
  const choose = async (h: Hit) => {
    setBusy(true); setMsg("");
    const { data: vs } = await supabase.from("card_variants").select("id,finish,subtype,stamps,cardmarket_product_id").eq("card_id", h.id);
    setPick({ hit: h, variants: (vs ?? []) as Variant[] });
    setBusy(false);
  };
  const savePick = async (v: FormValues) => {
    if (!active || !pick) throw new Error("Keine Sammlung aktiv");
    const { error } = await supabase.from("collection_items").insert({ ...v, collection_id: active.id, card_id: pick.hit.id });
    if (error) throw new Error(error.message);
    setAdded((a) => [...a, cardName(pick.hit)]);
    setMsg(`✓ ${cardName(pick.hit)} hinzugefügt – nächste Karte`);
    setPick(null); setLines(null); setCands([]); setManual("");
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

  const showResults = lines !== null && !pick;
  const showCamera = !showResults && !pick; // Kamera nur, wenn weder Ergebnisliste noch das Hinzufügen-Formular offen ist
  return (
    <Screen>
      <Stack.Screen options={{ title: added.length ? `Scanner · ${added.length} hinzugefügt` : "Karte scannen" }} />
      {showCamera && (
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
      {pick && (
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 8 }}>
            <CardImg uri={pick.hit.image_url} width={70} height={98} label={cardName(pick.hit)} radius={4} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 17, fontWeight: "800" }}>{cardName(pick.hit)}</Text>
              <Text numberOfLines={2} style={{ color: t.sub, fontSize: 12 }}>{pick.hit.set_name}{pick.hit.number ? ` · #${pick.hit.number}` : ""}</Text>
            </View>
          </View>
          <H>Zur Sammlung „{active?.name ?? "–"}“ hinzufügen</H>
          <ItemForm variants={pick.variants} onSave={savePick} saveLabel="Hinzufügen" defaultLanguage={REGION_LANG[pick.hit.region] ?? "de"} region={pick.hit.region} />
          <Btn kind="ghost" title="Abbrechen" onPress={() => setPick(null)} />
        </ScrollView>
      )}
      {showResults && (
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Field label="Suchbegriff (anpassen, wenn nichts passt)" value={manual} onChangeText={setManual} onSubmitEditing={manualSearch} autoCorrect={false} />
          <Field label="Nummer (Pokédex-Nr. „No. 049“ → 49 · Kartennummer 123/456 · Promo-Code BW83)" value={manualNum} onChangeText={setManualNum} onSubmitEditing={manualSearch} />
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
              <Pressable onPress={() => choose(h)} style={{ backgroundColor: t.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
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
