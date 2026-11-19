import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView } from "react-native";
import { Btn, Chip, Dropdown, Field, H, Row, Screen, Sub } from "../components/ui";
import { supabase } from "../lib/supabase";

const REGIONS = [
  { value: "international", label: "🌍 International (EN/DE)" },
  { value: "japan", label: "🇯🇵 Japanisch" },
  { value: "korea", label: "🇰🇷 Koreanisch" },
  { value: "china", label: "🇨🇳 Chinesisch (vereinfacht)" },
  { value: "taiwan", label: "🇹🇼 Chinesisch (traditionell)" },
];
const FINISHES = [{ v: "non_holo", l: "Non-Holo" }, { v: "holo", l: "Holo" }, { v: "reverse_holo", l: "Reverse Holo" }];

// Eigene Karte anlegen: nur nötig, wenn sie im Katalog nicht zu finden ist
export default function CustomCard() {
  const router = useRouter();
  const { name: initialName } = useLocalSearchParams<{ name?: string }>();
  const [name, setName] = useState(String(initialName ?? ""));
  const [setName_, setSetName] = useState("");
  const [region, setRegion] = useState("japan");
  const [number, setNumber] = useState("");
  const [rarity, setRarity] = useState("");
  const [image, setImage] = useState("");
  const [finish, setFinish] = useState("non_holo");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const create = async () => {
    if (!name.trim()) return setErr("Bitte den Namen der Karte eintragen.");
    setErr(""); setBusy(true);
    const { data, error } = await supabase.rpc("create_custom_card", {
      p_name: name, p_set_name: setName_ || null, p_region: region, p_number: number, p_finish: finish,
      p_image_url: image || null, p_rarity: rarity || null,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    router.replace(`/card/${encodeURIComponent(String(data))}`);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Eigene Karte anlegen" }} />
      <ScrollView contentContainerStyle={{ padding: 16, maxWidth: 760, width: "100%", alignSelf: "center" }} keyboardShouldPersistTaps="handled">
        <Sub>Nur nötig, wenn die Karte nicht im Katalog steht. Nach dem Anlegen fügst du sie wie jede andere Karte zur Sammlung hinzu (dort kannst du auch einen eigenen Wert eintragen).</Sub>
        <H>Karte</H>
        <Field label="Name der Karte *" value={name} onChangeText={setName} placeholder="z. B. Hoopa" />
        <Field label="Set (Name)" value={setName_} onChangeText={setSetName} placeholder="z. B. Neo Genesis. Gibt es das Set schon, wird es verwendet." />
        <Dropdown label="Sprache / Region des Sets" value={region} options={REGIONS} onChange={setRegion} />
        <Field label="Nummer" value={number} onChangeText={setNumber} placeholder="optional, z. B. 016 oder 155/XY-P" />
        <Field label="Seltenheit" value={rarity} onChangeText={setRarity} placeholder="optional" />
        <Field label="Bild-Adresse (URL)" value={image} onChangeText={setImage} placeholder="optional, https://…" autoCapitalize="none" autoCorrect={false} />
        <Sub>Ausführung</Sub>
        <Row>{FINISHES.map((f) => <Chip key={f.v} label={f.l} on={finish === f.v} onPress={() => setFinish(f.v)} />)}</Row>
        {!!err && <Sub style={{ color: "#fb7185", marginVertical: 8 }}>{err}</Sub>}
        <Btn title="Karte anlegen" onPress={create} busy={busy} />
      </ScrollView>
    </Screen>
  );
}
