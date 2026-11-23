// Aufruf im App-Ordner: node patch-kartenrueckseite-kartenseite.mjs
// Zeigt auch auf der Kartenseite (Karte ohne Bild) die gezeichnete Kartenrückseite statt "Kein Bild vorhanden".
import fs from "node:fs";
const f = "src/app/card/[cardId].tsx";
if (!fs.existsSync(f)) { console.log("FEHLT", f); process.exit(1); }
let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); if (crlf) s = s.replace(/\r\n/g, "\n");
let bad = 0;
const re = /<View style=\{\{ width: (\d+), height: (\d+), alignItems: "center", justifyContent: "center" \}\}><Sub>Kein Bild vorhanden<\/Sub><\/View>/;
const m = s.match(re);
if (m) { s = s.replace(re, `<CardImg uri={null} width={${m[1]}} height={${m[2]}} radius={12} />`); console.log("ok       Platzhalter ersetzt"); }
else if (s.includes("<CardImg uri={null}")) console.log("schon da  Platzhalter");
else { console.log("NICHT GEFUNDEN: Zeile mit 'Kein Bild vorhanden'"); bad++; }
const im = s.match(/import \{([^}]*)\} from "\.\.\/\.\.\/components\/ui";/);
if (!im) { console.log("NICHT GEFUNDEN: Import aus components/ui"); bad++; }
else if (!/\bCardImg\b/.test(im[1])) { s = s.replace(im[0], im[0].replace("{", "{ CardImg,").replace("{ CardImg, ", "{ CardImg, ")); console.log("ok       Import ergänzt"); }
else console.log("schon da  Import");
fs.writeFileSync(f, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log(bad ? "Fehler – Ausgabe schicken." : "Alles angepasst.");
