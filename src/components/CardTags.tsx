import { useRouter } from "expo-router";
import React from "react";
import { Pressable } from "react-native";
import { cardTags } from "../lib/labels";
import { Pill } from "./ui";

// Anklickbare Typ-Pills (Tag Team, VMAX, SIR …): öffnet eine Liste aller Karten dieses Typs, unabhängig vom Set
export function CardTags({ card }: { card: { name_en?: string | null; rarity?: string | null } }) {
  const router = useRouter();
  return (
    <>
      {cardTags(card).map((t) => (
        <Pressable key={t.key} onPress={() => router.push(`/tag/${t.key}`)}>
          <Pill label={`${t.label} ›`} tone="accent" />
        </Pressable>
      ))}
    </>
  );
}
