// Aufruf im App-Ordner: node patch-international-zu-europaeisch.mjs
// Benennt die angezeigte Sprachgruppe "International" in "Europäisch" um (intern bleibt der Wert "international").
import fs from "node:fs";
const jobs = [
  ["src/app/(tabs)/sets.tsx", [['🌍 International (EN/DE)', '🌍 Europäisch (DE/EN/FR/ES/IT/PT)']]],
  ["src/app/(tabs)/suche.tsx", [['🌍 International (EN/DE)', '🌍 Europäisch (DE/EN/FR/ES/IT/PT)']]],
  ["src/app/custom-card.tsx", [['🌍 International (EN/DE)', '🌍 Europäisch (DE/EN/FR/ES/IT/PT)']]],
  ["src/app/card-versions.tsx", [['International (Europa)', 'Europäisch']]],
  ["src/app/tag/[tagKey].tsx", [['["international", "Englisch/Deutsch"]', '["international", "Europäisch"]']]],
  ["src/lib/labels.ts", [['international: "International (Deutsch, Englisch, Französisch, Spanisch, Italienisch, Portugiesisch)"', 'international: "Europäisch (Deutsch, Englisch, Französisch, Spanisch, Italienisch, Portugiesisch)"']]],
];
let bad = 0;
for (const [f, reps] of jobs) {
  if (!fs.existsSync(f)) { console.log("FEHLT   ", f); bad++; continue; }
  let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); if (crlf) s = s.replace(/\r\n/g, "\n");
  for (const [a, b] of reps) {
    if (s.includes(a)) { s = s.split(a).join(b); console.log("ok      ", f); }
    else if (s.includes(b)) console.log("schon da", f);
    else { console.log("NICHT GEFUNDEN", f, "::", a); bad++; }
  }
  fs.writeFileSync(f, crlf ? s.replace(/\n/g, "\r\n") : s);
}
console.log(bad ? `\n${bad} Stelle(n) nicht angepasst – Ausgabe schicken.` : "\nAlles angepasst.");
