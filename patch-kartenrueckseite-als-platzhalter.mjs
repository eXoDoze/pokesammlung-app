// Aufruf im App-Ordner: node patch-kartenrueckseite-als-platzhalter.mjs
// Zeigt bei Karten ohne Bild eine gezeichnete Kartenrückseite (mit dem Kartennamen) statt "Kein Bild vorhanden".
import fs from "node:fs";
function edit(file, reps) {
  if (!fs.existsSync(file)) { console.log("FEHLT", file); return 1; }
  let s = fs.readFileSync(file, "utf8"); const crlf = s.includes("\r\n"); if (crlf) s = s.replace(/\r\n/g, "\n");
  let bad = 0;
  for (const [a, b] of reps) {
    if (s.includes(a)) { s = s.replace(a, b); console.log("ok      ", file, "::", a.slice(0, 45).replace(/\n/g, " ")); }
    else if (s.includes(b)) console.log("schon da", file);
    else { console.log("NICHT GEFUNDEN", file, "::", a.slice(0, 60).replace(/\n/g, " ")); bad++; }
  }
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s); return bad;
}
const OLD_UI = `  return (
    <View style={{ width: width as any, height: height as any, borderRadius: radius, backgroundColor: t.chip, alignItems: "center", justifyContent: "center", padding: 6 }}>
      {label ? <Text numberOfLines={3} style={{ color: t.text, fontSize: 12, fontWeight: "700", textAlign: "center" }}>{label}</Text> : null}
      {sub ? <Text numberOfLines={1} style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );`;
const NEW_UI = `  // Keine Bild-Datei: gezeichnete Kartenrückseite (Name klein darunter)
  return (
    <View style={{ width: width as any, height: height as any, borderRadius: radius, backgroundColor: "#1f3a8a", borderColor: "#c9a227", borderWidth: 2, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <View style={{ width: "58%", aspectRatio: 1, borderRadius: 999, backgroundColor: "#f4f4f4", borderColor: "#10224f", borderWidth: 3, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%", backgroundColor: "#d7263d" }} />
        <View style={{ position: "absolute", top: "46%", left: 0, right: 0, height: "8%", backgroundColor: "#10224f" }} />
        <View style={{ width: "26%", aspectRatio: 1, borderRadius: 999, backgroundColor: "#f4f4f4", borderColor: "#10224f", borderWidth: 3 }} />
      </View>
      {label ? <Text numberOfLines={2} style={{ position: "absolute", bottom: 4, left: 4, right: 4, color: "#ffffff", fontSize: 9, fontWeight: "700", textAlign: "center" }}>{label}</Text> : null}
    </View>
  );`;
let bad = edit("src/components/ui.tsx", [[OLD_UI, NEW_UI]]);
bad += edit("src/app/item/[itemId].tsx", [
  ['<View style={{ width: 240, height: 336, alignItems: "center", justifyContent: "center" }}><Sub>Kein Bild vorhanden</Sub></View>', '<CardImg uri={null} width={240} height={336} radius={12} label={cardName(item.cards)} />'],
  ['import { Btn, Field, H, Panel, Pill, Screen, Segmented, Stat, Sub, Txt } from "../../components/ui";', 'import { Btn, CardImg, Field, H, Panel, Pill, Screen, Segmented, Stat, Sub, Txt } from "../../components/ui";'],
]);
console.log(bad ? `\n${bad} Stelle(n) nicht angepasst – Ausgabe schicken.` : "\nAlles angepasst.");
