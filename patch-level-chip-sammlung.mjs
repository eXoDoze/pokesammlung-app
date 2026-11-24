// Patch für PokéKartenDex (Ausführen im Hauptordner der App, also E:\dev\PokeKartenDex):
// Sammlungsliste src/app/bestand.tsx: Level ("Lv.45") als Chip in der Listenzeile, wenn die Karte ein Level hat.
// Aufruf: node patch-level-chip-sammlung.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const file = "src/app/bestand.tsx";
if (!existsSync(file)) { console.error(`✗ Datei nicht gefunden: ${file} (im App-Hauptordner ausführen)`); process.exit(1); }
let s = readFileSync(file, "utf8");
const eol = s.includes("\r\n") ? "\r\n" : "\n";
const edits = [
  ["Import", 'import { useTheme } from "../lib/theme";', 'import { useTheme } from "../lib/theme";\nimport { supabase } from "../lib/supabase";', 'from "../lib/supabase"'],
  ["Zustand", "const [vals, setVals] = useState<Map<string, Value>>(new Map());", "const [vals, setVals] = useState<Map<string, Value>>(new Map());\n  const [levels, setLevels] = useState<Record<string, string>>({});", "const [levels, setLevels]"],
  ["Level laden", 'try { const it = await fetchItems(active.id, view === "owned" ? ["owned"] : ["sold", "traded"]); setItems(it); setVals(await valuesForItems(it)); } finally { setBusy(false); }',
   'try {\n      const it = await fetchItems(active.id, view === "owned" ? ["owned"] : ["sold", "traded"]);\n      setItems(it); setVals(await valuesForItems(it));\n      // Level der Karten nachladen (steht nicht in der Sammlungsabfrage)\n      const ids = [...new Set(it.map((x) => x.card_id))];\n      const lv: Record<string, string> = {};\n      for (let k = 0; k < ids.length; k += 100) {\n        const { data } = await supabase.from("cards").select("id,level").in("id", ids.slice(k, k + 100));\n        for (const r of (data ?? []) as any[]) if (r.level) lv[r.id] = String(r.level);\n      }\n      setLevels(lv);\n    } finally { setBusy(false); }', "// Level der Karten nachladen"],
  ["Chip in der Liste", "<Pill label={i.language.toUpperCase()} />", "<Pill label={i.language.toUpperCase()} />\n                    {levels[i.card_id] ? <Pill label={`Lv.${levels[i.card_id]}`} /> : null}", "levels[i.card_id] ?"],
];
for (let [name, a, b, marker] of edits) {
  a = a.replace(/\n/g, eol); b = b.replace(/\n/g, eol); marker = marker.replace(/\n/g, eol);
  if (s.includes(marker)) { console.log(`  ${name} – schon vorhanden, übersprungen`); continue; }
  if (s.split(a).length !== 2) { console.error(`✗ Stelle für "${name}" nicht eindeutig gefunden – Datei weicht ab, bitte neu schicken`); process.exit(1); }
  s = s.replace(a, b); console.log(`  ${name} ✔`);
}
writeFileSync(file, s, "utf8");
console.log("fertig");
