import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Btn, Field, Screen, Sub, Txt } from "../components/ui";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const go = async () => {
    setBusy(true); setMsg("");
    const creds = { email: email.trim(), password: pw };
    const { error } = mode === "in" ? await supabase.auth.signInWithPassword(creds) : await supabase.auth.signUp(creds);
    if (error) setMsg(error.message.includes("Invalid login") ? "E-Mail oder Passwort falsch." : error.message);
    setBusy(false);
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 100 }} keyboardShouldPersistTaps="handled">
          <Txt bold style={{ fontSize: 28, marginBottom: 4 }}>Pokésammlung</Txt>
          <Sub style={{ marginBottom: 24 }}>{mode === "in" ? "Anmelden" : "Neues Konto anlegen"}</Sub>
          <Field label="E-Mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field label="Passwort" value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" />
          {!!msg && <Sub style={{ color: "#b91c1c", marginBottom: 8 }}>{msg}</Sub>}
          <Btn title={mode === "in" ? "Anmelden" : "Konto anlegen"} onPress={go} busy={busy} disabled={!email || pw.length < 6} />
          <Btn kind="ghost" title={mode === "in" ? "Noch kein Konto? Registrieren" : "Ich habe schon ein Konto"} onPress={() => setMode(mode === "in" ? "up" : "in")} />
          {mode === "up" && <Sub>Das Passwort braucht mindestens 6 Zeichen. Jedes Konto sieht nur seine eigenen Sammlungen.</Sub>}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
