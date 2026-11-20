export const CONDITIONS = [
  { code: "MT", label: "Mint", cm: 1 },
  { code: "NM", label: "Near Mint", cm: 2 },
  { code: "EX", label: "Excellent", cm: 3 },
  { code: "GD", label: "Good", cm: 4 },
  { code: "LP", label: "Light Played", cm: 5 },
  { code: "PL", label: "Played", cm: 6 },
  { code: "PO", label: "Poor", cm: 7 },
] as const;
export const conditionLabel = (c: string) => CONDITIONS.find((x) => x.code === c)?.label ?? c;

export const FINISH_LABEL: Record<string, string> = {
  non_holo: "Non-Holo", holo: "Holo", reverse_holo: "Reverse Holo",
};
export const LANGUAGES = [
  { code: "de", label: "Deutsch", cmId: 3 }, { code: "en", label: "Englisch", cmId: 1 },
  { code: "ja", label: "Japanisch", cmId: 7 }, { code: "fr", label: "Französisch", cmId: 2 },
  { code: "it", label: "Italienisch", cmId: 5 }, { code: "es", label: "Spanisch", cmId: 4 },
  { code: "ko", label: "Koreanisch", cmId: 10 }, { code: "zh-cn", label: "Chinesisch (vereinfacht)", cmId: 6 },
  { code: "zh-tw", label: "Chinesisch (traditionell)", cmId: 11 },
];
// Grading-Firmen: die großen zuerst, danach weitere (Stand der Recherche), "Andere" = freie Eingabe
export const GRADERS = [
  "PSA", "BGS", "CGC", "SGC", "TAG", "ACE", "ARS", "PCA", "BCCG", "BVG", "PGS", "GMA", "KSA", "MNT", "MGC",
  "ISA", "Aura", "FCG", "DSG", "RCG", "HGA", "GRAAD", "Cardmarket Grading", "Andere",
];

export const eur = (v: number | null | undefined) =>
  v == null ? "–" : v.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
export const pct = (v: number | null | undefined) =>
  v == null ? "–" : `${v > 0 ? "+" : ""}${v.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;

export const cardName = (c: { name_de?: string | null; name_en?: string | null; name_ja?: string | null; name_ko?: string | null; name_zh?: string | null }) =>
  c.name_de || c.name_en || c.name_ja || c.name_zh || c.name_ko || "?";

// Variante aus Bezeichnung (subtype / stamps) ableiten
export const isFirstEd = (subtype?: string | null) => /first|1st/i.test(subtype ?? "");
export const isShadowless = (subtype?: string | null) => /shadowless/i.test(subtype ?? "");

export function variantLabel(v: { finish: string; subtype?: string | null; stamps?: string[] | null }) {
  const parts = [FINISH_LABEL[v.finish] ?? v.finish];
  if (v.subtype) parts.push(v.subtype);
  if (v.stamps && v.stamps.length) parts.push(`Stempel: ${v.stamps.join(", ")}`);
  return parts.join(" · ");
}

// Links zu Cardmarket (alle Verkäufer) und eBay (verkaufte Artikel)
export function cardmarketUrl(opts: {
  productId?: number | null; languageCode?: string; condition?: string;
  reverse?: boolean; firstEd?: boolean; germanOnly?: boolean;
  directUrl?: string | null; // fest hinterlegte Cardmarket-Seite der Karte (hat Vorrang vor der Produktnummer)
}) {
  if (opts.directUrl) {
    const d = new URLSearchParams();
    const c2 = CONDITIONS.find((c) => c.code === opts.condition);
    if (c2) d.set("minCondition", String(c2.cm));
    if (opts.germanOnly) d.set("sellerCountry", "7");
    if (opts.reverse) d.set("isReverseHolo", "Y");
    if (opts.firstEd) d.set("isFirstEd", "Y");
    const qs = d.toString();
    return opts.directUrl + (qs ? (opts.directUrl.includes("?") ? "&" : "?") + qs : "");
  }
  if (!opts.productId) return null;
  const q = new URLSearchParams({ idProduct: String(opts.productId) });
  const lang = LANGUAGES.find((l) => l.code === opts.languageCode);
  if (lang) q.set("language", String(lang.cmId));
  const cond = CONDITIONS.find((c) => c.code === opts.condition);
  if (cond) q.set("minCondition", String(cond.cm));
  if (opts.germanOnly) q.set("sellerCountry", "7"); // nur Verkäufer aus Deutschland; ohne diese Angabe erscheinen alle Verkäufer
  if (opts.reverse) q.set("isReverseHolo", "Y");
  if (opts.firstEd) q.set("isFirstEd", "Y");
  return `https://www.cardmarket.com/de/Pokemon/Products?${q.toString()}`;
}
export function ebaySoldUrl(nameEn: string, number: string, setName?: string | null) {
  const q = [nameEn, number, setName].filter(Boolean).join(" ");
  return `https://www.ebay.de/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_Sold=1&LH_Complete=1`;
}

type SetNames = { name_en?: string | null; name_de?: string | null; name_ja?: string | null; name_ko?: string | null; name_zh?: string | null; region?: string | null };
/** Asiatische Sets: englischer Name zuerst (lesbar), sonst Landessprache. */
export function setTitle(s: SetNames | null | undefined, fallback = ""): string {
  if (!s) return fallback;
  const asia = s.region && s.region !== "international";
  return (asia
    ? s.name_en ?? s.name_de ?? s.name_ja ?? s.name_zh ?? s.name_ko
    : s.name_de ?? s.name_en ?? s.name_ja ?? s.name_zh ?? s.name_ko) ?? fallback;
}
/** Originalname in Schriftzeichen, falls er sich vom Titel unterscheidet. */
export function setNative(s: SetNames | null | undefined): string | null {
  if (!s) return null;
  const n = s.name_ja ?? s.name_zh ?? s.name_ko ?? null;
  return n && n !== setTitle(s) ? n : null;
}


