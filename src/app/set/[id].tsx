import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, View, useWindowDimensions } from "react-native";
import { Chip, Empty, Row, Screen, Sub, Txt } from "../../components/ui";
import { Variant, pickVariant } from "../../lib/data";
import { FINISH_LABEL, cardName, variantLabel } from "../../lib/labels";
import { useApp } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";
import { useFocusEffect } from "expo-router";

type Card = { id: string; number: string; name_en: string | null; name_de: string | null; name_ja: string | null; name_ko?: string | null; name_zh?: string | null; image_url: string | null; card_variants: Variant[] };
type Entry = { key: string; card: Card; variant?: Variant; owned: boolean };

const natural = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

export default function SetScreen() {
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = decodeURIComponent(String(raw));
  const { active } = useApp();
  const router = useRouter();
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [setName, setSetName] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [owned, setOwned] = useState<{ card_id: string; variant_id: string | null; finish: string; is_first_edition: boolean; is_shadowless: boolean }[]>([]);
  const [master, setMaster] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await supabase.from("sets").select("name_de,name_en,name_ja,name_zh,name_ko").eq("id", id).single();
      setSetName(s.data?.name_de ?? s.data?.name_en ?? s.data?.name_ja ?? s.data?.name_zh ?? s.data?.name_ko ?? id);
      const c = await supabase.from("cards").select("id,number,name_en,name_de,name_ja,name_ko,name_zh,image_url,card_variants(id,finish,subtype,stamps,cardmarket_product_id)").eq("set_id", id).limit(1000);
      setCards(((c.data ?? []) as any as Card[]).sort((a, b) => natural(a.number, b.number)));
    })();
  }, [id]);

  const loadOwned = useCallback(async () => {
    if (!active || cards.length === 0) return;
    const { data } = await supabase.from("collection_items").select("card_id,variant_id,finish,is_first_edition,is_shadowless")
      .eq("collection_id", active.id).in("card_id", cards.map((c) => c.id));
    setOwned((data ?? []) as any);
  }, [active, cards]);
  useFocusEffect(useCallback(() => { loadOwned(); }, [loadOwned]));

  const entries: Entry[] = useMemo(() => {
    const out: Entry[] = [];
    for (const c of cards) {
      const mine = owned.filter((o) => o.card_id === c.id);
      if (!master || c.card_variants.length <= 1) {
        out.push({ key: c.id, card: c, owned: mine.length > 0 });
      } else {
        for (const v of c.card_variants) {
          out.push({ key: `${c.id}:${v.id}`, card: c, variant: v, owned: mine.some((o) => pickVariant(o, c.card_variants)?.id === v.id) });
        }
      }
    }
    return out;
  }, [cards, owned, master]);

  const have = entries.filter((e) => e.owned).length;
  const shown = onlyMissing ? entries.filter((e) => !e.owned) : entries;
  const cols = 3;
  const w = (width - 32 - (cols - 1) * 8) / cols;

  return (
    <Screen>
      <Stack.Screen options={{ title: setName || "Set" }} />
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Txt bold>{have} / {entries.length} {master ? "Varianten (Masterset)" : "Karten"}</Txt>
        <View style={{ height: 6, backgroundColor: t.chip, borderRadius: 3, marginVertical: 8 }}>
          <View style={{ height: 6, width: `${entries.length ? (have / entries.length) * 100 : 0}%`, backgroundColor: t.accent, borderRadius: 3 }} />
        </View>
        <Row>
          <Chip label="Karten" on={!master} onPress={() => setMaster(false)} />
          <Chip label="Masterset" on={master} onPress={() => setMaster(true)} />
          <Chip label="Nur fehlende" on={onlyMissing} onPress={() => setOnlyMissing(!onlyMissing)} />
        </Row>
      </View>
      <FlatList data={shown} keyExtractor={(e) => e.key} numColumns={cols} contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        columnWrapperStyle={{ gap: 8 }} ListEmptyComponent={<Empty text="Keine Karten." />}
        renderItem={({ item: e }) => (
          <Pressable onPress={() => router.push(`/card/${encodeURIComponent(e.card.id)}`)} style={{ width: w, marginBottom: 10, opacity: e.owned ? 1 : 0.45 }}>
            {e.card.image_url
              ? <Image source={{ uri: e.card.image_url }} style={{ width: w, height: w * 1.4, borderRadius: 6 }} contentFit="contain" />
              : <View style={{ width: w, height: w * 1.4, borderRadius: 6, backgroundColor: t.chip }} />}
            <Sub numberOfLines={1}>{e.card.number} {cardName(e.card)}</Sub>
            {e.variant && <Sub numberOfLines={1}>{variantLabel(e.variant)}</Sub>}
            {e.owned && <Txt style={{ position: "absolute", top: 2, right: 4 }}>✅</Txt>}
          </Pressable>
        )}
      />
    </Screen>
  );
}
