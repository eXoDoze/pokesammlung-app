import { Image } from "expo-image";
import { useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, Modal, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { useTheme } from "../lib/theme";

// Seite mit Hintergrund. Ist die Bildschirmtastatur offen, wird die Seite unten gekürzt, sodass der untere Rand an der Oberkante der Tastatur "andockt".
// Gemessen wird, wie weit die Tastatur in die Seite hineinragt; wenn Android die Seite schon selbst verkleinert, bleibt es bei 0 (kein doppeltes Anpassen).
export function Screen({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const ref = useRef<View>(null);
  const [kbPad, setKbPad] = useState(0);
  // In den Tabs kümmert sich die Tab-Leiste um den unteren Rand, sonst hier (Android-Navigationsknöpfe / Gestenleiste)
  const inTabs = (segments as string[])[0] === "(tabs)";
  useEffect(() => {
    const measure = (kbTop: number) => setTimeout(() => {
      ref.current?.measureInWindow((_x, y, _w, h) => setKbPad(Math.max(0, Math.round(y + h - kbTop))));
    }, 60);
    const show = Keyboard.addListener("keyboardDidShow", (e) => measure(e.endCoordinates.screenY));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKbPad(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return <View ref={ref} collapsable={false} style={{ flex: 1, backgroundColor: t.bg, paddingBottom: kbPad > 0 ? kbPad : inTabs ? 0 : insets.bottom }}>{children}</View>;
}
export function H({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.text, fontSize: 18, fontWeight: "700", marginTop: 18, marginBottom: 8 }}>{children}</Text>;
}
export function Sub({ children, style, numberOfLines }: { children: React.ReactNode; style?: any; numberOfLines?: number }) {
  const t = useTheme();
  return <Text numberOfLines={numberOfLines} style={[{ color: t.sub, fontSize: 13 }, style]}>{children}</Text>;
}
export function Txt({ children, style, bold, numberOfLines }: { children: React.ReactNode; style?: any; bold?: boolean; numberOfLines?: number }) {
  const t = useTheme();
  return <Text numberOfLines={numberOfLines} style={[{ color: t.text, fontSize: 15 }, bold && { fontWeight: "700" }, style]}>{children}</Text>;
}
export function Btn({ title, onPress, kind = "primary", disabled, busy }: {
  title: string; onPress: () => void; kind?: "primary" | "ghost" | "danger"; disabled?: boolean; busy?: boolean;
}) {
  const t = useTheme();
  const bg = kind === "primary" ? t.accent : kind === "danger" ? t.bad : t.chip;
  const fg = kind === "ghost" ? t.text : t.accentText;
  return (
    <Pressable onPress={onPress} disabled={disabled || busy}
      style={{ backgroundColor: bg, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16, alignItems: "center", opacity: disabled ? 0.5 : 1, marginVertical: 4 }}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: "700", fontSize: 15 }}>{title}</Text>}
    </Pressable>
  );
}
export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress}
      style={{ backgroundColor: on ? t.accent : t.chip, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, marginRight: 6, marginBottom: 6 }}>
      <Text style={{ color: on ? t.accentText : t.text, fontSize: 13, fontWeight: on ? "700" : "400" }}>{label}</Text>
    </Pressable>
  );
}
export function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{children}</View>;
}
export function Field(props: TextInputProps & { label: string; clearable?: boolean }) {
  const t = useTheme();
  const { label, clearable, ...rest } = props;
  // Suchfelder (ohne Beschriftung) bekommen ein "X" zum Löschen der ganzen Eingabe
  const showClear = (clearable ?? label === "") && !!rest.value && !!rest.onChangeText && rest.editable !== false;
  return (
    <View style={{ marginBottom: 10 }}>
      <Sub>{label}</Sub>
      <View style={{ marginTop: 4, justifyContent: "center" }}>
        <TextInput placeholderTextColor={t.sub} {...rest}
          style={{ color: t.text, backgroundColor: t.card, borderColor: t.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingRight: showClear ? 42 : 12, paddingVertical: 10, fontSize: 15 }} />
        {showClear && (
          <Pressable onPress={() => rest.onChangeText?.("")} hitSlop={8} accessibilityLabel="Eingabe löschen"
            style={{ position: "absolute", right: 6, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: t.chip }}>
            <Text style={{ color: t.text, fontSize: 15, fontWeight: "800", lineHeight: 18 }}>✕</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
export function Panel({ children, style }: { children: React.ReactNode; style?: any }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.card, borderRadius: 20, padding: 16, borderColor: t.line, borderWidth: 1 }, style]}>{children}</View>;
}
export function CardImg({ uri, width, height, label, sub, radius = 6, fit = "contain" }: { uri?: string | null; width: number | string; height: number | string; label?: string; sub?: string | null; radius?: number; fit?: "contain" | "cover" }) {
  const t = useTheme();
  const [failed, setFailed] = useState(false);
  if (uri && !failed) {
    return <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: width as any, height: height as any, borderRadius: radius }} contentFit={fit} />;
  }
  // Keine Bild-Datei: gezeichnete Kartenrückseite (Name klein darunter)
  return (
    <View style={{ width: width as any, height: height as any, borderRadius: radius, backgroundColor: "#1f3a8a", borderColor: "#c9a227", borderWidth: 2, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <View style={{ width: "58%", aspectRatio: 1, borderRadius: 999, backgroundColor: "#f4f4f4", borderColor: "#10224f", borderWidth: 3, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%", backgroundColor: "#d7263d" }} />
        <View style={{ position: "absolute", top: "46%", left: 0, right: 0, height: "8%", backgroundColor: "#10224f" }} />
        <View style={{ width: "26%", aspectRatio: 1, borderRadius: 999, backgroundColor: "#f4f4f4", borderColor: "#10224f", borderWidth: 3 }} />
      </View>
      {label ? <Text numberOfLines={2} style={{ position: "absolute", bottom: 4, left: 4, right: 4, color: "#ffffff", fontSize: 9, fontWeight: "700", textAlign: "center" }}>{label}</Text> : null}
    </View>
  );
}
export function Thumb({ uri, w = 48 }: { uri?: string | null; w?: number }) {
  return <CardImg uri={uri} width={w} height={w * 1.4} radius={4} />;
}
export function Empty({ text }: { text: string }) {
  return <Sub style={{ textAlign: "center", marginVertical: 24 }}>{text}</Sub>;
}

export type Option = { value: string; label: string; sub?: string };
// Auswahlfeld mit aufklappbarer Liste (Dropdown)
export function Dropdown({ label, value, options, onChange, flex }: { label: string; value: string; options: Option[]; onChange: (v: string) => void; flex?: number }) {
  const t = useTheme();
  const [open, setOpen] = React.useState(false);
  const cur = options.find((o) => o.value === value);
  return (
    <View style={{ flex: flex ?? 1 }}>
      <Text style={{ color: t.sub, fontSize: 11, marginBottom: 3 }}>{label}</Text>
      <Pressable onPress={() => setOpen(true)}
        style={{ backgroundColor: t.card, borderColor: t.line, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, flexDirection: "row", alignItems: "center" }}>
        <Text numberOfLines={1} style={{ color: t.text, fontSize: 14, fontWeight: "600", flex: 1 }}>{cur?.label ?? "Auswählen"}</Text>
        <Text style={{ color: t.accent, fontSize: 12 }}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "rgba(5,3,20,0.7)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: t.card, borderRadius: 18, borderColor: t.line, borderWidth: 1, maxHeight: "75%", width: "100%", maxWidth: 480, alignSelf: "center", overflow: "hidden" }}>
            <Text style={{ color: t.sub, fontSize: 12, padding: 14, paddingBottom: 6 }}>{label}</Text>
            <FlatList data={options} keyExtractor={(o) => o.value}
              renderItem={({ item }) => (
                <Pressable onPress={() => { onChange(item.value); setOpen(false); }}
                  style={{ paddingVertical: 13, paddingHorizontal: 16, backgroundColor: item.value === value ? t.chip : "transparent", flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ color: item.value === value ? t.accent : t.text, fontSize: 15, fontWeight: item.value === value ? "700" : "400", flex: 1 }} numberOfLines={1}>{item.label}</Text>
                  {item.sub ? <Text style={{ color: t.sub, fontSize: 12 }}>{item.sub}</Text> : null}
                </Pressable>
              )} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// Kleines Etikett (z. B. Zustand, Sprache, Ausführung)
export function Pill({ label, tone }: { label: string; tone?: "accent" | "good" | "bad" | "muted" }) {
  const t = useTheme();
  const bg = tone === "good" ? t.good + "26" : tone === "bad" ? t.bad + "26" : tone === "accent" ? t.accent + "33" : t.chip;
  const fg = tone === "good" ? t.good : tone === "bad" ? t.bad : tone === "accent" ? t.accent : t.sub;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginRight: 5, marginTop: 4 }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}
// Kennzahl-Kachel
export function Stat({ label, value, color, flex = 1 }: { label: string; value: string; color?: string; flex?: number }) {
  const t = useTheme();
  return (
    <View style={{ flex, backgroundColor: t.card2, borderRadius: 14, padding: 12, borderColor: t.line, borderWidth: StyleSheet.hairlineWidth }}>
      <Text style={{ color: t.sub, fontSize: 11 }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: color ?? t.text, fontSize: 17, fontWeight: "800", marginTop: 3 }}>{value}</Text>
    </View>
  );
}
// Umschalter (z. B. 7 Tage / 30 Tage)
export function Segmented({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: t.chip, borderRadius: 12, padding: 3, alignSelf: "flex-start" }}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)}
          style={{ paddingVertical: 7, paddingHorizontal: 16, borderRadius: 10, backgroundColor: o.value === value ? t.accent : "transparent" }}>
          <Text style={{ color: o.value === value ? t.accentText : t.sub, fontWeight: "700", fontSize: 13 }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
