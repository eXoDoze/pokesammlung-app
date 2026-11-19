import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Linking, ScrollView } from "react-native";
import { FormValues, ItemForm } from "../../components/ItemForm";
import { Btn, H, Screen, Sub } from "../../components/ui";
import { ITEM_SELECT, Item } from "../../lib/data";
import { cardName, cardmarketUrl } from "../../lib/labels";
import { jaLinkProduct, pickVariant } from "../../lib/data";
import { supabase } from "../../lib/supabase";

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [jaProduct, setJaProduct] = useState<number | null>(null);

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
        <H>Eintrag bearbeiten</H>
        <ItemForm variants={variants} lockVariant initial={{ ...item, variant_id: v?.id ?? null }} onSave={save} saveLabel="Speichern" />
        <Btn kind="danger" title="Eintrag löschen" onPress={remove} />
      </ScrollView>
    </Screen>
  );
}
