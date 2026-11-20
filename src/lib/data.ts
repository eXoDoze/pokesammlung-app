import { isFirstEd, isShadowless } from "./labels";
import { supabase } from "./supabase";

export type Variant = {
  id: string; finish: string; subtype: string | null; stamps: string[] | null;
  cardmarket_product_id: number | null;
  asia_product?: boolean | null; // true = Cardmarket-Produkt gehört zu einer asiatischen Erweiterung (nur diese Sprache)
};
export type Item = {
  id: string; collection_id: string; card_id: string; variant_id: string | null;
  language: string; finish: string; is_first_edition: boolean; is_shadowless: boolean;
  stamp: string | null; condition: string; is_graded: boolean; grading_company: string | null;
  grade: number | null; quantity: number; purchase_price: number | null;
  purchased_at: string | null; notes: string | null; manual_value: number | null; prefer_manual?: boolean;
  status?: string; closed_at?: string | null; sold_price?: number | null; closed_note?: string | null;
  cards: {
    id: string; name_en: string | null; name_de: string | null; name_ja: string | null; name_ko?: string | null; name_zh?: string | null;
    number: string; image_url: string | null; set_id: string;
    sets: { name_en: string | null; name_de: string | null; name_ja: string | null; name_ko?: string | null; name_zh?: string | null; region?: string | null } | null;
    card_variants: Variant[];
  };
};
export type PriceRow = {
  cardmarket_product_id: number; snapshot_date: string; trend: number | null; avg: number | null;
  low: number | null; avg7: number | null; avg30: number | null;
  trend_foil: number | null; avg_foil: number | null; low_foil: number | null;
};
export type CondPrice = {
  card_id: string; language: string; finish: string; is_first_edition: boolean; stamp: string | null;
  condition: string; is_graded: boolean; grading_company: string | null; grade: number | null;
  price: number; seller_scope: string; fetched_at: string;
};

export const ITEM_SELECT =
  "*, cards(id,name_en,name_de,name_ja,name_ko,name_zh,number,image_url,set_id, sets(name_en,name_de,name_ja,name_ko,name_zh,region), card_variants(id,finish,subtype,stamps,cardmarket_product_id,asia_product))";

