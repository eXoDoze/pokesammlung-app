// Patch für PokéKartenDex (Ausführen im Hauptordner der App, also E:\dev\PokeKartenDex):
// src/lib/labels.ts: Haben mehrere Varianten dieselbe Beschriftung, behalten die mit eigenem Stempel ihren Stempelnamen
// (z. B. "Holo · National Championships"); nur die Übrigen ohne Unterschied werden als "Version 1, 2 …" nummeriert.
// Vorher wurde bei teilweise gleichen Stempeln ALLES zu "Version 1–4".
// Aufruf: node patch-variantennamen-stempel-behalten.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const file = "src/lib/labels.ts";
if (!existsSync(file)) { console.error(`✗ Datei nicht gefunden: ${file} (im App-Hauptordner ausführen)`); process.exit(1); }
let s = readFileSync(file, "utf8");
const eol = s.includes("\r\n") ? "\r\n" : "\n";
const fix = (t) => t.replace(/\n/g, eol);
if (s.includes("const nameOf = (v: T)")) { console.log("schon vorhanden, nichts zu tun"); process.exit(0); }
const alt = fix(`    if (g.length === 1) { out.set(g[0].id, logoRev(g[0]) ? \`\${l} (Set-Stempel)\` : l); continue; }
    if (new Set(g.map(stampOf)).size === g.length) { g.forEach((v) => out.set(v.id, logoRev(v) ? \`\${l} (Set-Stempel)\` : stampOf(v) ? \`\${l} · \${stampOf(v)}\` : l)); continue; }
    [...g].sort((a, b) => (a.cardmarket_product_id ?? 0) - (b.cardmarket_product_id ?? 0)).forEach((v, i) => out.set(v.id, \`\${l} · Version \${i + 1}\`));
`);
const neu = fix(`    const nameOf = (v: T) => (logoRev(v) ? \`\${l} (Set-Stempel)\` : stampOf(v) ? \`\${l} · \${stampOf(v)}\` : l);
    if (g.length === 1) { out.set(g[0].id, nameOf(g[0])); continue; }
    // Gleiche Stempel gruppieren: Varianten mit eigenem Stempel behalten ihren Namen, nur echte Doppelgänger werden nummeriert
    const byStamp = new Map<string, T[]>();
    for (const v of g) { const k = stampOf(v); if (!byStamp.has(k)) byStamp.set(k, []); byStamp.get(k)!.push(v); }
    for (const sub of byStamp.values()) {
      if (sub.length === 1) { out.set(sub[0].id, nameOf(sub[0])); continue; }
      [...sub].sort((a, b) => (a.cardmarket_product_id ?? 0) - (b.cardmarket_product_id ?? 0)).forEach((v, i) => out.set(v.id, \`\${nameOf(v)} · Version \${i + 1}\`));
    }
`);
if (s.split(alt).length !== 2) { console.error("✗ Stelle in labels.ts nicht eindeutig gefunden – Datei weicht ab, bitte neu schicken"); process.exit(1); }
s = s.replace(alt, () => neu);
writeFileSync(file, s, "utf8");
console.log("✔ labels.ts angepasst");
