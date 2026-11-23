// Bilderkennung fuer den Scanner: Foto an den Bildserver schicken (Google Cloud Run), Treffer als Hit-Objekte zurueckgeben
// und mit der Texterkennung zusammenfuehren. Ist keine Server-Adresse eingetragen oder der Server nicht erreichbar,
// passiert nichts (der Scanner arbeitet dann wie bisher nur mit Texterkennung).
import type { Hit } from "./ocrParser";
import { supabase } from "./supabase";

export const SCAN_SERVER_URL = "https://pokekartendex-scanner-634153384015.europe-west1.run.app";
export const SCAN_SERVER_TOKEN = "CWgh4ImVTBYLqY536_8oRrX2X5HE4RX7";

export type ImageHit = { hit: Hit; similarity: number; sift: number };

export async function identifyByImage(uri: string): Promise<ImageHit[]> {
  if (!SCAN_SERVER_URL) return [];
  try {
    const form = new FormData();
    form.append("image", { uri, name: "scan.jpg", type: "image/jpeg" } as any);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 60000); // erster Aufruf nach Pause: Server startet erst (bis ca. 30 s)
    const res = await fetch(`${SCAN_SERVER_URL.replace(/\/$/, "")}/identify?k=10`, { method: "POST", headers: { "x-app-token": SCAN_SERVER_TOKEN }, body: form, signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const j = await res.json();
    const found: { card_id: string; similarity: number; sift?: number }[] = j.treffer ?? [];
    if (!found.length) return [];
    const { data } = await supabase.from("cards")
      .select("id,number,name_en,name_de,name_ja,name_ko,name_zh,artist,rarity,image_url,set_id,sets(name_en,region,release_date)")
      .in("id", found.map((f) => f.card_id));
    const byId = new Map<string, any>((data ?? []).map((r: any) => [r.id, r]));
    const out: ImageHit[] = [];
    for (const f of found) {
      const r = byId.get(f.card_id); if (!r) continue;
      const s = Array.isArray(r.sets) ? r.sets[0] : r.sets;
      out.push({
        similarity: f.similarity, sift: f.sift ?? 0,
        hit: { id: r.id, number: r.number ?? "", name_en: r.name_en, name_de: r.name_de, name_ja: r.name_ja, name_ko: r.name_ko, name_zh: r.name_zh, artist: r.artist, rarity: r.rarity, image_url: r.image_url, set_id: r.set_id, set_name: s?.name_en ?? r.set_id, region: s?.region ?? "international", release_date: s?.release_date ?? null },
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Fuehrt Bild-Treffer mit den Text-Kandidaten zusammen: Treffer, die beides erfuellen, rutschen nach oben; reine Bild-Treffer werden ergaenzt. */
export function mergeImageHits<T extends { hit: Hit; score: number }>(cands: T[], imgs: ImageHit[]): T[] {
  if (!imgs.length) return cands;
  const bonus = (rank: number, ih: ImageHit) => Math.max(0, 60 - 8 * rank) + Math.min(ih.sift, 40) * 1.5;
  const map = new Map(cands.map((c) => [c.hit.id, { ...c }]));
  imgs.forEach((ih, rank) => {
    const b = bonus(rank, ih), cur = map.get(ih.hit.id);
    if (cur) cur.score += b; else map.set(ih.hit.id, { hit: ih.hit, score: 10 + b } as T);
  });
  return [...map.values()].sort((a, b) => b.score - a.score).slice(0, 40);
}
