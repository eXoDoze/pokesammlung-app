import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { CardTags } from "../../components/CardTags";
import { ItemForm, FormValues } from "../../components/ItemForm";
import { Btn, H, Panel, Pill, Screen, Stat, Sub, Txt } from "../../components/ui";
import { PriceRow, Variant, jaLinkProduct, latestPrices, ITEM_SELECT, Item, valuesForItems, Value } from "../../lib/data";
import { FINISH_LABEL, cardName, cardmarketUrl, ebaySoldUrl, eur, isFirstEd, variantLabel, setTitle } from "../../lib/labels";
import { useApp } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { hueFor } from "../../lib/theme";

type Card = {
  id: string; number: string; name_en: string | null; name_de: string | null; name_ja: string | null; name_ko?: string | null; name_zh?: string | null;
  rarity: string | null; image_url: string | null; set_id: string;
  sets: { name_en: string | null; name_de: string | null; name_ja: string | null; region: string } | null;
  card_variants: Variant[];
};

export default function CardScreen() {
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = decodeURIComponent(String(raw));
  const { active } = useApp();
  const router = useRouter();
  const [card, setCard] = useState<Card | null>(null);
  const [prices, setPrices] = useState<Map<number, PriceRow>>(new Map());
  const [lang, setLang] = useState("de");
  const [jaProduct, setJaProduct] = useState<number | null>(null);
  const [mine, setMine] = useState<{ item: Item; value: Value }[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("cards")
        .select("id,number,name_en,name_de,name_ja,name_ko,name_zh,rarity,image_url,set_id,sets(name_en,name_de,name_ja,name_ko,name_zh,region),card_variants(id,finish,subtype,stamps,cardmarket_product_id)")
        .eq("id", id).single();
      const c = data as any as Card | null;
      setCard(c);
      setJaProduct(await jaLinkProduct(id));
      if (active) {
        const own = await supabase.from("collection_items").select(ITEM_SELECT).eq("collection_id", active.id).eq("status", "owned").eq("card_id", id);
        const items = (own.data ?? []) as any as Item[];
        const vals = items.length ? await valuesForItems(items) : new Map();
        setMine(items.map((it) => ({ item: it, value: vals.get(it.id) ?? null })));
      }
      if (c) {
        setLang(c.sets?.region === "japan" ? "ja" : "de");
        setPrices(await latestPrices(c.card_variants.map((v) => v.cardmarket_product_id).filter(Boolean) as number[]));
      }
    })();
  }, [id, active?.id]);

  if (!card) return <Screen><Sub style={{ padding: 16 }}>Lade …</Sub></Screen>;
  const setName = setTitle(card.sets as any);

  const save = async (v: FormValues) => {
    if (!active) throw new Error("Keine Sammlung gewählt.");
    const { error } = await supabase.from("collection_items").insert({ ...v, collection_id: active.id, card_id: card.id });
    if (error) throw new Error(error.message);
    Alert.alert("Hinzugefügt", `${cardName(card)} liegt jetzt in „${active.name}“.`);
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: cardName(card) }} />
      <ScrollView contentContainerStyle={{ padding: 16, maxWidth: 760, width: "100%", alignSelf: "center" }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", borderRadius: 24, paddingVertical: 20, backgroundColor: `hsl(${hueFor(card.set_id)}, 42%, 17%)` }}>
          {card.image_url
            ? <Image source={{ uri: card.image_url }} style={{ width: 260, height: 364 }} contentFit="contain" />
            : <View style={{ width: 260, height: 364, alignItems: "center", justifyContent: "center" }}><Sub>Kein Bild vorhanden</Sub></View>}
        </View>
        <Txt bold style={{ fontSize: 22, marginTop: 14 }}>{cardName(card)}</Txt>
        {card.name_en && card.name_en !== cardName(card) ? <Sub>{card.name_en}</Sub> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 2 }}>
          <Pressable onPress={() => router.push(`/set/${encodeURIComponent(card.set_id)}`)}><Pill label={`${setName} ›`} tone="accent" /></Pressable>
          {card.number ? <Pill label={`#${card.number}`} /> : null}
          {card.rarity && card.rarity !== "None" ? <Pill label={card.rarity} /> : null}
          <CardTags card={card} />
        </View>

        {mine.length > 0 && (
          <>
            <H>In deiner Sammlung</H>
            <Panel>
              {mine.map(({ item: it, value }) => (
                <Pressable key={it.id} onPress={() => router.push(`/item/${it.id}`)} style={{ paddingVertical: 8 }}>
                  <Txt bold>{it.quantity > 1 ? `${it.quantity}× ` : ""}{FINISH_LABEL[it.finish] ?? it.finish}{it.stamp ? ` · ${it.stamp}` : ""} · {it.is_graded ? `${it.grading_company} ${it.grade}` : it.condition} · {it.language.toUpperCase()}</Txt>
                  <Sub>{value ? `${eur(value.price)} pro Karte` : "kein Preis"} · Eintrag öffnen ›</Sub>
                </Pressable>
              ))}
            </Panel>
          </>
        )}

        <H>Marktpreise (Cardmarket, alle Zustände gemischt)</H>
        <Panel>
          {card.card_variants.length === 0 && <Sub>Keine Varianten bekannt.</Sub>}
          {jaProduct && (
            <View style={{ paddingVertical: 6 }}>
              <Txt bold>Japanische Karte</Txt>
              <Sub>Kein Marktwert: Cardmarkets Preisdatei gilt für alle Sprachen gemischt. Die Zuordnung zum englischen Produkt wurde automatisch gefunden und kann ungenau sein.</Sub>
              <Btn kind="ghost" title="Auf Cardmarket ansehen (Japanisch, alle Verkäufer)"
                onPress={() => Linking.openURL(cardmarketUrl({ productId: jaProduct, languageCode: "ja" })!)} />
            </View>
          )}
          {!jaProduct && card.card_variants.length > 0 && card.card_variants.every((v) => !v.cardmarket_product_id) && (
            <Sub>Für diese Karte ist kein Cardmarket-Produkt bekannt. Du kannst beim Eintrag einen eigenen Wert setzen.</Sub>
          )}
          {card.card_variants.map((v) => {
            const row = v.cardmarket_product_id ? prices.get(Number(v.cardmarket_product_id)) : undefined;
            const rev = v.finish === "reverse_holo";
            const trend = row ? (rev ? row.trend_foil : row.trend) : null;
            const low = row ? (rev ? row.low_foil : row.low) : null;
            const url = cardmarketUrl({ productId: v.cardmarket_product_id, languageCode: lang, reverse: rev, firstEd: isFirstEd(v.subtype) });
            return (
              <View key={v.id} style={{ paddingVertical: 6 }}>
                <Txt bold>{variantLabel(v)}</Txt>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                  <Stat label="Trend" value={eur(trend)} />
                  <Stat label="Ab" value={eur(low)} />
                </View>
                {!row ? <Sub style={{ marginTop: 4 }}>Kein Preis vorhanden</Sub> : null}
                {url && <Btn kind="ghost" title="Auf Cardmarket ansehen (alle Verkäufer)" onPress={() => Linking.openURL(url)} />}
                {url && <Btn kind="ghost" title="Auf Cardmarket ansehen (nur Deutschland)" onPress={() => Linking.openURL(cardmarketUrl({ productId: v.cardmarket_product_id, languageCode: lang, reverse: rev, firstEd: isFirstEd(v.subtype), germanOnly: true })!)} />}
              </View>
            );
          })}
          {(() => {
            // Gibt es offiziell keine Reverse-Holo-Variante, trotzdem einen Link mit Reverse-Holo-Filter anbieten
            const base = card.card_variants.find((v) => v.cardmarket_product_id);
            if (!base || card.card_variants.some((v) => v.finish === "reverse_holo")) return null;
            const url = cardmarketUrl({ productId: base.cardmarket_product_id, languageCode: lang, reverse: true });
            return url ? <Btn kind="ghost" title="Auf Cardmarket ansehen (Reverse Holo-Filter)" onPress={() => Linking.openURL(url)} /> : null;
          })()}
          <Btn kind="ghost" title="eBay: verkaufte Artikel ansehen" onPress={() => Linking.openURL(ebaySoldUrl(card.name_en ?? cardName(card), card.number, card.sets?.name_en))} />
        </Panel>

        <H>Zur Sammlung „{active?.name ?? "–"}“ hinzufügen</H>
        <ItemForm variants={card.card_variants} onSave={save} saveLabel="Hinzufügen" defaultLanguage={lang} />
      </ScrollView>
    </Screen>
  );
}
