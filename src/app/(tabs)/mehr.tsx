import * as Updates from "expo-updates";
import React, { useState } from "react";
import { Alert, Platform, ScrollView } from "react-native";
import { Btn, Chip, Field, H, Row, Screen, Sub, Txt } from "../../components/ui";
import { useApp } from "../../lib/session";
import { supabase } from "../../lib/supabase";

export default function Mehr() {
  const { session, collections, active, setActive, reloadCollections } = useApp();
  const [name, setName] = useState("");
  const [updBusy, setUpdBusy] = useState(false);
  const [updInfo, setUpdInfo] = useState(Platform.OS === "web" ? "Updates gibt es nur in der App." : Updates.isEnabled ? "Neue Versionen werden beim Start automatisch geladen und beim nächsten Öffnen aktiv." : "Update-Funktion in dieser Version nicht aktiv.");
  const checkUpdate = async () => {
    if (Platform.OS === "web" || !Updates.isEnabled) return Alert.alert("Update", "In dieser Version nicht verfügbar.");
    setUpdBusy(true);
    try {
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) { setUpdInfo("Du hast die neueste Version."); return; }
      await Updates.fetchUpdateAsync();
      Alert.alert("Update geladen", "Die App startet jetzt neu.", [{ text: "OK", onPress: () => Updates.reloadAsync() }]);
    } catch (e: any) { setUpdInfo("Prüfung fehlgeschlagen: " + (e?.message ?? "unbekannt")); }
    finally { setUpdBusy(false); }
  };

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
          Der Wert einer Karte ist der günstigste Preis im gewählten Zustand (alle Verkäufer, Cardmarket); zusätzlich siehst du den günstigsten Preis von Verkäufern aus Deutschland. Fehlt der Zustandspreis, zeigt die App den Ab-Preis, nur bei Karten aus gemischten Sprachprodukten bleibt der Wert leer. Ein selbst gesetzter Wert hat immer Vorrang. Zustandspreise werden wöchentlich (ab 25 €) bzw. monatlich aktualisiert.
        </Sub>
        <H>App-Update</H>
        <Sub>{updInfo}</Sub>
        <Btn title="Nach Update suchen" kind="ghost" onPress={checkUpdate} busy={updBusy} />
        <H>Konto</H>
        <Btn title="Abmelden" kind="danger" onPress={() => supabase.auth.signOut()} />
      </ScrollView>
    </Screen>
  );
}
