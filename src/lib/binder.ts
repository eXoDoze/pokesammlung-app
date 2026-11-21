import AsyncStorage from "@react-native-async-storage/async-storage";
import { ITEM_SELECT, Item } from "./data";
import { supabase } from "./supabase";

export type Layout = "list" | "3x3" | "3x4";
export type Binder = { id: string; owner_id: string; collection_id: string | null; name: string; layout: Layout; pages: number; sort_order: number; created_at: string };
// page/slot = null: Karte liegt im Binder, hat aber noch keinen festen Platz
export type Slot = { id: string; binder_id: string; page: number | null; slot: number | null; item_id: string; item: Item | null };

// "3x4" bleibt der gespeicherte Schlüssel, bedeutet aber 4 Spalten × 3 Reihen (Querformat), Anzeige: 4×3
export const layoutCols = (l: Layout) => (l === "3x4" ? 4 : 3);
export const layoutRows = (l: Layout) => 3;
export const slotsPerPage = (l: Layout) => (l === "list" ? 0 : layoutCols(l) * layoutRows(l));
export const layoutLabel = (l: Layout) => (l === "list" ? "Liste" : l === "3x4" ? "4×3" : "3×3");

export async function fetchBinders(collectionId: string | null): Promise<Binder[]> {
  let q = supabase.from("binders").select("*").order("sort_order").order("created_at");
  if (collectionId) q = q.eq("collection_id", collectionId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Binder[];
}

export async function fetchSlots(binderId: string): Promise<Slot[]> {
  const out: Slot[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from("binder_slots").select(`id,binder_id,page,slot,item_id,item:collection_items(${ITEM_SELECT})`)
      .eq("binder_id", binderId).order("page").order("slot").range(from, from + 499);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as any));
    if (!data || data.length < 500) break;
  }
  return out;
}

// Anzahl belegter Plätze je Binder
export async function slotCounts(binderIds: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  if (!binderIds.length) return m;
  const { data } = await supabase.from("binder_slots").select("binder_id").in("binder_id", binderIds).limit(20000);
  for (const r of (data ?? []) as { binder_id: string }[]) m.set(r.binder_id, (m.get(r.binder_id) ?? 0) + 1);
  return m;
}

// Eine Karte darf insgesamt nur so oft in Bindern liegen, wie du sie besitzt (Menge im Sammlungseintrag)
async function capacityError(itemId: string): Promise<string | null> {
  const [it, cnt] = await Promise.all([
    supabase.from("collection_items").select("quantity").eq("id", itemId).single(),
    supabase.from("binder_slots").select("id", { count: "exact", head: true }).eq("item_id", itemId),
  ]);
  const q = Number((it.data as any)?.quantity ?? 1), n = cnt.count ?? 0;
  return n >= q ? `Diese Karte liegt schon ${n}× in Bindern – so oft, wie du sie besitzt (${q}×).` : null;
}

// Wie oft jeder Sammlungseintrag insgesamt schon in Bindern liegt
export async function binderCounts(itemIds: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  for (let i = 0; i < itemIds.length; i += 100) {
    const { data } = await supabase.from("binder_slots").select("item_id").in("item_id", itemIds.slice(i, i + 100)).limit(5000);
    for (const r of (data ?? []) as { item_id: string }[]) m.set(r.item_id, (m.get(r.item_id) ?? 0) + 1);
  }
  return m;
}

export async function placeItem(binderId: string, page: number, slot: number, itemId: string): Promise<string | null> {
  const cap = await capacityError(itemId); if (cap) return cap;
  const { error } = await supabase.from("binder_slots").insert({ binder_id: binderId, page, slot, item_id: itemId });
  return error ? (error.code === "23505" ? "Dieser Platz ist schon belegt." : error.message) : null;
}

// Karte ohne festen Platz in den Binder legen
export async function addItemUnplaced(binderId: string, itemId: string): Promise<string | null> {
  const cap = await capacityError(itemId); if (cap) return cap;
  const { error } = await supabase.from("binder_slots").insert({ binder_id: binderId, page: null, slot: null, item_id: itemId });
  return error?.message ?? null;
}

// Karte behalten, aber den festen Platz freigeben
export async function unplaceSlot(slotId: string): Promise<string | null> {
  const { error } = await supabase.from("binder_slots").update({ page: null, slot: null }).eq("id", slotId);
  return error?.message ?? null;
}

export async function fetchSlotsLite(binderId: string): Promise<{ page: number | null; slot: number | null; item_id: string }[]> {
  const out: { page: number | null; slot: number | null; item_id: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from("binder_slots").select("page,slot,item_id").eq("binder_id", binderId).range(from, from + 999);
    out.push(...((data ?? []) as any));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// Platz verschieben; ist das Ziel belegt, tauschen beide Karten
export async function moveSlot(binderId: string, from: Slot, toPage: number, toSlot: number, target: Slot | null): Promise<string | null> {
  if (!target) {
    const { error } = await supabase.from("binder_slots").update({ page: toPage, slot: toSlot }).eq("id", from.id);
    return error?.message ?? null;
  }
  const { error: e1 } = await supabase.from("binder_slots").update({ item_id: target.item_id }).eq("id", from.id);
  if (e1) return e1.message;
  const { error: e2 } = await supabase.from("binder_slots").update({ item_id: from.item_id }).eq("id", target.id);
  return e2?.message ?? null;
}

export async function removeSlot(slotId: string): Promise<string | null> {
  const { error } = await supabase.from("binder_slots").delete().eq("id", slotId);
  return error?.message ?? null;
}

// Einstellung: Umblätter-Animation (unter "Mehr" abschaltbar)
const FLIP_KEY = "pref:binderPageFlip";
export async function getPageFlip(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(FLIP_KEY)) !== "off"; } catch { return true; }
}
export async function setPageFlip(on: boolean) {
  try { await AsyncStorage.setItem(FLIP_KEY, on ? "on" : "off"); } catch { /* egal */ }
}

// Reihenfolge der Binder speichern (Liste von Binder-IDs in gewünschter Reihenfolge)
export async function saveBinderOrder(ids: string[]): Promise<string | null> {
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase.from("binders").update({ sort_order: i + 1 }).eq("id", ids[i]);
    if (error) return error.message;
  }
  return null;
}