export async function fetchItems(collectionId: string, statuses: string[] = ["owned"]): Promise<Item[]> {
  const out: Item[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("collection_items").select(ITEM_SELECT)
      .eq("collection_id", collectionId).in("status", statuses).order("created_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as any));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// Jüngster Cardmarket-Preis je Produkt (Hauptquelle: Cardmarket-Preisdatei)
export async function latestPrices(productIds: number[]): Promise<Map<number, PriceRow>> {
  const map = new Map<number, PriceRow>();
  const since = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  for (const ids of chunk([...new Set(productIds)], 150)) {
    const { data } = await supabase.from("cardmarket_prices").select("*")
      .in("cardmarket_product_id", ids).eq("source", "cardmarket_file").gte("snapshot_date", since);
    for (const r of (data ?? []) as PriceRow[]) {
      const cur = map.get(Number(r.cardmarket_product_id));
      if (!cur || cur.snapshot_date < r.snapshot_date) map.set(Number(r.cardmarket_product_id), r);
    }
  }
  return map;
}

export async function latestCondPrices(cardIds: string[]): Promise<CondPrice[]> {
  const out: CondPrice[] = [];
  for (const ids of chunk([...new Set(cardIds)], 100)) {
    const { data } = await supabase.from("condition_prices").select("*")
      .in("card_id", ids).eq("source", "cardmarket").eq("price_kind", "lowest")
      .order("fetched_at", { ascending: false }).limit(1000);
    out.push(...((data ?? []) as CondPrice[]));
  }
  return out;
}

// Welche Cardmarket-Variante gehört zu einem Sammlungseintrag?
export function pickVariant(item: Pick<Item, "variant_id" | "finish" | "is_first_edition" | "is_shadowless">, variants: Variant[]) {
  if (item.variant_id) { const v = variants.find((x) => x.id === item.variant_id); if (v) return v; }
  const same = variants.filter((v) => v.finish === item.finish);
  return (
    same.find((v) => isFirstEd(v.subtype) === item.is_first_edition && isShadowless(v.subtype) === item.is_shadowless) ??
    same[0] ?? variants[0]
  );
}

export type Value = { price: number; kind: "zustand" | "ab" | "markt" | "eigen"; scope?: string } | null;

// Zustandspreis aus den Zustandsabfragen (jüngster Eintrag).
//   "alle" = günstigstes Angebot aller Verkäufer (Herkunftsländer gemischt)
//   "DE"   = günstigstes Angebot nur von Verkäufern aus Deutschland
export function findCond(item: Item, cond: CondPrice[], scope: "alle" | "DE"): CondPrice | undefined {
  return cond.find((p) =>
    (scope === "DE" ? p.seller_scope === "DE" : p.seller_scope !== "DE") &&
    p.card_id === item.card_id && p.condition === (item.is_graded ? "MT" : item.condition) &&
    p.finish === item.finish && p.is_first_edition === item.is_first_edition &&
    (p.stamp ?? null) === (item.stamp ?? null) && p.is_graded === item.is_graded &&
    (p.grading_company ?? null) === (item.grading_company ?? null) &&
    (p.grade ?? null) === (item.grade ?? null) && (p.language === "any" || p.language === item.language));
}

const ASIAN_LANGS = ["ja", "ko", "zh-cn", "zh-tw"];
export const isAsianLang = (code: string | null | undefined) => ASIAN_LANGS.includes(String(code ?? ""));
// Cardmarkets Preisdatei gilt je Produkt über alle Sprachen. Sie passt nur, wenn Karte und Produkt zusammenpassen:
// asiatische Karte + asiatisches Produkt, oder nicht-asiatische Karte + internationales Produkt.
// Hängt z. B. eine japanische Karte am internationalen Produkt, wäre der Preis ungenau -> keinen Preis anzeigen.
export const priceGuideFits = (lang: string | null | undefined, v: Pick<Variant, "asia_product"> | null | undefined) =>
  isAsianLang(lang) === !!v?.asia_product;

// Wert je Stück (Sammlungswert):
//  1. eigener Wert (immer Vorrang)
//  2. günstigstes Angebot im eigenen Zustand, alle Verkäufer ("zustand")
//  3. günstigster Preis laut Cardmarket-Preisdatei, alle Zustände und Verkäufer ("ab") – nur wenn Karte und Produkt
//     zur selben Sprachgruppe gehören (sonst kein Preis, damit nichts Ungenaues angezeigt wird)
//  4. nur wenn es keinen Ab-Preis gibt: Cardmarket-Trend ("markt")
export function valueOf(item: Item, prices: Map<number, PriceRow>, cond: CondPrice[]): Value {
  if (item.manual_value != null) return { price: Number(item.manual_value), kind: "eigen" };
  const c = findCond(item, cond, "alle");
  if (c) return { price: Number(c.price), kind: "zustand", scope: "alle" };
  // Graded-Karten haben nur Zustandspreise
  if (!item.is_graded) {
    const v = pickVariant(item, item.cards.card_variants ?? []);
    const row = v?.cardmarket_product_id && priceGuideFits(item.language, v) ? prices.get(Number(v.cardmarket_product_id)) : undefined;
    if (row) {
      const rev = item.finish === "reverse_holo";
      const low = rev ? row.low_foil : row.low;
      if (low != null) return { price: Number(low), kind: "ab" };
      const trend = rev ? row.trend_foil : row.trend;
      if (trend != null) return { price: Number(trend), kind: "markt" };
    }
  }
  return null;
}

// Verknüpfung japanischer Karten mit dem englischen Cardmarket-Produkt (nur für Links)
export async function jaLinkProduct(cardId: string): Promise<number | null> {
  if (!cardId.startsWith("ja:")) return null;
  const { data } = await supabase.from("ja_card_links").select("cardmarket_product_id").eq("card_id", cardId).maybeSingle();
  return data ? Number(data.cardmarket_product_id) : null;
}

export async function valuesForItems(items: Item[]) {
  const productIds = items.flatMap((i) => (i.cards.card_variants ?? []).map((v) => v.cardmarket_product_id)).filter(Boolean) as number[];
  const [prices, cond] = await Promise.all([latestPrices(productIds), latestCondPrices(items.map((i) => i.card_id))]);
  return new Map(items.map((i) => [i.id, valueOf(i, prices, cond)] as const));
}

// Verlauf des Sammlungswerts (Ab-Preis, ohne Graded) aus den gespeicherten Tagespreisen
export async function valueHistory(items: Item[], days = 30): Promise<{ date: string; value: number }[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const byProduct = new Map<number, { qty: number; foil: boolean }[]>();
  for (const i of items) {
    if (i.is_graded) continue;
    const v = pickVariant(i, i.cards.card_variants ?? []);
    if (!v?.cardmarket_product_id || !priceGuideFits(i.language, v)) continue;
    const pid = Number(v.cardmarket_product_id);
    if (!byProduct.has(pid)) byProduct.set(pid, []);
    byProduct.get(pid)!.push({ qty: i.quantity, foil: i.finish === "reverse_holo" });
  }
  const sums = new Map<string, { value: number; n: number }>();
  for (const ids of chunk([...byProduct.keys()], 100)) {
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from("cardmarket_prices").select("cardmarket_product_id,snapshot_date,trend,trend_foil,low,low_foil")
        .in("cardmarket_product_id", ids).eq("source", "cardmarket_file").gte("snapshot_date", since)
        .order("snapshot_date").range(from, from + 999);
      for (const r of (data ?? []) as any[]) {
        for (const u of byProduct.get(Number(r.cardmarket_product_id)) ?? []) {
          const p = u.foil ? (r.low_foil ?? r.trend_foil) : (r.low ?? r.trend);
          if (p == null) continue;
          const s = sums.get(r.snapshot_date) ?? { value: 0, n: 0 };
          s.value += Number(p) * u.qty; s.n += 1; sums.set(r.snapshot_date, s);
        }
      }
      if (!data || data.length < 1000) break;
    }
  }
  const maxN = Math.max(0, ...[...sums.values()].map((s) => s.n));
  // nur Tage mit nahezu vollständiger Abdeckung, sonst entstehen künstliche Sprünge
  return [...sums.entries()].filter(([, s]) => s.n >= maxN * 0.9).sort(([a], [b]) => a.localeCompare(b))
    .map(([date, s]) => ({ date, value: Math.round(s.value * 100) / 100 }));
}
