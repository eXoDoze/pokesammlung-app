import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { CardTags } from "../../components/CardTags";
import { ItemForm, FormValues } from "../../components/ItemForm";
import { Btn, Chip, H, Panel, Pill, Row, Screen, Stat, Sub, Txt } from "../../components/ui";
import { CondPrice, PriceRow, Variant, jaLinkProduct, latestCondPrices, latestPrices, ITEM_SELECT, Item, priceGuideFits, valuesForItems, Value } from "../../lib/data";
import { CONDITIONS, FINISH_LABEL, cardName, cardmarketUrl, ebaySoldUrl, eur, isFirstEd, isShadowless, variantLabel, setTitle } from "../../lib/labels";
import { useApp } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { hueFor } from "../../lib/theme";

type Card = {
  id: string; number: string; name_en: string | null; name_de: string | null; name_ja: string | null; name_ko?: string | null; name_zh?: string | null;
  rarity: string | null; image_url: string | null; set_id: string; cardmarket_url?: string | null;
  sets: { name_en: string | null; name_de: string | null; name_ja: string | null; region: string } | null;
  card_variants: Variant[];
};

export default function CardScreen() {
  const { cardId: raw } = useLocalSearchParams<{ cardId: string }>();
  const id = decodeURIComponent(String(raw));
  const { active } = useApp();
  const router = useRouter();
  const [card, setCard] = useState<Card | null>(null);
  const [prices, setPrices] = useState<Map<number, PriceRow>>(new Map());
  const [lang, setLang] = useState("de");
  const [jaProduct, setJaProduct] = useState<number | null>(null);
  const [versionCount, setVersionCount] = useState(0);
  const [wish, setWish] = useState<Item | null>(null);
  const [liveCond, setLiveCond] = useState("NM");
  const [liveBusy, setLiveBusy] = useState<string | null>(null);
  const [liveMsg, setLiveMsg] = useState<Record<string, string>>({});
  const [cond, setCond] = useState<CondPrice[]>([]);
  const [mine, setMine] = useState<{ item: Item; value: Value }[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("cards")
        .select("id,number,name_en,name_de,name_ja,name_ko,name_zh,rarity,image_url,set_id,cardmarket_url,sets(name_en,name_de,name_ja,name_ko,name_zh,region),card_variants(id,finish,subtype,stamps,cardmarket_product_id,asia_product)")
        .eq("id", id).single();
      const c = data as any as Card | null;
      setCard(c);
      setJaProduct(await jaLinkProduct(id));
      setCond(await latestCondPrices([id]));
      supabase.rpc("card_versions", { p_card_id: id }).then(({ data: v }) => setVersionCount((v ?? []).length));
      if (active) {
        const own = await supabase.from("collection_items").select(ITEM_SELECT).eq("collection_id", active.id).eq("status", "owned").eq("card_id", id);
        const items = (own.data ?? []) as any as Item[];
        const vals = items.length ? await valuesForItems(items) : new Map();
        setMine(items.map((it) => ({ item: it, value: vals.get(it.id) ?? null })));
        const w = await supabase.from("collection_items").select(ITEM_SELECT).eq("collection_id", active.id).eq("status", "wishlist").eq("card_id", id).limit(1);
        setWish(((w.data ?? [])[0] ?? null) as any as Item | null);
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

  const liveLang = card.sets?.region === "japan" ? "ja" : card.sets?.region === "korea" ? "ko" : card.sets?.region === "china" ? "zh-cn" : card.sets?.region === "taiwan" ? "zh-tw" : "de";

  const loadLive = async (v: Variant) => {
    setLiveBusy(v.id);
    setLiveMsg((m) => ({ ...m, [v.id]: "" }));
    try {
      const { data, error } = await supabase.functions.invoke("live-price", {
        body: { card_id: card.id, variant_id: v.id, language: liveLang, condition: liveCond, finish: v.finish, first_ed: isFirstEd(v.subtype) },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as { all: number | null; de: number | null; offers: number; cached?: boolean };
      setCond(await latestCondPrices([id]));
      const label = CONDITIONS.find((c) => c.code === liveCond)?.label ?? liveCond;
      setLiveMsg((m) => ({ ...m, [v.id]: d.all == null
        ? `Zustand ${label}: aktuell kein Angebot auf Cardmarket.`
        : `${label}: günstigstes Angebot ${eur(d.all)} (alle Verkäufer, ${d.offers} Angebote)${d.de != null ? ` · ${eur(d.de)} (nur Deutschland)` : ""}${d.cached ? " · vor wenigen Minuten geladen" : " · gerade geladen"}` }));
    } catch (e: any) {
      setLiveMsg((m) => ({ ...m, [v.id]: `Preis konnte nicht geladen werden: ${e.message ?? e}` }));
    }
    setLiveBusy(null);
  };

  const addWish = async () => {
    if (!active) return Alert.alert("Keine Sammlung gewählt");
    const v = card.card_variants[0];
    const { data, error } = await supabase.from("collection_items").insert({
      collection_id: active.id, card_id: card.id, status: "wishlist", quantity: 1, condition: "NM", language: lang, is_graded: false,
      variant_id: v?.id ?? null, finish: v?.finish ?? "non_holo", is_first_edition: v ? isFirstEd(v.subtype) : false, is_shadowless: v ? isShadowless(v.subtype) : false,
    }).select(ITEM_SELECT).single();
    if (error) return Alert.alert("Fehler", error.message);
    setWish(data as any as Item);
  };
  const removeWish = async () => {
    if (!wish) return;
    await supabase.from("collection_items").delete().eq("id", wish.id);
    setWish(null);
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

        <View style={{ marginTop: 10 }}>
          {wish ? (
            <Panel>
              <Txt bold>♥ Auf deiner Wunschliste</Txt>
              <Btn kind="ghost" title="Wunschliste öffnen" onPress={() => router.push("/wunschliste" as any)} />
              <Btn kind="ghost" title="Von der Wunschliste entfernen" onPress={removeWish} />
            </Panel>
          ) : (
            <Btn kind="ghost" title="♡ Auf die Wunschliste" onPress={addWish} />
          )}
          {versionCount > 0 && (
            <Btn kind="ghost" title={`Weitere Versionen anzeigen (${versionCount}) ›`} onPress={() => router.push(`/card-versions?id=${encodeURIComponent(id)}` as any)} />
          )}
        </View>

        <H>Preise (Cardmarket)</H>
        <Panel>
          {card.card_variants.length === 0 && <Sub>Keine Varianten bekannt.</Sub>}
          {jaProduct && (
            <View style={{ paddingVertical: 6 }}>
              <Txt bold>Japanische Karte</Txt>
              <Sub>Kein Marktwert: Cardmarkets Preisdatei gilt für alle Sprachen gemischt. Die Zuordnung zum englischen Produkt wurde automatisch gefunden und kann ungenau sein.</Sub>
              <Btn kind="ghost" title="Auf Cardmarket ansehen (Japanisch, alle Verkäufer)"
                onPress={() => Linking.openURL(cardmarketUrl({ productId: jaProduct, languageCode: "ja", directUrl: card.cardmarket_url })!)} />
            </View>
          )}
          {!jaProduct && card.card_variants.length > 0 && card.card_variants.every((v) => !v.cardmarket_product_id) && (
            <Sub>Für diese Karte ist kein Cardmarket-Produkt bekannt. Du kannst beim Eintrag einen eigenen Wert setzen.</Sub>
          )}
          <Sub>Aktuellen Preis live von Cardmarket laden, z. B. beim Kaufen auf einer Messe:</Sub>
          <Row>{CONDITIONS.map((c) => <Chip key={c.code} label={c.label} on={liveCond === c.code} onPress={() => setLiveCond(c.code)} />)}</Row>
          {card.card_variants.map((v) => {
            const row = v.cardmarket_product_id ? prices.get(Number(v.cardmarket_product_id)) : undefined;
            const rev = v.finish === "reverse_holo";
            // Karte und Cardmarket-Produkt müssen zur selben Sprachgruppe gehören, sonst wäre der Preis ungenau
            const fits = priceGuideFits(card.sets?.region && card.sets.region !== "international" ? "ja" : "de", v);
            const trend = row && fits ? (rev ? row.trend_foil : row.trend) : null;
            const low = row && fits ? (rev ? row.low_foil : row.low) : null;
            const url = cardmarketUrl({ productId: v.cardmarket_product_id, languageCode: lang, reverse: rev, firstEd: isFirstEd(v.subtype), directUrl: card.cardmarket_url });
            return (
              <View key={v.id} style={{ paddingVertical: 6 }}>
                <Txt bold>{variantLabel(v)}</Txt>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                  <Stat label="Günstigster Preis (alle Zustände, alle Verkäufer)" value={eur(low)} />
                </View>
                {trend != null ? <Sub style={{ marginTop: 6, fontSize: 12 }}>Trend (Mischzustände): {eur(trend)}</Sub> : null}
                {(() => {
                  // Zustandspreise (nur Karten, die in einer Sammlung liegen und abgefragt wurden): alle Verkäufer / nur Deutschland
                  const rows = CONDITIONS.map((c) => {
                    const mine = cond.filter((p) => p.condition === c.code && p.finish === v.finish && !p.is_graded);
                    const all = mine.find((p) => p.seller_scope !== "DE"), de = mine.find((p) => p.seller_scope === "DE");
                    return all || de ? { c, all, de } : null;
                  }).filter(Boolean) as { c: (typeof CONDITIONS)[number]; all?: CondPrice; de?: CondPrice }[];
                  if (!rows.length) return null;
                  return (
                    <View style={{ marginTop: 8 }}>
                      <Sub>Je Zustand (günstigstes Angebot): alle Verkäufer · nur Deutschland</Sub>
                      {rows.map((r) => <Sub key={r.c.code}>{r.c.label}: {eur(r.all ? Number(r.all.price) : null)} · {eur(r.de ? Number(r.de.price) : null)}</Sub>)}
                    </View>
                  );
                })()}
                <Btn title={`Aktuellen Preis laden (${CONDITIONS.find((c) => c.code === liveCond)?.label ?? liveCond})`} onPress={() => loadLive(v)} busy={liveBusy === v.id} disabled={!v.cardmarket_product_id && !jaProduct} />
                {liveMsg[v.id] ? <Sub style={{ marginTop: 4 }}>{liveMsg[v.id]}</Sub> : null}
                {!row ? <Sub style={{ marginTop: 4 }}>Kein Preis vorhanden</Sub> : null}
                {row && !fits ? <Sub style={{ marginTop: 4 }}>Kein Preis angezeigt: Cardmarket führt diese Karte nur als gemeinsames Produkt für mehrere Sprachen, ein Preis wäre ungenau. Über den Link ohne Filter kannst du selbst nachsehen und beim Eintrag einen eigenen Wert setzen.</Sub> : null}
                {url && <Btn kind="ghost" title="Auf Cardmarket ansehen (alle Verkäufer)" onPress={() => Linking.openURL(url)} />}
                {url && !fits && <Btn kind="ghost" title="Auf Cardmarket ansehen (ohne Filter)" onPress={() => Linking.openURL(cardmarketUrl({ productId: v.cardmarket_product_id, directUrl: card.cardmarket_url })!)} />}
                {url && <Btn kind="ghost" title="Auf Cardmarket ansehen (nur Deutschland)" onPress={() => Linking.openURL(cardmarketUrl({ productId: v.cardmarket_product_id, languageCode: lang, reverse: rev, firstEd: isFirstEd(v.subtype), germanOnly: true, directUrl: card.cardmarket_url })!)} />}
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
