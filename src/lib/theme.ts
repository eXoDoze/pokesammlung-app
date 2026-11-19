import { useColorScheme } from "react-native";

const light = {
  bg: "#f6f7f9", card: "#ffffff", text: "#14161a", sub: "#6b7280", line: "#e5e7eb",
  accent: "#d9381e", accentText: "#ffffff", good: "#15803d", bad: "#b91c1c", chip: "#eceef2",
};
const dark: typeof light = {
  bg: "#0a0b1e", card: "#171a3a", text: "#f2f4ff", sub: "#9aa0c8", line: "#262a52",
  accent: "#ef5a3f", accentText: "#ffffff", good: "#5be39a", bad: "#ff6b81", chip: "#222650",
};
export type Theme = typeof light;
// Grundstil: dunkel (Hell-Variante bleibt für eine spätere Einstellung erhalten)
export const FORCE_DARK = true;
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return FORCE_DARK || scheme === "dark" ? dark : light;
}
