// Auswertung der Texterkennung (OCR) einer Pokémon-Karte. Reine Funktionen, ohne Kamera/Netz – leicht zu testen.

export type Parsed = {
  numbers: { num: string; total?: string }[];   // z. B. 025/165 oder 124/S-P
  codes: string[];                              // z. B. XY202, SV5K, DP50
  tokens: string[];                             // mögliche Namensteile, in Lesereihenfolge
  hp?: number;
  year?: number;                                // Copyright-Jahr ("©2005") – grenzt das Set ein
  artist?: string;                              // Illustrator aus der Zeile "Illus. …" / "Illustr. …"
  dex?: number;                                 // Pokédex-Nummer, auf alten japanischen Karten unten rechts als "No. 049"
  japanese?: boolean;                           // Text enthält Kana (japanische Karte)
  korean?: boolean;                             // Text enthält Hangul (koreanische Karte)
  han?: boolean;                                // Text enthält chinesische Schriftzeichen ohne Kana/Hangul (chinesisch, taiwanesisch, ggf. japanisch)
};

const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim();
const CJK = /[぀-ヿ㐀-鿿가-힯]/;
const STOP = new Set([
  "basic", "stage", "stage1", "stage2", "evolves", "from", "pokemon", "pokémon", "trainer", "item", "supporter", "energy",
  "phase", "phase1", "phase2", "kp", "entwickelt", "sich", "aus", "schwäche", "resistenz", "rückzug", "nintendo", "creatures", "game", "freak",
  "weakness", "resistance", "retreat", "cost", "illus", "illus.", "ability", "attack", "when", "your", "this", "that", "the", "and", "for", "you", "may",
  "sar", "sr", "ur", "ar", "rr", "hr", "chr", "usgmen", "hp", "lv", "no", "ex", "gx", "vmax", "vstar", "v", "break", "prism", "star", "tera",
  "ポケモン", "トレーナー", "エネルギー", "たね", "進化", "進化前", "弱点", "抵抗力", "にげる", "ワザ", "特性", "グッズ", "サポート", "スタジアム",
  "弱点", "抵抗", "撤退", "宝可梦", "训练家", "能量", "포켓몬", "트레이너", "에너지",
]);

export type OcrLine = { text: string; h?: number };
// Zeilen, die nie zum Namen gehören (Copyright, Illustrator, Regeltext-Kopfzeilen)
const JUNK = /\b[ilh]{0,2}lus\b|\bi?llus|©|nintendo|creatures|game\s*freak|illus|pokernon|pok[eé]mon\s*\/|entwickelt|evolves|schw[aä]che|weakness|resist|r[uü]ckzug|retreat|w[aä]hrend|during/i;

// Entwicklungsstufe oben links ("PHASE 1", "BASIS", "STAGE 2", "Stufe 1", auch zusammengeklebt oder falsch gelesen)
const TYPE_WORD = /^\s*(?:phase|ph[a4]se|basis|basic|stufe|stage|stadium)\s*[1-2Il|]?\b\s*/i;

