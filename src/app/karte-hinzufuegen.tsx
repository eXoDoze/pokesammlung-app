import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { ItemForm, FormValues } from "../components/ItemForm";
import { H, Panel, Screen, Sub } from "../components/ui";
import type { Variant } from "../lib/data";
import { cardName } from "../lib/labels";
import { useApp } from "../lib/session";
import { supabase } from "../lib/supabase";

// Eigene Seite zum Hinzufügen einer Karte zur Sammlung; springt danach automatisch zur Kartenansicht zurück.
export default function KarteHinzufuegenScreen() {
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = decodeURIComponent(String(raw));
  const { active } = useApp();
  const router = useRouter();
  const [card, setCard] = useState<any>(null);

  useEffect(() => {
    supabase.from("cards")
      .select("id,number,name_en,name_de,name_ja,name_ko,name_zh,sets(region),card_variants(id,finish,subtype,stamps,cardmarket_product_id,asia_product)")
      .eq("id", id).single().then(({ data }) => setCard(data));
  }, [id]);

  if (!card) return <Screen><Sub style={{ padding: 16 }}>Lade …</Sub></Screen>;
  const lang = card.sets?.region === "japan" ? "ja" : card.sets?.region === "korea" ? "ko" : card.sets?.region === "china" ? "zh-cn" : card.sets?.region === "taiwan" ? "zh-tw" : "de";

  const save = async (v: FormValues) => {
    if (!active) throw new Error("Keine Sammlung gewählt.");
    const { error } = await supabase.from("collection_items").insert({ ...v, collection_id: active.id, card_id: card.id });
    if (error) throw new Error(error.message);
    Alert.alert("Hinzugefügt", `${cardName(card)} liegt jetzt in „${active.name}“.`);
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Zur Sammlung hinzufügen" }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: 760, width: "100%", alignSelf: "center" }} keyboardShouldPersistTaps="handled">
        <Panel>
          <H>{cardName(card)} → „{active?.name ?? "–"}“</H>
          <ItemForm variants={card.card_variants as Variant[]} onSave={save} saveLabel="Hinzufügen" defaultLanguage={lang === "ja" ? "ja" : lang} region={card.sets?.region ?? "international"} />
        </Panel>
      </ScrollView>
    </Screen>
  );
}
