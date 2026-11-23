// Aufruf im App-Ordner: node patch-sortierung-ohne-preis-oben.mjs
import fs from "node:fs";
const f = "src/app/bestand.tsx";
let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); if (crlf) s = s.replace(/\r\n/g, "\n");
const reps = [
  ["const amount = (i: Item): number | null => {\n      if (view === \"closed\") return i.sold_price != null ? i.sold_price * i.quantity : null;\n      const v = vals.get(i.id); return v ? v.price * i.quantity : null;",
   "const amount = (i: Item): number => {\n      if (view === \"closed\") return i.sold_price != null ? i.sold_price * i.quantity : 0;\n      const v = vals.get(i.id); return v ? v.price * i.quantity : 0;"],
  ["      if (pa == null && pb == null) return name(a).localeCompare(name(b), \"de\", { sensitivity: \"base\", numeric: true });\n      if (pa == null) return 1;\n      if (pb == null) return -1;\n      return sort === \"preis_auf\" ? pa - pb : pb - pa;",
   "      if (pa === pb) return name(a).localeCompare(name(b), \"de\", { sensitivity: \"base\", numeric: true });\n      return sort === \"preis_auf\" ? pa - pb : pb - pa;"],
];
let bad = 0;
for (const [a, b] of reps) { if (s.includes(a)) { s = s.replace(a, b); console.log("ok"); } else if (s.includes(b)) console.log("schon da"); else { console.log("NICHT GEFUNDEN:", a.slice(0, 60)); bad++; } }
fs.writeFileSync(f, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log(bad ? "Fehler – Ausgabe schicken." : "Fertig.");
