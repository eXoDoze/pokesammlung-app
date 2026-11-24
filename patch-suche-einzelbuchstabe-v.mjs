// Aufruf im App-Ordner: node patch-suche-einzelbuchstabe-v.mjs
// Suche: die Eingabe "v" (ein Buchstabe) startet jetzt eine Suche (findet V, VMAX, VSTAR, V-UNION). Alle anderen Eingaben brauchen weiterhin mindestens 2 Zeichen.
import fs from "node:fs";
const f = "src/app/(tabs)/suche.tsx";
if (!fs.existsSync(f)) { console.log("FEHLT", f); process.exit(1); }
let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); if (crlf) s = s.replace(/\r\n/g, "\n");
let bad = 0;
const reps = [
  ["if (term.length < 2) {", "if (term.length < 2 && !/^v$/i.test(term)) {"],
  ["q.trim().length < 2 && !nr.trim() ?", "q.trim().length < 2 && !/^v$/i.test(q.trim()) && !nr.trim() ?"],
];
for (const [a, b] of reps) {
  if (s.includes(a)) { s = s.replace(a, b); console.log("ok      ", a.slice(0, 60)); }
  else if (s.includes(b)) console.log("schon da", a.slice(0, 60));
  else { console.log("NICHT GEFUNDEN:", a.slice(0, 70)); bad++; }
}
fs.writeFileSync(f, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log(bad ? "Fehler – Ausgabe schicken." : "Alles angepasst.");
