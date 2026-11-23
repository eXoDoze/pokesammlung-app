import { CameraView, useCameraPermissions } from "expo-camera";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Btn, CardImg, Field, H, Screen, Sub } from "../components/ui";
import { FormValues, ItemForm } from "../components/ItemForm";
import type { Variant } from "../lib/data";
import { Hit, OcrLine, Parsed, allowedRegions, exactName, parseOcr, scoreHit } from "../lib/ocrParser";
import { cardName } from "../lib/labels";
import { ImageHit, identifyByImage, mergeImageHits, warmUpScanServer } from "../lib/imageScan";
import { useApp } from "../lib/session";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Texterkennung läuft nur auf dem Handy (nicht im Browser)
const ML: any = Platform.OS === "web" ? null : require("@react-native-ml-kit/text-recognition");

type Mode = "auto";
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
  // Alle Schriften nacheinander lesen (Latein, Japanisch, Chinesisch, Koreanisch): eine Sprachauswahl ist nicht mehr nötig
  await run(T.JAPANESE);
  await run(T.CHINESE);
  await run(T.KOREAN);
  const seen = new Set<string>();
  return lines.filter((l) => (seen.has(l.text) ? false : (seen.add(l.text), true)));
}

// Suche je erlaubter Region (so verdrängen viele internationale Karten gleichen Namens nicht die gesuchte asiatische Karte)
async function search(term: string, regions: string[]): Promise<Hit[]> {
  const res = await Promise.all(regions.map((r) => supabase.rpc("search_cards", { p_q: term, p_region: r, p_limit: 250, p_offset: 0 })));
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

// Passt der Suchtext zu einem der Namen der Karte (in allen Sprachen)?
function nameIn(h: Hit, text: string): boolean {
  const w = text.trim().toLowerCase();
  if (w.length < 2) return false;
  const x = h as any;
  return [x.name_en, x.name_de, x.name_ja, x.name_ko, x.name_zh].some((n) => n && String(n).toLowerCase().includes(w));
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
  let list = [...found.values()];
  // Ist der Name eindeutig gelesen (z. B. "Mew"), werden Treffer mit nur ähnlichem Namen ("Mewtu") ausgeblendet
  const exact = list.filter(({ hit }) => exactName(hit, p.tokens.slice(0, 4)));
  if (exact.length > 0) list = exact;
  // Set-Kürzel auf der Karte (z. B. 151C) passt zu einem Treffer mit gleicher Nummer: Treffer aus anderen Sets mit gleicher Nummer ausblenden
  const codeSet = (h: Hit) => (h.set_id.includes(":") ? h.set_id.split(":")[1] : h.set_id).toUpperCase();
  const codeHit = list.filter(({ hit }) => numIds.has(hit.id) && p.codes.includes(codeSet(hit)));
  if (codeHit.length > 0) list = list.filter(({ hit }) => !numIds.has(hit.id) || p.codes.includes(codeSet(hit)));
  return list.map(({ hit, n }) => {
    const dexAndName = dexIds.has(hit.id) && p.tokens.slice(0, 4).some((tk) => nameIn(hit, tk));
    return { hit, score: scoreHit(hit, p, n) + (numIds.has(hit.id) ? 12 : 0) + (dexIds.has(hit.id) ? 6 : 0) + (dexAndName ? 40 : 0) + (dexAndName && !hit.number ? 8 : 0) };
  }).sort((a, b) => b.score - a.score).slice(0, 30);
}

export default function Scan() {
  const t = useTheme();
  const router = useRouter();
  const { active } = useApp();
  const [perm, askPerm] = useCameraPermissions();
  const cam = useRef<any>(null);
  const mode: Mode = "auto";
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
  const scanId = useRef(0); // verwirft Bild-Ergebnisse eines alten Fotos
  useEffect(() => { warmUpScanServer(); }, []);

  const evaluate = async (ol: OcrLine[], imgs: ImageHit[] = []) => {
    const p = parseOcr(ol);
    const ls = ol.map((o) => o.text);
    setLines(ls);
    setManualNum(p.dex ? String(p.dex) : (p.numbers[0] ? `${p.numbers[0].num}${p.numbers[0].total ? "/" + p.numbers[0].total : ""}` : "")); // Codes werden nur zum Bewerten genutzt, nicht eingetragen (Texterkennung liefert dort oft Müll)
    setManual(p.tokens.slice(0, 1).join(" ")); // nur der größte Text (Name); mehrere Wörter würden die Suche einengen
    setCands(mergeImageHits(await findCandidates(p), imgs));
  };

  const snap = async () => {
    if (!cam.current || busy) return;
    setBusy(true); setMsg("");
    try {
      const pic = await cam.current.takePictureAsync({ quality: 0.9 });
      // Texterkennung und Bilderkennung (Bildserver) starten gleichzeitig; das Textergebnis erscheint sofort,
      // die Bild-Treffer werden danach eingearbeitet, sobald der Server geantwortet hat
      const id = ++scanId.current;
      const imgsP = identifyByImage(pic.uri);
      await evaluate(await readText(pic.uri, mode));
      setBusy(false);
      const imgs = await imgsP;
      if (imgs.length && id === scanId.current) setCands((cur) => mergeImageHits(cur, imgs));
      return;
    } catch (e: any) { setMsg(e?.message ?? "Foto fehlgeschlagen"); }
    setBusy(false);
  };

  const manualSearch = async () => {
    // Feld "Nummer": nur Ziffern = Pokédex-Nr. ("No. 049"); 123/456 = Kartennummer; BW83 / SWSH123 = Promo-Code
    const nr = manualNum.trim();
    const dexNum = /^\d{1,4}$/.test(nr) ? Number(nr) : undefined;
    const slash = nr.match(/^0*(\d+)\s*\/\s*(\d+)$/);
    // auch Promo-Nummern mit Set-Kürzel: "091/PCG-P", "208/S-P", "091/pcg"
    const promoSlash = /^[A-Za-z]{0,4}\d+[A-Za-z]{0,2}\s*\/\s*[A-Za-z][A-Za-z0-9-]*$/.test(nr);
    const code = !dexNum && !slash && (/^[A-Za-z]{1,6}-?\d+[A-Za-z]?$/.test(nr) || promoSlash) ? nr.replace(/\s+/g, "") : "";
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
    let all = [...map.values()];
    // Name genau gefunden (z. B. "Mew"): Treffer mit nur ähnlichem Namen ("Mewtu") ausblenden, es sei denn, sie passen über die Nummer
    if (manual.trim().length >= 2) { const ex = all.filter((h) => exactName(h, [manual.trim()])); if (ex.length > 0) all = ex; }
    // Set-Kürzel (z. B. 151C) passt zu einem Treffer mit gleicher Nummer: andere Sets mit gleicher Nummer ausblenden
    const codeSet = (h: Hit) => (h.set_id.includes(":") ? h.set_id.split(":")[1] : h.set_id).toUpperCase();
    const numSet = new Set(numHits.map((h) => h.id));
    if (all.some((h) => numSet.has(h.id) && p.codes.includes(codeSet(h)))) all = all.filter((h) => !numSet.has(h.id) || p.codes.includes(codeSet(h)));
    // Illustrator der Treffer nachladen, damit er beim Bewerten zählt
    if (p.artist && all.length) {
      const { data } = await supabase.from("cards").select("id, artist").in("id", all.slice(0, 400).map((h) => h.id));
      for (const r of (data ?? []) as any[]) { const f = all.find((h) => h.id === r.id); if (f) f.artist = r.artist; }
    }
    setCands(all.map((h) => {
      const both = nrIds.has(h.id) && (nameIds.has(h.id) || nameIn(h, manual));
      // Karten ohne Nummer (z. B. Vending Machine, alte japanische Sets) tragen auch gedruckt keine Kartennummer: bei Pokédex-Suche leicht bevorzugen
      return { hit: h, score: scoreHit(h, p, 1) + (both ? 60 : 0) + (nrIds.has(h.id) ? 4 : 0) + (dexNum && both && !h.number ? 8 : 0) };
    }).sort((x, y) => y.score - x.score).slice(0, 60));
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
          <Field label="Nummer (Pokédex-Nr. „No. 049“ → 49 · Kartennummer 123/456 · Promo 091/PCG-P oder BW83)" value={manualNum} onChangeText={setManualNum} onSubmitEditing={manualSearch} />
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
