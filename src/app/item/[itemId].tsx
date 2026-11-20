import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { CardTags } from "../../components/CardTags";
import { FormValues, ItemForm } from "../../components/ItemForm";
import { Btn, Field, H, Panel, Pill, Screen, Segmented, Stat, Sub, Txt } from "../../components/ui";
import { ITEM_SELECT, Item, PriceRow, Value, latestPrices, valuesForItems } from "../../lib/data";
import { cardName, cardmarketUrl, eur, setTitle } from "../../lib/labels";
import { jaLinkProduct, pickVariant } from "../../lib/data";
import { supabase } from "../../lib/supabase";
import { hueFor } from "../../lib/theme";

export default function ItemScreen() {
  const { itemId: id } = useLocalSearchParams<{ itemId: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [jaProduct, setJaProduct] = useState<number | null>(null);
  const [closeKind, setCloseKind] = useState<"sold" | "traded">("sold");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [closing, setClosing] = useState(false);
  const [rarity, setRarity] = useState<string | null>(null);
  const [val, setVal] = useState<Value>(null);
  const [row, setRow] = useState<PriceRow | null>(null);

  useEffect(() => {
    supabase.from("collection_items").select(ITEM_SELECT).eq("id", id).single().then(async ({ data }) => { setItem(data as any); if (data) setJaProduct(await jaLinkProduct((data as any).card_id)); });
  }, [id]);

  useEffect(() => {
    if (!item) return;
    (async () => {
      const c = await supabase.from("cards").select("rarity").eq("id", item.card_id).single();
      setRarity((c.data as any)?.rarity ?? null);
      setVal((await valuesForItems([item])).get(item.id) ?? null);
      const pv = pickVariant(item, item.cards.card_variants ?? []);
      if (pv?.cardmarket_product_id) setRow((await latestPrices([Number(pv.cardmarket_product_id)])).get(Number(pv.cardmarket_product_id)) ?? null);
    })();
  }, [item]);

  if (!item) return <Screen><Sub style={{ padding: 16 }}>Lade …</Sub></Screen>;
  const variants = item.cards.card_variants ?? [];
  const v = pickVariant(item, variants);
  const urlOpts = { productId: v?.cardmarket_product_id ?? jaProduct, languageCode: item.language, condition: item.is_graded ? "MT" : item.condition, reverse: item.finish === "reverse_holo", firstEd: item.is_first_edition };
  const url = cardmarketUrl(urlOpts);
  const urlDe = cardmarketUrl({ ...urlOpts, germanOnly: true });
  const rev = item.finish === "reverse_holo";
  const trend = row ? (rev ? row.trend_foil : row.trend) : null;
  const low = row ? (rev ? row.low_foil : row.low) : null;
  const kindLabel = val ? (val.kind === "zustand" ? "Zustandspreis" : val.kind === "markt" ? "Cardmarket-Trend (alle Zustände gemischt)" : "Eigener Wert") : "";

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
        <View style={{ alignItems: "center", borderRadius: 24, paddingVertical: 20, backgroundColor: `hsl(${hueFor(item.cards.set_id)}, 42%, 17%)` }}>
          {item.cards.image_url
            ? <Image source={{ uri: item.cards.image_url }} style={{ width: 240, height: 336 }} contentFit="contain" />
            : <View style={{ width: 240, height: 336, alignItems: "center", justifyContent: "center" }}><Sub>Kein Bild vorhanden</Sub></View>}
        </View>
        <Txt bold style={{ fontSize: 22, marginTop: 14 }}>{item.quantity > 1 ? `${item.quantity}× ` : ""}{cardName(item.cards)}</Txt>
        {item.cards.name_en && item.cards.name_en !== cardName(item.cards) ? <Sub>{item.cards.name_en}</Sub> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 2 }}>
          <Pressable onPress={() => router.push(`/set/${encodeURIComponent(item.cards.set_id)}`)}><Pill label={`${setTitle(item.cards.sets as any)} ›`} tone="accent" /></Pressable>
          {item.cards.number ? <Pill label={`#${item.cards.number}`} /> : null}
          {rarity && rarity !== "None" ? <Pill label={rarity} /> : null}
          <CardTags card={{ name_en: item.cards.name_en, rarity }} />
        </View>

        <H>Aktueller Wert</H>
        <Panel>
          {val ? (
            <>
              <Txt bold style={{ fontSize: 24 }}>{eur(val.price)}{item.quantity > 1 ? `  ·  ${eur(val.price * item.quantity)} gesamt` : ""}</Txt>
              <Sub>{kindLabel}</Sub>
            </>
          ) : <Sub>Kein Preis vorhanden. Du kannst unten einen eigenen Wert eintragen.</Sub>}
          {(trend != null || low != null) && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Stat label={`Trend${rev ? " (Reverse)" : ""}`} value={eur(trend)} />
              <Stat label="Ab" value={eur(low)} />
            </View>
          )}
          {url && <Btn kind="ghost" title="Auf Cardmarket ansehen (alle Verkäufer)" onPress={() => Linking.openURL(url)} />}
          {urlDe && <Btn kind="ghost" title="Auf Cardmarket ansehen (nur Deutschland)" onPress={() => Linking.openURL(urlDe)} />}
        </Panel>

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
