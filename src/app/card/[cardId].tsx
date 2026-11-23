import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { CardTags } from "../../components/CardTags";
import { CardImg, Btn, Chip, H, Panel, Pill, Row, Screen, Stat, Sub, Txt } from "../../components/ui";
import { CondPrice, PriceRow, Variant, jaLinkProduct, latestCondPrices, latestPrices, ITEM_SELECT, Item, priceGuideFits, valuesForItems, Value } from "../../lib/data";
import { CONDITIONS, FINISH_LABEL, cardName, cardmarketUrl, cmLanguage, reverseFilterApplies, ebaySoldUrl, eur, isFirstEd, isShadowless, variantBadge, variantLabel, variantLabels, setTitle } from "../../lib/labels";
import { useApp } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { hueFor, useTheme } from "../../lib/theme";

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
  const [heroVid, setHeroVid] = useState<string | null>(null);
  const [openPrices, setOpenPrices] = useState(false);
  const [openLinks, setOpenLinks] = useState(false);
  const [openMine, setOpenMine] = useState(false);
  const t = useTheme();
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

  const liveLang = card.sets?.region === "japan" ? "ja" : card.sets?.region === "korea" ? "ko" : card.sets?.region === "china" ? "zh-cn" : card.sets?.region === "taiwan" ? "zh-tw" : "de";

  const loadLive = async (v: Variant) => {
    setLiveBusy(v.id);
    setLiveMsg((m) => ({ ...m, [v.id]: "" }));
    try {
      const { data, error } = await supabase.functions.invoke("live-price", {
        body: { card_id: card.id, variant_id: v.id, language: cmLanguage(card.set_id, liveLang), condition: liveCond, finish: v.finish, first_ed: isFirstEd(v.subtype, v.stamps) },
      });
      if (error) {
        let detail = "";
        try { const r = (error as any).context; detail = r?.status ? `HTTP ${r.status}: ${(await r.text()).slice(0, 200)}` : ""; } catch {}
        throw new Error(detail || error.message);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as { all: number | null; de: number | null; offers: number; cached?: boolean; debug?: any };
      setCond(await latestCondPrices([id]));
      const label = CONDITIONS.find((c) => c.code === liveCond)?.label ?? liveCond;
      setLiveMsg((m) => ({ ...m, [v.id]: d.all == null
        ? `Zustand ${label}: aktuell kein Angebot auf Cardmarket gefunden.${d.debug ? ` [Diagnose: ${JSON.stringify(d.debug).slice(0, 1500)}]` : ""}`
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
      variant_id: v?.id ?? null, finish: v?.finish ?? "non_holo", is_first_edition: v ? isFirstEd(v.subtype, v.stamps) : false, is_shadowless: v ? isShadowless(v.subtype) : false,
    }).select(ITEM_SELECT).single();
    if (error) return Alert.alert("Fehler", error.message);
    setWish(data as any as Item);
  };
  const removeWish = async () => {
    if (!wish) return;
    await supabase.from("collection_items").delete().eq("id", wish.id);
    setWish(null);
  };

  // ---- Bühne ----
  const hue = hueFor(card.set_id);
  const hv = card.card_variants.find((x) => x.id === heroVid) ?? card.card_variants[0];
  const condLabel = CONDITIONS.find((c) => c.code === liveCond)?.label ?? liveCond;
  const calc = (v: Variant) => {
    const row = v.cardmarket_product_id ? prices.get(Number(v.cardmarket_product_id)) : undefined;
    const rev = v.finish === "reverse_holo";
    const fits = priceGuideFits(card.sets?.region && card.sets.region !== "international" ? "ja" : "de", v);
    const trend = row && fits ? (rev ? row.trend_foil : row.trend) : null;
    const low = row && fits ? (rev ? row.low_foil : row.low) : null;
    const mineV = cond.filter((p) => p.finish === v.finish && !p.is_graded);
    const condAll = mineV.filter((p) => p.seller_scope !== "DE").map((p) => Number(p.price)).filter(Number.isFinite);
    const minCond = condAll.length ? Math.min(...condAll) : null;
    const liveAll = mineV.find((p) => p.condition === liveCond && p.seller_scope !== "DE");
    const liveDe = mineV.find((p) => p.condition === liveCond && p.seller_scope === "DE");
    const value = liveAll ? Number(liveAll.price) : low ?? minCond;
    const label = liveAll ? `Günstigstes Angebot · ${condLabel} · alle Verkäufer` : low != null ? "Ab-Preis laut Preisliste · alle Zustände · alle Verkäufer" : minCond != null ? "Günstigster geladener Zustandspreis · alle Verkäufer" : "";
    return { row, rev, fits, trend, low, minCond, value, label, de: liveDe ? Number(liveDe.price) : null };
  };
  const hc = hv ? calc(hv) : null;
  const vLabels = variantLabels(card.card_variants);
  const badge = hv ? variantBadge(hv) : "";
  // Europa-Karten: kein Sprachfilter, denn hier hat noch niemand eine Sprache gewählt
  const urlOf = (v: Variant, extra: object = {}) => cardmarketUrl({ productId: v.cardmarket_product_id, languageCode: card.sets?.region && card.sets.region !== "international" ? lang : undefined, reverse: reverseFilterApplies(v.finish, card.card_variants), firstEd: isFirstEd(v.subtype, v.stamps), directUrl: card.cardmarket_url, ...extra });
  const Line = ({ title, sub, onPress, open }: { title: string; sub?: string; onPress: () => void; open?: boolean }) => (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 15, paddingHorizontal: 16, borderBottomColor: t.line, borderBottomWidth: 1 }}>
      <View style={{ flex: 1 }}><Txt bold>{title}</Txt>{sub ? <Sub>{sub}</Sub> : null}</View>
      <Txt style={{ color: t.accent, fontSize: 18 }}>{open === undefined ? "›" : open ? "⌃" : "⌄"}</Txt>
    </Pressable>
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: cardName(card) }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40, maxWidth: 760, width: "100%", alignSelf: "center" }} keyboardShouldPersistTaps="handled">
        {/* Bühne: Karte groß im Licht */}
        <View style={{ alignItems: "center", paddingTop: 22, paddingBottom: 18, backgroundColor: `hsl(${hue}, 45%, 13%)`, overflow: "hidden" }}>
          <View style={{ position: "absolute", top: -40, width: 420, height: 420, borderRadius: 210, backgroundColor: `hsl(${hue}, 62%, 38%)`, opacity: 0.35 }} />
          <View style={{ position: "absolute", top: 20, width: 300, height: 300, borderRadius: 150, backgroundColor: `hsl(${hue}, 70%, 52%)`, opacity: 0.25 }} />
          {card.image_url
            ? <View style={{ width: 250, height: 350 }}>
                <Image source={{ uri: card.image_url }} style={{ width: 250, height: 350, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 14 } }} contentFit="contain" />
                {badge ? <View style={{ position: "absolute", left: 14, right: 14, bottom: 22, backgroundColor: "#d62b2b", borderRadius: 14, paddingVertical: 3, paddingHorizontal: 8, alignItems: "center" }}><Txt bold style={{ color: "#fff", fontSize: 11 }}>{badge}</Txt></View> : null}
              </View>
            : <CardImg uri={null} width={250} height={350} radius={12} />}
          <Txt bold style={{ fontSize: 26, marginTop: 14 }}>{cardName(card)}</Txt>
          {card.name_en && card.name_en !== cardName(card) ? <Sub>{card.name_en}</Sub> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 4, paddingHorizontal: 12 }}>
            <Pressable onPress={() => router.push(`/set/${encodeURIComponent(card.set_id)}`)}><Pill label={`${setName} ›`} tone="accent" /></Pressable>
            {card.number ? <Pill label={`#${card.number}`} /> : null}
            {card.rarity && card.rarity !== "None" ? <Pill label={card.rarity} /> : null}
            <CardTags card={card} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {/* Preis im Blick */}
          <Panel style={{ marginTop: -6 }}>
            {card.card_variants.length > 1 && (
              <Row>{card.card_variants.map((v) => <Chip key={v.id} label={vLabels.get(v.id) ?? variantLabel(v)} on={hv?.id === v.id} onPress={() => setHeroVid(v.id)} />)}</Row>
            )}
            {hc && hc.value != null ? (
              <>
                <Sub>{hc.label}</Sub>
                <Txt bold style={{ fontSize: 40, letterSpacing: -1 }}>{eur(hc.value)}</Txt>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <Stat label="Nur Deutschland" value={eur(hc.de)} />
                  <Stat label="Ø 7 Tage" value={eur(hc.row && hc.fits && !hc.rev ? hc.row.avg7 : null)} />
                  <Stat label="Ø 30 Tage" value={eur(hc.row && hc.fits && !hc.rev ? hc.row.avg30 : null)} />
                </View>
              </>
            ) : (
              <>
                <Txt bold style={{ fontSize: 22 }}>Kein Preis bekannt</Txt>
                <Sub>{hc && hc.row && !hc.fits ? "Cardmarket führt diese Karte nur als gemeinsames Produkt für mehrere Sprachen, ein Preis wäre ungenau. Lade den Preis live oder schau über Cardmarket nach." : "Lade den aktuellen Preis live von Cardmarket."}</Sub>
              </>
            )}
            <Sub style={{ marginTop: 12 }}>Zustand für die Preisabfrage</Sub>
            <Row>{CONDITIONS.map((c) => <Chip key={c.code} label={c.label} on={liveCond === c.code} onPress={() => setLiveCond(c.code)} />)}</Row>
            {hv && <Btn title={`Aktuellen Preis laden (${condLabel})`} onPress={() => loadLive(hv)} busy={liveBusy === hv.id} disabled={!hv.cardmarket_product_id && !jaProduct} />}
            {hv && liveBusy === hv.id ? <Sub style={{ marginTop: 4 }}>Der Preis wird live von Cardmarket geholt. Das kann bis zu etwa 1–2 Minuten dauern.</Sub> : null}
            {hv && liveMsg[hv.id] ? <Sub style={{ marginTop: 4 }}>{liveMsg[hv.id]}</Sub> : null}
            {hv && !hv.cardmarket_product_id && !jaProduct ? <Sub style={{ marginTop: 4 }}>Für diese Karte ist kein Cardmarket-Produkt bekannt. Du kannst beim Eintrag einen eigenen Wert setzen.</Sub> : null}
          </Panel>

          {/* Aktionen */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <View style={{ flex: 1 }}><Btn title="In die Sammlung" onPress={() => router.push(`/karte-hinzufuegen?id=${encodeURIComponent(id)}` as any)} /></View>
            <View style={{ flex: 1 }}>{wish ? <Btn kind="ghost" title="♥ Auf Wunschliste" onPress={removeWish} /> : <Btn kind="ghost" title="♡ Wunschliste" onPress={addWish} />}</View>
          </View>
          {wish ? <Sub style={{ marginTop: 4 }}>Auf der Wunschliste. Tippe auf das Herz, um die Karte wieder zu entfernen.</Sub> : null}

          {mine.length > 0 && (
            <Panel style={{ marginTop: 12 }}>
              <Sub>In deiner Sammlung</Sub>
              {mine.map(({ item: it, value }) => (
                <Pressable key={it.id} onPress={() => router.push(`/item/${it.id}`)} style={{ paddingVertical: 8 }}>
                  <Txt bold>{it.quantity > 1 ? `${it.quantity}× ` : ""}{FINISH_LABEL[it.finish] ?? it.finish}{it.stamp ? ` · ${it.stamp}` : ""} · {it.is_graded ? `${it.grading_company} ${it.grade}` : it.condition} · {it.language.toUpperCase()}</Txt>
                  <Sub>{value ? `${eur(value.price)} pro Karte` : "kein Preis"} · Eintrag öffnen ›</Sub>
                </Pressable>
              ))}
            </Panel>
          )}

          {/* Aufklappbare Zeilen */}
          <View style={{ marginTop: 14, borderRadius: 18, backgroundColor: t.card, borderColor: t.line, borderWidth: 1, overflow: "hidden" }}>
            {mine.length > 0 && (
              <>
                <Line title="In der Sammlung ansehen" sub={`${mine.reduce((n, m) => n + m.item.quantity, 0)} Stück in ${mine.length} ${mine.length === 1 ? "Eintrag" : "Einträgen"}`} open={mine.length > 1 ? openMine : undefined}
                  onPress={() => (mine.length === 1 ? router.push(`/item/${mine[0].item.id}`) : setOpenMine((x) => !x))} />
                {mine.length > 1 && openMine && mine.map(({ item: it }) => (
                  <Pressable key={it.id} onPress={() => router.push(`/item/${it.id}`)} style={{ paddingVertical: 12, paddingHorizontal: 16, borderBottomColor: t.line, borderBottomWidth: 1 }}>
                    <Txt>{it.quantity > 1 ? `${it.quantity}× ` : ""}{FINISH_LABEL[it.finish] ?? it.finish} · {it.is_graded ? `${it.grading_company} ${it.grade}` : it.condition} · {it.language.toUpperCase()} ›</Txt>
                  </Pressable>
                ))}
              </>
            )}
            <Line title="Preise je Zustand" sub="Günstigste Angebote nach Zustand" open={openPrices} onPress={() => setOpenPrices((x) => !x)} />
            {openPrices && (
              <View style={{ padding: 16, borderBottomColor: t.line, borderBottomWidth: 1 }}>
                {card.card_variants.map((v) => {
                  const c = calc(v);
                  const rows = CONDITIONS.map((cc) => {
                    const m = cond.filter((p) => p.condition === cc.code && p.finish === v.finish && !p.is_graded);
                    const all = m.find((p) => p.seller_scope !== "DE"), de = m.find((p) => p.seller_scope === "DE");
                    return all || de ? { cc, all, de } : null;
                  }).filter(Boolean) as { cc: (typeof CONDITIONS)[number]; all?: CondPrice; de?: CondPrice }[];
                  return (
                    <View key={v.id} style={{ marginBottom: 10 }}>
                      <Txt bold>{vLabels.get(v.id) ?? variantLabel(v)}</Txt>
                      <Sub>Günstigster Preis (alle Zustände): {eur(c.low ?? c.minCond)}{c.trend != null ? ` · Trend: ${eur(c.trend)}` : ""}</Sub>
                      {rows.length ? <Sub style={{ marginTop: 4 }}>Je Zustand: alle Verkäufer · nur Deutschland</Sub> : <Sub style={{ marginTop: 4 }}>Noch keine Zustandspreise geladen.</Sub>}
                      {rows.map((r) => <Sub key={r.cc.code}>{r.cc.label}: {eur(r.all ? Number(r.all.price) : null)} · {eur(r.de ? Number(r.de.price) : null)}</Sub>)}
                    </View>
                  );
                })}
              </View>
            )}
            <Line title="Auf Cardmarket & eBay ansehen" open={openLinks} onPress={() => setOpenLinks((x) => !x)} />
            {openLinks && (
              <View style={{ padding: 16, borderBottomColor: t.line, borderBottomWidth: 1 }}>
                {jaProduct && !card.card_variants.some((v) => v.cardmarket_product_id) && (
                  <Btn kind="ghost" title="Cardmarket (Japanisch, alle Verkäufer)" onPress={() => Linking.openURL(cardmarketUrl({ productId: jaProduct, languageCode: "ja", directUrl: card.cardmarket_url })!)} />
                )}
                {hv && urlOf(hv) && <Btn kind="ghost" title="Cardmarket (alle Verkäufer)" onPress={() => Linking.openURL(urlOf(hv)!)} />}
                {hv && urlOf(hv) && <Btn kind="ghost" title="Cardmarket (nur Deutschland)" onPress={() => Linking.openURL(urlOf(hv, { germanOnly: true })!)} />}
                {hv && hc && !hc.fits && urlOf(hv) && <Btn kind="ghost" title="Cardmarket (ohne Filter)" onPress={() => Linking.openURL(cardmarketUrl({ productId: hv.cardmarket_product_id, directUrl: card.cardmarket_url })!)} />}
                <Btn kind="ghost" title="eBay: verkaufte Artikel" onPress={() => Linking.openURL(ebaySoldUrl(card.name_en ?? cardName(card), card.number, card.sets?.name_en))} />
              </View>
            )}
            {versionCount > 0 && <Line title="Weitere Versionen" sub={`${versionCount} in anderer Sprache oder anderem Set`} onPress={() => router.push(`/card-versions?id=${encodeURIComponent(id)}` as any)} />}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
