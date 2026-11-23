import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { H, Panel, Pill, Screen, Sub, Thumb, Txt } from "../components/ui";
import { REGION_TITLE, cardName } from "../lib/labels";
import { supabase } from "../lib/supabase";

type Version = { id: string; number: string; name_en: string | null; name_de: string | null; name_ja: string | null; name_ko: string | null; name_zh: string | null; rarity: string | null; image_url: string | null; set_name: string; region: string; match: string };
const REGION_NAME = REGION_TITLE;

export default function CardVersionsScreen() {
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = decodeURIComponent(String(raw));
  const router = useRouter();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [title, setTitle] = useState("");

  useEffect(() => {
    supabase.rpc("card_versions", { p_card_id: id }).then(({ data }) => setVersions(((data ?? []) as Version[]).filter((v) => v.region !== "taiwan")));
    supabase.from("cards").select("name_en,name_de,name_ja,name_ko,name_zh").eq("id", id).single().then(({ data }) => data && setTitle(cardName(data as any)));
  }, [id]);

  return (
    <Screen>
      <Stack.Screen options={{ title: "Weitere Versionen" }} />
      <ScrollView contentContainerStyle={{ padding: 16, maxWidth: 760, width: "100%", alignSelf: "center" }}>
        <Txt bold style={{ fontSize: 18 }}>{title}</Txt>
        <Sub>Dieselbe Karte als eigenes Produkt je Sprachgruppe (wie bei Cardmarket): Europäisch, Japanisch (inkl. Koreanisch) und Chinesisch. Jede Version hat eigene Sprachen und eigene Preise.</Sub>
        {versions === null && <Sub style={{ marginTop: 12 }}>Lade …</Sub>}
        {versions && versions.length === 0 && <Sub style={{ marginTop: 12 }}>Keine weiteren Versionen gefunden.</Sub>}
        {versions && versions.length > 0 && (
          <>
            <H>{versions.length} Versionen</H>
            <Panel>
              {versions.map((v) => (
                <Pressable key={v.id} onPress={() => router.push(`/card/${encodeURIComponent(v.id)}` as any)} style={{ flexDirection: "row", gap: 12, paddingVertical: 8, alignItems: "center" }}>
                  <Thumb uri={v.image_url} w={44} />
                  <View style={{ flex: 1 }}>
                    <Txt bold numberOfLines={1}>{cardName(v as any)}</Txt>
                    <Sub numberOfLines={1}>{v.set_name}{v.number ? ` · #${v.number}` : ""}{v.rarity && v.rarity !== "None" ? ` · ${v.rarity}` : ""}</Sub>
                  </View>
                  <Pill label={REGION_NAME[v.region] ?? v.region} tone={v.region === "international" ? "accent" : undefined} />
                </Pressable>
              ))}
            </Panel>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