// ---------------------------------------------------------------------------
// Karten-Typen als anklickbare Pills (Tag Team, VMAX, SIR …). Gleiche Definition für Anzeige und Listenabfrage.
export type Tag = { key: string; label: string; col: "name_en" | "rarity"; op: "like" | "ilike"; pat: string | string[] };
export const TAGS: Tag[] = [
  // nach Kartenname
  { key: "tagteam", label: "Tag Team", col: "name_en", op: "ilike", pat: "% & % GX" },
  { key: "vmax", label: "VMAX", col: "name_en", op: "like", pat: "% VMAX" },
  { key: "vstar", label: "VSTAR", col: "name_en", op: "like", pat: "% VSTAR" },
  { key: "vunion", label: "V-UNION", col: "name_en", op: "like", pat: "% V-UNION" },
  { key: "v", label: "V", col: "name_en", op: "like", pat: "% V" },
  { key: "gx", label: "GX", col: "name_en", op: "like", pat: "% GX" },
  { key: "ex", label: "ex", col: "name_en", op: "like", pat: "% ex" },
  { key: "exold", label: "EX", col: "name_en", op: "like", pat: "% EX" },
  { key: "mega", label: "Mega", col: "name_en", op: "like", pat: "Mega %" },
  { key: "lvx", label: "LV.X", col: "name_en", op: "like", pat: "% LV.X" },
  { key: "legend", label: "LEGEND", col: "name_en", op: "ilike", pat: "% LEGEND" },
  { key: "delta", label: "Delta Species", col: "name_en", op: "like", pat: "%δ%" },
  { key: "radiant", label: "Radiant", col: "name_en", op: "like", pat: "Radiant %" },
  // nach Seltenheit (englische Seltenheiten aus TCGdex, gelten auch für japanische/asiatische Karten)
  { key: "sir", label: "SIR / SAR", col: "rarity", op: "ilike", pat: "special illustration rare" },
  { key: "ir", label: "Illustration Rare", col: "rarity", op: "ilike", pat: ["illustration rare", "art rare"] },
  { key: "hyper", label: "Hyper Rare", col: "rarity", op: "ilike", pat: "hyper rare" },
  { key: "megahyper", label: "Mega Hyper Rare", col: "rarity", op: "ilike", pat: "mega hyper rare" },
  { key: "secret", label: "Secret Rare", col: "rarity", op: "ilike", pat: "secret rare" },
  { key: "fullart", label: "Full Art", col: "rarity", op: "ilike", pat: ["ultra rare", "super rare", "full art trainer"] },
  { key: "character", label: "Character Rare", col: "rarity", op: "ilike", pat: "character %" },
  { key: "triple", label: "Triple Rare", col: "rarity", op: "ilike", pat: "triple rare" },
  { key: "double", label: "Double Rare", col: "rarity", op: "ilike", pat: "double rare" },
  { key: "ace", label: "ACE SPEC", col: "rarity", op: "ilike", pat: ["ace spec rare", "ace rare"] },
  { key: "amazing", label: "Amazing Rare", col: "rarity", op: "ilike", pat: "amazing rare" },
  { key: "radiantrare", label: "Radiant Rare", col: "rarity", op: "ilike", pat: "radiant rare" },
  { key: "shiny", label: "Shiny", col: "rarity", op: "ilike", pat: ["shiny%", "shining"] },
  { key: "prime", label: "Prime", col: "rarity", op: "ilike", pat: "rare prime" },
  { key: "prism", label: "Prism Star", col: "rarity", op: "ilike", pat: "prism rare" },
  { key: "classic", label: "Classic Collection", col: "rarity", op: "ilike", pat: "classic collection" },
  { key: "promo", label: "Promo", col: "rarity", op: "ilike", pat: "promo" },
];
export const tagByKey = (k: string) => TAGS.find((t) => t.key === k);

function tagMatches(t: Tag, c: { name_en?: string | null; rarity?: string | null }) {
  const val = t.col === "name_en" ? c.name_en : c.rarity;
  if (!val) return false;
  return (Array.isArray(t.pat) ? t.pat : [t.pat]).some((p) => {
    const re = new RegExp("^" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$", t.op === "ilike" ? "i" : "");
    return re.test(val.trim());
  });
}
export function cardTags(c: { name_en?: string | null; rarity?: string | null }): Tag[] {
  const hit = TAGS.filter((t) => tagMatches(t, c));
  return hit.some((t) => t.key === "tagteam") ? hit.filter((t) => t.key !== "gx") : hit;
}

// ---- Datum: Anzeige/Eingabe deutsch (TT.MM.JJJJ), Speicherung ISO (JJJJ-MM-TT) ----
export function isoToDe(iso?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : (iso ?? "");
}
export function todayDe(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
// "19.11.2026" (auch 1.2.2026 oder 19.11.26) -> "2026-11-19"; null bei ungültigem Datum
export function deToIso(s: string): string | null {
  const m = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})\s*$/.exec(s);
  if (!m) return null;
  const day = Number(m[1]), mon = Number(m[2]);
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(Date.UTC(year, mon - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== mon - 1 || d.getUTCDate() !== day) return null;
  return `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
