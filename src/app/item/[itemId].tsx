import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { BinderZuweisen } from "../../components/BinderZuweisen";
import { CardTags } from "../../components/CardTags";
import { FormValues, ItemForm } from "../../components/ItemForm";
import { Btn, CardImg, Field, H, Panel, Pill, Screen, Segmented, Stat, Sub, Txt } from "../../components/ui";
import { CondPrice, ITEM_SELECT, Item, PriceRow, Value, findCond, latestCondPrices, latestPrices, priceGuideFits, valuesForItems } from "../../lib/data";
import { cardName, cardmarketUrl, cmLanguage, reverseFilterApplies, conditionLabel, deToIso, eur, isoToDe, setTitle, todayDe } from "../../lib/labels";
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
  const [date, setDate] = useState(todayDe());
  const [note, setNote] = useState("");
  const [closing, setClosing] = useState(false);
  const [rarity, setRarity] = useState<string | null>(null);
  const [val, setVal] = useState<Value>(null);
  const [row, setRow] = useState<PriceRow | null>(null);
  const [cond, setCond] = useState<CondPrice[]>([]);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveMsg, setLiveMsg] = useState("");

  useEffect(() => {
    supabase.from("collection_items").select(ITEM_SELECT).eq("id", id).single().then(async ({ data }) => { setItem(data as any); if (data) setJaProduct(await jaLinkProduct((data as any).card_id)); });
  }, [id]);

  useEffect(() => {
    if (!item) return;
    (async () => {
      const c = await supabase.from("cards").select("rarity").eq("id", item.card_id).single();
      setRarity((c.data as any)?.rarity ?? null);
      setVal((await valuesForItems([item])).get(item.id) ?? null);
      setCond(await latestCondPrices([item.card_id]));
      const pv = pickVariant(item, item.cards.card_variants ?? []);
      if (pv?.cardmarket_product_id) setRow((await latestPrices([Number(pv.cardmarket_product_id)])).get(Number(pv.cardmarket_product_id)) ?? null);
    })();
  }, [item]);

  if (!item) return <Screen><Sub style={{ padding: 16 }}>Lade …</Sub></Screen>;
  const variants = item.cards.card_variants ?? [];
  const v = pickVariant(item, variants);
  const urlOpts = { directUrl: item.cards.cardmarket_url, productId: v?.cardmarket_product_id ?? jaProduct, languageCode: cmLanguage(item.cards.set_id, item.language), condition: item.is_graded ? "MT" : item.condition, reverse: reverseFilterApplies(item.finish, variants), firstEd: item.is_first_edition };
  const url = cardmarketUrl(urlOpts);
  const urlDe = cardmarketUrl({ ...urlOpts, germanOnly: true });
  const rev = item.finish === "reverse_holo";
  const fits = priceGuideFits(item.language, v);
  const trend = row && fits ? (rev ? row.trend_foil : row.trend) : null;
  const low = row && fits ? (rev ? row.low_foil : row.low) : null;
  const urlPlain = cardmarketUrl({ productId: v?.cardmarket_product_id ?? jaProduct, directUrl: item.cards.cardmarket_url });
  const deCond = findCond(item, cond, "DE");
  const kindLabel = val
    ? val.kind === "zustand" ? `Günstigstes Angebot · ${conditionLabel(item.condition)} · alle Verkäufer`
      : val.kind === "ab" ? "Günstigstes Angebot · alle Zustände · alle Verkäufer"
      : val.kind === "markt" ? "Cardmarket-Trend (kein günstigster Preis vorhanden)"
      : "Eigener Wert (hat Vorrang vor Cardmarket)"
    : "";

  const save = async (vals: FormValues) => {
    const { error } = await supabase.from("collection_items").update(isWish ? { ...vals, status: "owned" } : vals).eq("id", item.id);
    if (error) throw new Error(error.message);
    if (isWish) Alert.alert("In der Sammlung", `${cardName(item.cards)} liegt jetzt in deiner Sammlung.`);
    router.back();
  };
  const refreshLive = async () => {
    setLiveBusy(true); setLiveMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("live-price", {
        body: { card_id: item.card_id, variant_id: v?.id ?? null, language: cmLanguage(item.cards.set_id, item.language), condition: item.condition, finish: item.finish, first_ed: item.is_first_edition },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as { all: number | null; de: number | null; offers: number };
      setCond(await latestCondPrices([item.card_id]));
      setVal((await valuesForItems([item])).get(item.id) ?? null);
      setLiveMsg(d.all == null ? "Aktuell kein Angebot in diesem Zustand auf Cardmarket." : `Aktualisiert: ${eur(d.all)} (alle Verkäufer, ${d.offers} Angebote)${d.de != null ? ` · ${eur(d.de)} (nur Deutschland)` : ""}`);
    } catch (e: any) { setLiveMsg(`Preis konnte nicht geladen werden: ${e.message ?? e}`); }
    setLiveBusy(false);
  };
  const close = async () => {
    const p = price.trim() === "" ? null : Number(price.replace(",", "."));
    if (p != null && !isFinite(p)) { Alert.alert("Preis ungültig", "Bitte eine Zahl eingeben, z. B. 12,50"); return; }
    const dateIso = deToIso(date);
    if (!dateIso) { Alert.alert("Datum ungültig", "Format: TT.MM.JJJJ (z. B. 19.11.2026)"); return; }
    const { error } = await supabase.from("collection_items").update({
      status: closeKind, closed_at: dateIso, sold_price: closeKind === "sold" ? p : null, closed_note: note.trim() || null,
    }).eq("id", item.id);
    if (error) { Alert.alert("Fehler", error.message); return; }
    router.back();
  };
  const reopen = async () => {
    const { error } = await supabase.from("collection_items").update({ status: "owned", closed_at: null, sold_price: null, closed_note: null }).eq("id", item.id);
    if (error) { Alert.alert("Fehler", error.message); return; }
    router.back();
  };
  const isWish = item.status === "wishlist";
  const isClosed = item.status === "sold" || item.status === "traded";
  const remove = () =>
    Alert.alert(isWish ? "Von der Wunschliste entfernen?" : "Eintrag löschen?", `${cardName(item.cards)} ${isWish ? "von der Wunschliste" : "aus der Sammlung"} entfernen?`, [
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
            : <CardImg uri={null} width={240} height={336} radius={12} label={cardName(item.cards)} />}
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
          ) : <Sub>{row && !fits ? "Kein Preis angezeigt: Cardmarket führt diese Karte nur als gemeinsames Produkt für mehrere Sprachen, ein Preis wäre ungenau. Schau über den Link ohne Filter nach und trag unten einen eigenen Wert ein." : "Kein Preis vorhanden. Du kannst unten einen eigenen Wert eintragen."}</Sub>}
          {!item.is_graded && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Stat label={`Nur Verkäufer aus Deutschland · ${conditionLabel(item.condition)}`} value={eur(deCond ? Number(deCond.price) : null)} />
            </View>
          )}
          {val?.kind === "ab" && !item.is_graded && !rev ? <Sub style={{ marginTop: 6 }}>Der Preis für „{conditionLabel(item.condition)}" wird beim nächsten Preis-Update ergänzt. Bis dahin gilt der günstigste Preis über alle Zustände.</Sub> : null}
          {(trend != null || low != null) && (
            <Sub style={{ marginTop: 8, fontSize: 12 }}>
              {low != null ? `Ab (alle Zustände): ${eur(low)}` : ""}{low != null && trend != null ? "  ·  " : ""}{trend != null ? `Trend (Mischzustände): ${eur(trend)}` : ""}
            </Sub>
          )}
          {!item.is_graded && <Btn title="Preis jetzt aktualisieren" onPress={refreshLive} busy={liveBusy} />}
          {liveMsg ? <Sub style={{ marginTop: 4 }}>{liveMsg}</Sub> : null}
          {url && <Btn kind="ghost" title="Auf Cardmarket ansehen (alle Verkäufer)" onPress={() => Linking.openURL(url)} />}
          {urlDe && <Btn kind="ghost" title="Auf Cardmarket ansehen (nur Deutschland)" onPress={() => Linking.openURL(urlDe)} />}
          {urlPlain && !val && <Btn kind="ghost" title="Auf Cardmarket ansehen (ohne Filter)" onPress={() => Linking.openURL(urlPlain)} />}
        </Panel>

        {isClosed ? (
          <Panel>
            <Pill label={item.status === "sold" ? "Verkauft" : "Getauscht"} tone={item.status === "sold" ? "good" : "accent"} />
            <Sub>{isoToDe(item.closed_at)}{item.sold_price != null ? ` · ${item.sold_price.toFixed(2).replace(".", ",")} € pro Karte` : ""}</Sub>
            {item.closed_note ? <Sub>{item.closed_note}</Sub> : null}
            <Btn kind="ghost" title="Zurück in den Bestand" onPress={reopen} />
          </Panel>
        ) : closing ? (
          <Panel>
            <H>Verkaufen oder tauschen</H>
            <Segmented value={closeKind} onChange={(x) => setCloseKind(x as "sold" | "traded")} options={[{ value: "sold", label: "Verkauft" }, { value: "traded", label: "Getauscht" }]} />
            {closeKind === "sold" && <Field label="Verkaufspreis pro Karte (€)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="z. B. 12,50" />}
            <Field label="Datum (TT.MM.JJJJ)" value={date} onChangeText={setDate} />
            <Field label={closeKind === "sold" ? "Notiz (Käufer, Plattform …)" : "Notiz (Tauschpartner, gegen was …)"} value={note} onChangeText={setNote} />
            <Btn title="Speichern" onPress={close} />
            <Btn kind="ghost" title="Abbrechen" onPress={() => setClosing(false)} />
          </Panel>
        ) : isWish ? null : (
          <Btn title="Verkauft / getauscht …" onPress={() => setClosing(true)} />
        )}
        {!isWish && !isClosed && <BinderZuweisen itemId={item.id} />}
        <H>{isWish ? "Gekauft? Zustand und Kaufpreis eintragen" : "Eintrag bearbeiten"}</H>
        {isWish && <Sub>Diese Karte steht auf deiner Wunschliste. Mit „In Sammlung übernehmen“ wandert sie samt Zustand, Kaufpreis und Datum in deine Sammlung.</Sub>}
        <ItemForm variants={variants} region={item.cards.sets?.region ?? "international"} initial={{ ...item, variant_id: v?.id ?? null }} onSave={save} saveLabel={isWish ? "In Sammlung übernehmen" : "Speichern"} />
        <Btn kind="danger" title={isWish ? "Von der Wunschliste entfernen" : "Eintrag löschen"} onPress={remove} />
      </ScrollView>
    </Screen>
  );
}
