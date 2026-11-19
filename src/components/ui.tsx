import { Image } from "expo-image";
import React from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { useTheme } from "../lib/theme";

export function Screen({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <View style={{ flex: 1, backgroundColor: t.bg }}>{children}</View>;
}
export function H({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.text, fontSize: 18, fontWeight: "700", marginTop: 18, marginBottom: 8 }}>{children}</Text>;
}
export function Sub({ children, style, numberOfLines }: { children: React.ReactNode; style?: any; numberOfLines?: number }) {
  const t = useTheme();
  return <Text numberOfLines={numberOfLines} style={[{ color: t.sub, fontSize: 13 }, style]}>{children}</Text>;
}
export function Txt({ children, style, bold }: { children: React.ReactNode; style?: any; bold?: boolean }) {
  const t = useTheme();
  return <Text style={[{ color: t.text, fontSize: 15 }, bold && { fontWeight: "700" }, style]}>{children}</Text>;
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
export function Field(props: TextInputProps & { label: string }) {
  const t = useTheme();
  const { label, ...rest } = props;
  return (
    <View style={{ marginBottom: 10 }}>
      <Sub>{label}</Sub>
      <TextInput placeholderTextColor={t.sub} {...rest}
        style={{ color: t.text, backgroundColor: t.card, borderColor: t.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 4, fontSize: 15 }} />
    </View>
  );
}
export function Panel({ children, style }: { children: React.ReactNode; style?: any }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.card, borderRadius: 18, padding: 14, borderColor: t.line, borderWidth: StyleSheet.hairlineWidth }, style]}>{children}</View>;
}
export function Thumb({ uri, w = 48 }: { uri?: string | null; w?: number }) {
  const t = useTheme();
  return uri
    ? <Image source={{ uri }} style={{ width: w, height: w * 1.4, borderRadius: 4 }} contentFit="contain" />
    : <View style={{ width: w, height: w * 1.4, borderRadius: 4, backgroundColor: t.chip }} />;
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
