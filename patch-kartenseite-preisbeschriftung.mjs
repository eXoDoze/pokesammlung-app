// Aufruf im App-Ordner: node patch-kartenseite-preisbeschriftung.mjs
// Kartenseite: "Trend (klein)" -> "Preis-Trend", zusätzlich Ø 7 Tage und Ø 30 Tage; Ab-Preis als "laut Preisliste" kennzeichnen.
import fs from "node:fs";
const f = "src/app/card/[cardId].tsx";
if (!fs.existsSync(f)) { console.log("FEHLT", f); process.exit(1); }
let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); if (crlf) s = s.replace(/\r\n/g, "\n");
let bad = 0;
const reps = [
  ['<Stat label="Trend (klein)" value={eur(hc.trend)} />',
   '<Stat label="Preis-Trend (Liste)" value={eur(hc.trend)} />\n                </View>\n                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>\n                  <Stat label="Ø 7 Tage" value={eur(hc.row && hc.fits && !hc.rev ? hc.row.avg7 : null)} />\n                  <Stat label="Ø 30 Tage" value={eur(hc.row && hc.fits && !hc.rev ? hc.row.avg30 : null)} />'],
  ['"Günstigster Preis · alle Zustände · alle Verkäufer"', '"Ab-Preis laut Preisliste · alle Zustände · alle Verkäufer"'],
];
for (const [a, b] of reps) {
  if (s.includes(a)) { s = s.replace(a, b); console.log("ok      ", a.slice(0, 50)); }
  else if (s.includes(b)) console.log("schon da", a.slice(0, 50));
  else { console.log("NICHT GEFUNDEN:", a.slice(0, 60)); bad++; }
}
fs.writeFileSync(f, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log(bad ? "Fehler – Ausgabe schicken." : "Alles angepasst.");
