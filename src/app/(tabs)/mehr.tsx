import React, { useState } from "react";
import { Alert, ScrollView } from "react-native";
import { Btn, Chip, Field, H, Row, Screen, Sub, Txt } from "../../components/ui";
import { useApp } from "../../lib/session";
import { supabase } from "../../lib/supabase";

export default function Mehr() {
  const { session, collections, active, setActive, reloadCollections } = useApp();
  const [name, setName] = useState("");

  const [newName, setNewName] = useState("");
  const rename = async () => {
    if (!active || !newName.trim()) return;
    const { error } = await supabase.from("collections").update({ name: newName.trim() }).eq("id", active.id);
    if (error) return Alert.alert("Fehler", error.message);
    setNewName(""); await reloadCollections();
  };

  const create = async () => {
    if (!session || !name.trim()) return;
    const { data, error } = await supabase.from("collections").insert({ owner_id: session.user.id, name: name.trim() }).select("id").single();
    if (error) return Alert.alert("Fehler", error.message);
    setName(""); await reloadCollections(); if (data) setActive(data.id);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <Sub>Angemeldet als</Sub>
        <Txt bold>{session?.user.email}</Txt>
        <H>Meine Sammlungen</H>
        <Row>{collections.map((c) => <Chip key={c.id} label={c.name} on={c.id === active?.id} onPress={() => setActive(c.id)} />)}</Row>
        {active && (
          <>
            <Field label={`„${active.name}“ umbenennen`} value={newName} onChangeText={setNewName} placeholder="Neuer Name" />
            <Btn title="Umbenennen" kind="ghost" onPress={rename} disabled={!newName.trim()} />
          </>
        )}
        <Field label="Neue Sammlung" value={name} onChangeText={setName} placeholder="z. B. Vintage, Japanisch, Duplikate" />
        <Btn title="Sammlung anlegen" kind="ghost" onPress={create} disabled={!name.trim()} />
        <H>Preise</H>
        <Sub>
          Marktwert: Cardmarket-Preisdatei (Trend, alle Zustände gemischt), täglich aktualisiert. Zustandspreise (deutsche Verkäufer, sonst Ausland) folgen in einem späteren Schritt und ersetzen dann den Marktwert, wo sie vorliegen.
        </Sub>
        <H>Konto</H>
        <Btn title="Abmelden" kind="danger" onPress={() => supabase.auth.signOut()} />
      </ScrollView>
    </Screen>
  );
}
