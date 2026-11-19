import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Linking, ScrollView } from "react-native";
import { FormValues, ItemForm } from "../../components/ItemForm";
import { Btn, Field, H, Panel, Pill, Screen, Segmented, Sub } from "../../components/ui";
import { ITEM_SELECT, Item } from "../../lib/data";
import { cardName, cardmarketUrl } from "../../lib/labels";
import { jaLinkProduct, pickVariant } from "../../lib/data";
import { supabase } from "../../lib/supabase";

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [jaProduct, setJaProduct] = useState<number | null>(null);
  const [closeKind, setCloseKind] = useState<"sold" | "traded">("sold");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    supabase.from("collection_items").select(ITEM_SELECT).eq("id", id).single().then(async ({ data }) => { setItem(data as any); if (data) setJaProduct(await jaLinkProduct((data as any).card_id)); });
  }, [id]);

  if (!item) return <Screen><Sub style={{ padding: 16 }}>Lade …</Sub></Screen>;
  const variants = item.cards.card_variants ?? [];
  const v = pickVariant(item, variants);
  const url = cardmarketUrl({ productId: v?.cardmarket_product_id ?? jaProduct, languageCode: item.language, condition: item.is_graded ? "MT" : item.condition, reverse: item.finish === "reverse_holo", firstEd: item.is_first_edition });

  const save = async (vals: FormValues) => {
    const { error } = await supabase.from("collection_items").update(vals).eq("id", item.id);
    if (error) throw new Error(error.message);
    router.back();
  };
  const close = async () => {
    const p = price.trim() === "" ? null : Number(price.replace(",", "."));
    if (p != null && !isFinite(p)) { Alert.alert("Preis ungültig", "Bitte eine Zahl eingeben, z. B. 12,50"); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { Alert.alert("Datum ungültig", "Format: JJJJ-MM-TT"); return; }
    const { error } = await supabase.from("collection_items").update({
      status: closeKind, closed_at: date, sold_price: closeKind === "sold" ? p : null, closed_note: note.trim() || null,
    }).eq("id", item.id);
    if (error) { Alert.alert("Fehler", error.message); return; }
    router.back();
  };
  const reopen = async () => {
    const { error } = await supabase.from("collection_items").update({ status: "owned", closed_at: null, sold_price: null, closed_note: null }).eq("id", item.id);
    if (error) { Alert.alert("Fehler", error.message); return; }
    router.back();
  };
  const isClosed = !!item.status && item.status !== "owned";
  const remove = () =>
    Alert.alert("Eintrag löschen?", `${cardName(item.cards)} aus der Sammlung entfernen?`, [
      { text: "Abbrechen", style: "cancel" },
      { text: "Löschen", style: "destructive", onPress: async () => { await supabase.from("collection_items").delete().eq("id", item.id); router.back(); } },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: cardName(item.cards) }} />
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <Btn kind="ghost" title="Karte ansehen" onPress={() => router.push(`/card/${encodeURIComponent(item.card_id)}`)} />
        {url && <Btn kind="ghost" title="Auf Cardmarket mit meinem Zustand (deutsche Verkäufer)" onPress={() => Linking.openURL(url)} />}
        {isClosed ? (
          <Panel>
            <Pill label={item.status === "sold" ? "Verkauft" : "Getauscht"} tone={item.status === "sold" ? "good" : "accent"} />
            <Sub>{item.closed_at ?? ""}{item.sold_price != null ? ` · ${item.sold_price.toFixed(2).replace(".", ",")} € pro Karte` : ""}</Sub>
            {item.closed_note ? <Sub>{item.closed_note}</Sub> : null}
            <Btn kind="ghost" title="Zurück in den Bestand" onPress={reopen} />
          </Panel>
        ) : closing ? (
          <Panel>
            <H>Verkaufen oder tauschen</H>
            <Segmented value={closeKind} onChange={(x) => setCloseKind(x as "sold" | "traded")} options={[{ value: "sold", label: "Verkauft" }, { value: "traded", label: "Getauscht" }]} />
            {closeKind === "sold" && <Field label="Verkaufspreis pro Karte (€)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="z. B. 12,50" />}
            <Field label="Datum (JJJJ-MM-TT)" value={date} onChangeText={setDate} />
            <Field label={closeKind === "sold" ? "Notiz (Käufer, Plattform …)" : "Notiz (Tauschpartner, gegen was …)"} value={note} onChangeText={setNote} />
            <Btn title="Speichern" onPress={close} />
            <Btn kind="ghost" title="Abbrechen" onPress={() => setClosing(false)} />
          </Panel>
        ) : (
          <Btn title="Verkauft / getauscht …" onPress={() => setClosing(true)} />
        )}
        <H>Eintrag bearbeiten</H>
        <ItemForm variants={variants} lockVariant initial={{ ...item, variant_id: v?.id ?? null }} onSave={save} saveLabel="Speichern" />
        <Btn kind="danger" title="Eintrag löschen" onPress={remove} />
      </ScrollView>
    </Screen>
  );
}
