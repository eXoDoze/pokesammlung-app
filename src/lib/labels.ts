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
  reverse?: boolean; firstEd?: boolean;
}) {
  if (!opts.productId) return null;
  const q = new URLSearchParams({ idProduct: String(opts.productId) });
  const lang = LANGUAGES.find((l) => l.code === opts.languageCode);
  if (lang) q.set("language", String(lang.cmId));
  const cond = CONDITIONS.find((c) => c.code === opts.condition);
  if (cond) q.set("minCondition", String(cond.cm));
  // Kein Verkäufer-Länderfilter: Preise unterscheiden sich je nach Herkunft, es sollen alle Verkäufer erscheinen
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
