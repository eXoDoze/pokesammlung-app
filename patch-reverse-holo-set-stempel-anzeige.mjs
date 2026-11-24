// Aufruf im App-Ordner: node patch-reverse-holo-set-stempel-anzeige.mjs
// Variantenbeschriftung (src/lib/labels.ts): Reverse-Holo-Varianten mit dem Datenquellen-Stempel "set-logo" heißen jetzt "Reverse Holo (Set-Stempel)".
// Echte Sonderstempel werden lesbar geschrieben ("jimmy-ballard" -> "Jimmy Ballard").
import fs from "node:fs";
const f = "src/lib/labels.ts";
if (!fs.existsSync(f)) { console.log("FEHLT", f); process.exit(1); }
let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); if (crlf) s = s.replace(/\r\n/g, "\n");
let bad = 0;
const A = "    if (g.length === 1) { out.set(g[0].id, l); continue; }\n    const stampOf = (v: T) => (v.stamps ?? []).join(\", \");\n    if (new Set(g.map(stampOf)).size === g.length) { g.forEach((v) => out.set(v.id, stampOf(v) ? `${l} · ${stampOf(v)}` : l)); continue; }\n";
const B = "    const isLogo = (x: string) => /^set[\\s_-]?(logo|symbol)$/i.test(x.trim());\n" +
"    const pretty = (x: string) => (isLogo(x) ? \"Set-Stempel\" : x.replace(/[-_]+/g, \" \").replace(/\\b\\w/g, (c) => c.toUpperCase()));\n" +
"    const stampOf = (v: T) => (v.stamps ?? []).map(pretty).join(\", \");\n" +
"    const logoRev = (v: T) => v.finish === \"reverse_holo\" && (v.stamps ?? []).length > 0 && (v.stamps ?? []).every(isLogo);\n" +
"    if (g.length === 1) { out.set(g[0].id, logoRev(g[0]) ? `${l} (Set-Stempel)` : l); continue; }\n" +
"    if (new Set(g.map(stampOf)).size === g.length) { g.forEach((v) => out.set(v.id, logoRev(v) ? `${l} (Set-Stempel)` : stampOf(v) ? `${l} · ${stampOf(v)}` : l)); continue; }\n";
if (s.includes(A)) { s = s.replace(A, B); console.log("ok       Beschriftung der Varianten"); }
else if (s.includes("logoRev")) console.log("schon da Beschriftung der Varianten");
else { console.log("NICHT GEFUNDEN: variantLabels-Block in labels.ts"); bad++; }
fs.writeFileSync(f, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log(bad ? "Fehler – Ausgabe schicken." : "Alles angepasst.");
