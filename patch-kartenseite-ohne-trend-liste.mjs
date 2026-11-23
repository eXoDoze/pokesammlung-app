// Aufruf im App-Ordner: node patch-kartenseite-ohne-trend-liste.mjs
// Kartenseite: "Preis-Trend (Liste)" entfernen; Nur Deutschland, Ø 7 Tage und Ø 30 Tage stehen in einer Reihe.
import fs from "node:fs";
const f = "src/app/card/[cardId].tsx";
if (!fs.existsSync(f)) { console.log("FEHLT", f); process.exit(1); }
let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); if (crlf) s = s.replace(/\r\n/g, "\n");
const a = '                  <Stat label="Preis-Trend (Liste)" value={eur(hc.trend)} />\n                </View>\n                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>\n';
let bad = 0;
if (s.includes(a)) { s = s.replace(a, ""); console.log("ok       Preis-Trend entfernt"); }
else if (!s.includes('label="Preis-Trend (Liste)"')) console.log("schon da  (kein Preis-Trend mehr)");
else { console.log("NICHT GEFUNDEN: Block mit Preis-Trend"); bad++; }
fs.writeFileSync(f, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log(bad ? "Fehler – Ausgabe schicken." : "Alles angepasst.");
