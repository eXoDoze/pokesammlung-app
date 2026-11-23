// Aufruf im App-Ordner: node patch-level-anzeige-kartenseite.mjs
// Kartenseite: lädt cards.level mit und zeigt es als Etikett "Lv.45" / "Lv.X" neben der Nummer (nur wenn ein Level eingetragen ist).
import fs from "node:fs";
const f = "src/app/card/[cardId].tsx";
if (!fs.existsSync(f)) { console.log("FEHLT", f); process.exit(1); }
let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); if (crlf) s = s.replace(/\r\n/g, "\n");
let bad = 0;
const reps = [
  [".select(\"id,number,name_en,name_de,name_ja,name_ko,name_zh,rarity,image_url,", ".select(\"id,number,level,name_en,name_de,name_ja,name_ko,name_zh,rarity,image_url,"],
  ["  rarity: string | null; image_url: string | null; set_id: string;", "  level?: string | null; rarity: string | null; image_url: string | null; set_id: string;"],
  ["            {card.number ? <Pill label={`#${card.number}`} /> : null}\n", "            {card.number ? <Pill label={`#${card.number}`} /> : null}\n            {card.level ? <Pill label={`Lv.${card.level}`} /> : null}\n"],
];
for (const [a, b] of reps) {
  if (s.includes(a)) { s = s.replace(a, b); console.log("ok      ", a.slice(0, 55).replace(/\n/g, " ")); }
  else if (s.includes(b)) console.log("schon da", a.slice(0, 55).replace(/\n/g, " "));
  else { console.log("NICHT GEFUNDEN:", a.slice(0, 70).replace(/\n/g, " ")); bad++; }
}
fs.writeFileSync(f, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log(bad ? "Fehler – Ausgabe schicken." : "Alles angepasst.");
