import { useColorScheme } from "react-native";

// Theme "Purple Night Sky": tiefes Nachtblau-Violett, Akzent Violett/Indigo
const light = {
  bg: "#f5f3ff", card: "#ffffff", text: "#1b1740", sub: "#6b6894", line: "#e4e0f7",
  accent: "#7c5cf0", accentText: "#ffffff", good: "#0f9d6b", bad: "#d6336c", chip: "#ebe7fb",
  accent2: "#4f7cf0", card2: "#f0edff",
};
const dark: typeof light = {
  bg: "#0b0820", card: "#161236", text: "#f1eeff", sub: "#a39cd6", line: "#2a2360",
  accent: "#8b6cf6", accentText: "#ffffff", good: "#6ee7b7", bad: "#fb7185", chip: "#221b52",
  accent2: "#5b8cff", card2: "#1d1745",
};
export type Theme = typeof light;
// Grundstil: dunkel (Hell-Variante bleibt für eine spätere Einstellung erhalten)
export const FORCE_DARK = true;
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return FORCE_DARK || scheme === "dark" ? dark : light;
}
// Farbton aus einer Kennung (für Set-Kacheln ohne Bild): bleibt im Bereich Blau/Violett
export function hueFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 225 + (h % 70); // 225–295
}
