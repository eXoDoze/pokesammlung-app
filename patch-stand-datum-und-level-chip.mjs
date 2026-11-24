// Patch für PokéKartenDex (Ausführen im Hauptordner der App, also E:\dev\PokeKartenDex):
//   1) Kartenseite src/app/card/[cardId].tsx: Preisstand (Datum/Uhrzeit) beim großen Preis und je Zustand unter "Preise je Zustand"
//   2) Suche src/app/(tabs)/suche.tsx: Level ("Lv.45") in der Kachel, wenn die Karte ein Level hat
// Aufruf: node patch-stand-datum-und-level-chip.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
function patch(file, edits) {
  if (!existsSync(file)) { console.error(`✗ Datei nicht gefunden: ${file} (im App-Hauptordner ausführen)`); process.exit(1); }
  let s = readFileSync(file, "utf8");
  const eol = s.includes("\r\n") ? "\r\n" : "\n"; // Windows-Zeilenenden berücksichtigen
  for (let [name, a, b, marker] of edits) {
    a = a.replace(/\n/g, eol); b = b.replace(/\n/g, eol); marker = marker.replace(/\n/g, eol);
    if (s.includes(marker)) { console.log(`  ${file}: ${name} – schon vorhanden, übersprungen`); continue; }
    if (s.split(a).length !== 2) { console.error(`✗ ${file}: Stelle für "${name}" nicht eindeutig gefunden – Datei weicht ab, bitte neu schicken`); process.exit(1); }
    s = s.replace(a, b); console.log(`  ${file}: ${name} ✔`);
  }
  writeFileSync(file, s, "utf8");
}
patch("src/app/card/[cardId].tsx", [
  ["Datumsformat", "type Card = {", "const datum = (s?: string | null) => (s ? new Date(s).toLocaleString(\"de-DE\", { day: \"2-digit\", month: \"2-digit\", year: \"numeric\", hour: \"2-digit\", minute: \"2-digit\" }) : \"\");\n\ntype Card = {", "const datum = "],
  ["Stand in Berechnung", "de: liveDe ? Number(liveDe.price) : null };", "de: liveDe ? Number(liveDe.price) : null, at: liveAll ? liveAll.fetched_at : null };", "at: liveAll ? liveAll.fetched_at"],
  ["Stand beim großen Preis", "<Txt bold style={{ fontSize: 40, letterSpacing: -1 }}>{eur(hc.value)}</Txt>", "<Txt bold style={{ fontSize: 40, letterSpacing: -1 }}>{eur(hc.value)}</Txt>\n                {hc.at ? <Sub>Preisstand: {datum(hc.at)}</Sub> : null}", "Preisstand: {datum(hc.at)}"],
  ["Stand je Zustand", "{r.cc.label}: {eur(r.all ? Number(r.all.price) : null)} · {eur(r.de ? Number(r.de.price) : null)}</Sub>)}", "{r.cc.label}: {eur(r.all ? Number(r.all.price) : null)} · {eur(r.de ? Number(r.de.price) : null)}{datum(r.all?.fetched_at ?? r.de?.fetched_at) ? ` · Stand ${datum(r.all?.fetched_at ?? r.de?.fetched_at)}` : \"\"}</Sub>)}", "· Stand ${datum("],
]);
patch("src/app/(tabs)/suche.tsx", [
  ["Level-Zustand", "  const reqId = useRef(0);\n", "  const reqId = useRef(0);\n  const [levels, setLevels] = useState<Record<string, string>>({});\n", "const [levels, setLevels]"],
  ["Level laden", "  const more = () => {", "  // Level der angezeigten Karten nachladen (die Suchfunktion liefert es nicht mit)\n  useEffect(() => {\n    const need = rows.map((h) => h.id).filter((i) => !(i in levels)).slice(0, 100);\n    if (!need.length) return;\n    (async () => {\n      const { data } = await supabase.from(\"cards\").select(\"id,level\").in(\"id\", need);\n      const add: Record<string, string> = {};\n      for (const id of need) add[id] = \"\";\n      for (const r of (data ?? []) as any[]) if (r.level) add[r.id] = String(r.level);\n      setLevels((c) => ({ ...c, ...add }));\n    })();\n  }, [rows, levels]);\n\n  const more = () => {", "// Level der angezeigten Karten nachladen"],
  ["Level in der Kachel", "[h.number ? `#${h.number}` : null, h.rarity].filter(Boolean).join(\" · \")", "[h.number ? `#${h.number}` : null, h.rarity, levels[h.id] ? `Lv.${levels[h.id]}` : null].filter(Boolean).join(\" · \")", "levels[h.id] ? `Lv."],
]);
console.log("fertig");
