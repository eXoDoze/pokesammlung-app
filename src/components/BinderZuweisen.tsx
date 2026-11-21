import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Binder, addItemUnplaced, fetchBinders, layoutLabel } from "../lib/binder";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/theme";
import { Btn, H, Pill, Sub } from "./ui";

// Auf der Karten-Seite: zeigt, in welchen Bindern die Karte liegt. "Zu Binder hinzufügen" → Binder wählen →
// entweder Seite und Platz im geöffneten Binder aussuchen oder ohne Platz hinzufügen.
export function BinderZuweisen({ itemId }: { itemId: string }) {
  const t = useTheme();
  const router = useRouter();
  const [binders, setBinders] = useState<Binder[]>([]);
  const [inIds, setInIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Binder | null>(null);

  const load = async () => {
    try { setBinders(await fetchBinders(null)); } catch { /* ignorieren */ }
    const { data } = await supabase.from("binder_slots").select("binder_id").eq("item_id", itemId);
    setInIds(((data ?? []) as any[]).map((r) => r.binder_id));
  };
  useEffect(() => { load(); }, [itemId]);

  const close = () => { setOpen(false); setChosen(null); };
  const withoutPlace = async () => {
    if (!chosen) return;
    const err = await addItemUnplaced(chosen.id, itemId);
    if (err) return Alert.alert("Binder", err);
    close(); await load();
  };
  const withPlace = () => {
    if (!chosen) return;
    const id = chosen.id; close();
    router.push(`/binder-inhalt?binderId=${id}&place=${itemId}`);
  };
  const names = binders.filter((b) => inIds.includes(b.id));
  return (
    <View>
      <H>Binder</H>
      {names.length > 0 && <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{names.map((b) => <Pill key={b.id} label={`${b.name}${inIds.filter((x) => x === b.id).length > 1 ? ` ×${inIds.filter((x) => x === b.id).length}` : ""}`} tone="accent" />)}</View>}
      {names.length === 0 && <Sub>Diese Karte liegt noch in keinem Binder.</Sub>}
      <Btn kind="ghost" title="Zu Binder hinzufügen …" onPress={() => setOpen(true)} />
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable onPress={close} style={{ flex: 1, backgroundColor: "rgba(5,3,20,0.7)", justifyContent: "center", padding: 24 }}>
          <Pressable style={{ backgroundColor: t.card, borderRadius: 18, borderColor: t.line, borderWidth: 1, maxHeight: "75%", width: "100%", maxWidth: 480, alignSelf: "center", overflow: "hidden" }}>
            {!chosen ? (
              <>
                <Text style={{ color: t.sub, fontSize: 12, padding: 14, paddingBottom: 6 }}>Zu welchem Binder?</Text>
                <ScrollView>
                  {binders.length === 0 && <Sub style={{ padding: 16 }}>Noch kein Binder angelegt. Lege unter Sammlung › Binder einen an.</Sub>}
                  {binders.map((b) => (
                    <Pressable key={b.id} onPress={() => setChosen(b)} style={{ paddingVertical: 13, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
                      <Text style={{ color: t.text, fontSize: 15, flex: 1 }} numberOfLines={1}>{b.name}</Text>
                      <Text style={{ color: t.sub, fontSize: 12 }}>{layoutLabel(b.layout)}{inIds.includes(b.id) ? " · schon drin" : ""}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : (
              <View style={{ padding: 16 }}>
                <Text style={{ color: t.text, fontSize: 16, fontWeight: "800", marginBottom: 10 }}>{chosen.name}</Text>
                <Btn title="Seite und Platz aussuchen" onPress={withPlace} />
                <Btn kind="ghost" title="Ohne Platz hinzufügen" onPress={withoutPlace} />
                <Sub style={{ marginTop: 6 }}>Ohne Platz liegt die Karte im Binder und kann dort später einem Platz zugeordnet werden.</Sub>
                <Btn kind="ghost" title="Zurück" onPress={() => setChosen(null)} />
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