export function parseOcr(input: (string | OcrLine)[]): Parsed {
  const ocr: OcrLine[] = input.map((x) => (typeof x === "string" ? { text: x } : x));
  const lines = ocr.map((o) => o.text);
  const clean = lines.map(norm).filter(Boolean);
  const text = clean.join("\n");
  const numbers: Parsed["numbers"] = [];
  const codes: string[] = [];

  // auch "O191/151SAR" (O statt 0) und "C191/151" (Buchstabe direkt davor/dahinter)
  // KP/HP-Bereich oben rechts komplett ignorieren (Zeilen wie "HP70", "KP 180", "HPZ0", "180 HP"): dort stehen keine Namen, Nummern oder Set-Kürzel
  const HP_LINE = /^\s*(?:HP|KP|PV|PS)\s*\S{0,4}\s*$|^\s*(?:HP|KP|PV|PS)\s*\d|\b\d{2,3}\s*(?:HP|KP)\b/i;
  const noHp = clean.filter((l) => !HP_LINE.test(l));
  const textNoHp = noHp.join("\n");
  // Kartennummer "191/151", auch mit O statt 0, Buchstaben daneben oder angeklebter Nachbarzahl ("G151191/151SAR" -> 191/151)
  for (const m of textNoHp.matchAll(/(\d+)\s*\/\s*0*(\d{1,3})(?!\d)/g)) {
    const left = m[1].length > 3 ? m[1].slice(-3) : m[1];
    numbers.push({ num: left.replace(/^0+(?=\d)/, ""), total: m[2] });
  }
  for (const m of textNoHp.matchAll(/\b0*(\d{1,3})\s*\/\s*([A-Z]{1,5}(?:-[A-Z]{1,3})?-?P)\b/gi)) numbers.push({ num: m[1], total: m[2].toUpperCase() });
  for (const m of textNoHp.matchAll(/\b[A-Z]?(\d{2,3}[A-Z])\b/g)) { const c = m[1]; if (!codes.includes(c)) codes.push(c); }   // Set-Kürzel wie "151C" (auch aus "G151C")
  for (const m of textNoHp.matchAll(/\b([A-Z]{2,5}\d{1,3}[a-zA-Z]?)\b/g)) {   // mindestens 2 Buchstaben: "G180" (Regelmarke/Energie + HP) ist kein Set-Kürzel
    const c = m[1].toUpperCase();
    if (/^(HP|KP|LV|PV)/.test(c)) continue;
    if (!codes.includes(c)) codes.push(c);
  }

  let artist: string | undefined;
  for (const l of clean) {
    const m = l.match(/\b[IlH]{0,2}lus(?:tr)?\.?\s*[:：]?\s*([\p{L}][\p{L}.'’\- ]{2,40})/iu);
    if (m) { artist = m[1].replace(/\s+(?:\d.*)$/, "").trim(); break; }
  }

  // Pokédex-Nummer alter japanischer Karten ("No. 049", von der Texterkennung oft als "Na 049" / "No.049" gelesen)
  let dex: number | undefined;
  const dm = text.match(/\bN[o0a]\s*[.:]?\s*(\d{3,4})\b/i);
  if (dm) { const n = Number(dm[1]); if (n >= 1 && n <= 1100) dex = n; }
  // Vereinfachte chinesische Zeichen (gibt es in japanischen Texten nicht): Karte ist chinesisch, auch wenn die Kana-Erkennung einzelne Kana "erfunden" hat
  const simplified = (text.match(/[梦动为张对战变击气电龙宠贝坛应时该们这图线级场备获过选择拥个术够习复费]/g) ?? []).length;
  const hangulN = (text.match(/[가-힯]/g) ?? []).length;
  const kanaN = (text.match(/[぀-ヿ]/g) ?? []).length, hanN = (text.match(/[㐀-鿿]/g) ?? []).length;
  // Chinesisch: vereinfachte Zeichen ODER viele Han-Zeichen mit kaum Kana (echte japanische Karten bestehen großteils aus Kana)
  const chinese = simplified >= 2 || (hanN >= 12 && kanaN / (hanN + kanaN) < 0.12);
  const japanese = !chinese && !(hangulN >= 5 && hangulN >= kanaN) && /[぀-ヿ]/.test(text);
  // Koreanisch nur bei deutlich mehr Hangul als Kana (die Korea-Erkennung liefert bei anderen Karten manchmal Zufalls-Hangul)
  const korean = hangulN >= 5 && hangulN >= kanaN && hangulN * 1.5 >= hanN;
  const han = chinese || (!japanese && !korean && /[㐀-鿿]/.test(text));

  // Copyright-Jahr ("©2005", "C2005 Pokémon"): 1996 bis heute
  let year: number | undefined;
  const ym = text.match(/(?:©|\(c\)|\bC)\s?(19[9]\d|20[0-2]\d)\b/i);
  if (ym) year = Number(ym[1]);
  let hp: number | undefined;
  const h = text.match(/\bHP\s*(\d{2,3})\b/i) ?? text.match(/\b(\d{2,3})\s*HP\b/i);
  if (h) hp = Number(h[1]);

  // Namensteile: die höchsten (größten) Textzeilen, ohne Copyright/Regeltext; ohne Höhenangabe die ersten Zeilen
  const hasH = ocr.some((o) => o.h);
  const cand = ocr
    .map((o, i) => ({ text: norm(o.text), h: o.h ?? 0, i }))
    .map((o) => ({ ...o, text: o.text.replace(TYPE_WORD, "").trim() }))
    .filter((o) => o.text && !HP_LINE.test(o.text) && !JUNK.test(o.text) && /\p{L}{3}/u.test(o.text));
  const nameLines = (hasH ? [...cand].sort((a, b) => b.h - a.h || a.i - b.i).slice(0, 4) : cand.slice(0, 8)).map((o) => o.text);
  const tokens: string[] = [];
  for (const line of nameLines) {
    const cleaned = line
      .replace(/\bHP\s*\d+\b|\b\d+\s*HP\b|\bLV\.?\s*\d+\b|\bLv\.?\s*\d+\b/gi, " ")
      .replace(/[0-9０-９]+/g, " ")
      .replace(/[^\p{L}\p{N}'’.\- ]/gu, " ");
    for (const raw of cleaned.split(/\s+/)) {
      const tk = raw.replace(/^[-.']+|[-.']+$/g, "");
      if (!tk) continue;
      const len = CJK.test(tk) ? 2 : 3;
      if (tk.length < len) continue;
      if (STOP.has(tk.toLowerCase())) continue;
      if (/^[A-Za-z\-]{15,}$/.test(tk) || (tk.length > 12 && /[a-z][A-Z]/.test(tk) && /[A-Z]{3}/.test(tk))) continue;   // Texterkennungs-Müll ("OtTEVEUPOIRL-JiDITLI")
      if (/^(phase|basis|stufe|stage|basic)[1-2il]?$/i.test(tk)) continue;
      if (!tokens.includes(tk)) tokens.push(tk);
    }
  }
  // "梦幻ex" / "ミュウex": zusätzlich ohne Zusatz suchen
  for (const tk of [...tokens]) { const m = tk.match(/^([㐀-鿿぀-ヿ]{2,}?)(?:ex|EX|GX|VMAX|VSTAR|V)$/); if (m && !tokens.includes(m[1])) tokens.push(m[1]); }
  return { numbers, codes, tokens: tokens.slice(0, 6), hp, year, artist, dex, japanese, korean, han };
}

export type Hit = {
  id: string; number: string; name_en: string | null; name_de: string | null; name_ja: string | null; name_ko: string | null; name_zh: string | null;
  artist?: string | null; rarity: string | null; image_url: string | null; set_id: string; set_name: string; region: string; release_date: string | null;
};

const stripZeros = (n: string) => n.replace(/^0+(?=\d)/, "");

/** Bewertet einen Treffer gegen das OCR-Ergebnis. Höher = wahrscheinlicher. */
/** Welche Regionen kommen für den gelesenen Text in Frage? Asiatische Schriftzeichen => nur asiatische Karten, sonst nur internationale. */
export function allowedRegions(p: Parsed): string[] {
  if (p.japanese) return ["japan"];
  if (p.korean) return ["korea"];
  if (p.han) return ["china", "taiwan", "japan"];
  return ["international"];
}

export function scoreHit(h: Hit, p: Parsed, matchedTokens: number): number {
  let s = matchedTokens * 3;
  // Genau gleicher Name zählt mehr als nur "enthält" (Mew <-> Mewtu, ミュウ <-> ミュウツー)
  const names = [h.name_en, h.name_de, h.name_ja, h.name_ko, h.name_zh].filter(Boolean).map((x) => String(x).replace(/\s+-\s+\d+\/[\w-]+$/, "").normalize("NFKC").toLowerCase().replace(/[\s'’.\-]/g, ""));   // "Mew - 091/PCG-P" zählt als "Mew"
  if (p.tokens.some((tk) => names.includes(tk.normalize("NFKC").toLowerCase().replace(/[\s'’.\-]/g, "")))) s += 8;
  const num = stripZeros(String(h.number ?? "").split("/")[0].toUpperCase());
  for (const n of p.numbers) {
    if (num && stripZeros(n.num) === num) s += 5;
  }
  for (const c of p.codes) {
    if (num && c === num) s += 6;                 // z. B. XY202 = Kartennummer
    const setCode = h.set_id.includes(":") ? h.set_id.split(":")[1].toUpperCase() : h.set_id.toUpperCase();
    if (c === setCode) s += 12;                   // Set-Kürzel auf der Karte (z. B. 151C): sehr starkes Zeichen
  }
  // "No. 049" (Pokédex-Nummer unten rechts) gibt es nur auf alten Karten: moderne Karten (ab 2012, z. B. Full Art / Rainbow) stark abwerten
  if (p.dex && h.release_date && Number(String(h.release_date).slice(0, 4)) >= 2012) s -= 12;
  if (p.year && h.release_date) { const d = Number(String(h.release_date).slice(0, 4)) - p.year; if (d >= 0 && d <= 1) s += 8; else if (d < -1 || d > 2) s -= 4; }   // Copyright-Jahr passt zum Set
  if (p.japanese && h.region === "japan") s += 4;
  if (p.han && h.region === "china") s += 4;                      // chinesische Zeichen: chinesische Karte bevorzugen               // Kana im Text: japanische Karte bevorzugen
  if (p.artist && h.artist) {
    const a = h.artist.toLowerCase(), b = p.artist.toLowerCase();
    if (a === b || a.includes(b) || b.includes(a)) s += 10;    // gleicher Illustrator
  }
  return s;
}


/** Genau gleicher Name (ohne Zusatz wie " - 091/PCG-P")? Wird genutzt, um bei "Mew" die Mewtu-Treffer auszublenden. */
export function exactName(h: Hit, tokens: string[]): boolean {
  const f = (x: string) => String(x).replace(/\s+-\s+\d+\/[\w-]+$/, "").normalize("NFKC").toLowerCase().replace(/[\s'’.\-]/g, "");
  const names = [h.name_en, h.name_de, h.name_ja, h.name_ko, h.name_zh].filter(Boolean).map((x) => f(String(x)));
  return tokens.some((tk) => tk.trim().length >= 2 && names.includes(f(tk)));
}
