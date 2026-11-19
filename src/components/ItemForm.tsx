import React, { useState } from "react";
import { View } from "react-native";
import type { Variant } from "../lib/data";
import { CONDITIONS, FINISH_LABEL, GRADERS, LANGUAGES, isFirstEd, isShadowless, variantLabel } from "../lib/labels";
import { Btn, Chip, Field, Row, Sub } from "./ui";

export type FormValues = {
  variant_id: string | null; finish: string; is_first_edition: boolean; is_shadowless: boolean;
  stamp: string | null; language: string; condition: string; is_graded: boolean;
  grading_company: string | null; grade: number | null; quantity: number;
  purchase_price: number | null; purchased_at: string | null; notes: string | null;
  manual_value: number | null; prefer_manual?: boolean;
};

const num = (s: string) => { const n = Number(s.replace(",", ".")); return s.trim() === "" || !Number.isFinite(n) ? null : n; };

export function ItemForm({ variants, initial, onSave, saveLabel, lockVariant, defaultLanguage }: {
  variants: Variant[]; initial?: Partial<FormValues>; onSave: (v: FormValues) => Promise<void>;
  saveLabel: string; lockVariant?: boolean; defaultLanguage?: string;
}) {
  const startVariant = variants.find((v) => v.id === initial?.variant_id) ?? variants[0];
  const [variantId, setVariantId] = useState<string | null>(startVariant?.id ?? null);
  const [finish, setFinish] = useState<string>(initial?.finish ?? startVariant?.finish ?? "non_holo");
  const [stamp, setStamp] = useState<string>(initial?.stamp ?? startVariant?.stamps?.[0] ?? "");
  const [lang, setLang] = useState(initial?.language ?? defaultLanguage ?? "de");
  const [cond, setCond] = useState(initial?.condition ?? "NM");
  const [graded, setGraded] = useState(initial?.is_graded ?? false);
  const knownGrader = (c?: string | null) => !!c && GRADERS.includes(c);
  const [company, setCompany] = useState(initial?.grading_company ? (knownGrader(initial.grading_company) ? initial.grading_company : "Andere") : "PSA");
  const [otherCompany, setOtherCompany] = useState(initial?.grading_company && !knownGrader(initial.grading_company) ? initial.grading_company : "");
  const [grade, setGrade] = useState(initial?.grade != null ? String(initial.grade) : "10");
  const [qty, setQty] = useState(String(initial?.quantity ?? 1));
  const [price, setPrice] = useState(initial?.purchase_price != null ? String(initial.purchase_price) : "");
  const [manual, setManual] = useState(initial?.manual_value != null ? String(initial.manual_value) : "");
  const [preferManual, setPreferManual] = useState(initial?.prefer_manual ?? false);
  const [date, setDate] = useState(initial?.purchased_at ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const v = variants.find((x) => x.id === variantId);

  const submit = async () => {
    const q = parseInt(qty, 10);
    if (!Number.isFinite(q) || q < 1) return setErr("Anzahl muss mindestens 1 sein.");
    const g = num(grade);
    if (graded && g == null) return setErr("Bitte die Note eintragen (z. B. 10).");
    if (graded && company === "Andere" && !otherCompany.trim()) return setErr("Bitte den Namen der Grading-Firma eintragen.");
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr("Datum bitte als JJJJ-MM-TT (z. B. 2026-11-19).");
    setErr(""); setBusy(true);
    try {
      // Variante passend zur gewählten Foil-Art: die gewählte, sonst die erste mit gleicher Art, sonst keine (Preis kommt dann über die Art)
      const used = v && v.finish === finish ? v : variants.find((x) => x.finish === finish && !isFirstEd(x.subtype) && !isShadowless(x.subtype)) ?? null;
      await onSave({
        variant_id: used?.id ?? null,
        finish,
        is_first_edition: used ? isFirstEd(used.subtype) : initial?.is_first_edition ?? false,
        is_shadowless: used ? isShadowless(used.subtype) : initial?.is_shadowless ?? false,
        stamp: stamp.trim() || null,
        language: lang, condition: graded ? "MT" : cond, is_graded: graded,
        grading_company: graded ? (company === "Andere" ? otherCompany.trim() : company) : null, grade: graded ? g : null,
        quantity: q, purchase_price: num(price), purchased_at: date || null, notes: notes.trim() || null, manual_value: num(manual), prefer_manual: preferManual && num(manual) != null,
      });
    } catch (e: any) { setErr(e.message ?? "Fehler beim Speichern"); }
    setBusy(false);
  };

  return (
    <View>
      {variants.some((x) => x.subtype || (x.stamps && x.stamps.length > 0)) && (
        <>
          <Sub>Variante</Sub>
          <Row>
            {variants.map((x) => (
              <Chip key={x.id} label={variantLabel(x)} on={x.id === variantId}
                onPress={lockVariant ? undefined : () => { setVariantId(x.id); setFinish(x.finish); setStamp(x.stamps?.[0] ?? ""); }} />
            ))}
          </Row>
        </>
      )}
      <Sub>Ausführung</Sub>
      <Row>
        {(["non_holo", "holo", "reverse_holo"] as const).map((f) => (
          <Chip key={f} label={FINISH_LABEL[f] ?? f} on={finish === f} onPress={() => setFinish(f)} />
        ))}
      </Row>
      <Field label="Stempel (optional, z. B. Pokémon League, Prerelease)" value={stamp} onChangeText={setStamp} placeholder="leer = ohne Stempel" />
      <Sub>Sprache der Karte</Sub>
      <Row>{LANGUAGES.map((l) => <Chip key={l.code} label={l.label} on={lang === l.code} onPress={() => setLang(l.code)} />)}</Row>
      <Sub>Zustand</Sub>
      <Row>
        {CONDITIONS.map((c) => (
          <Chip key={c.code} label={c.label} on={!graded && cond === c.code} onPress={() => { setGraded(false); setCond(c.code); }} />
        ))}
        <Chip label="Graded" on={graded} onPress={() => setGraded(true)} />
      </Row>
      {graded && (
        <>
          <Sub>Grading-Firma (bei Cardmarket zählt Note 9/10 als „Mint“, die Firma steht im Kommentar)</Sub>
          <Row>{GRADERS.map((g) => <Chip key={g} label={g} on={company === g} onPress={() => setCompany(g)} />)}</Row>
          {company === "Andere" && <Field label="Name der Grading-Firma" value={otherCompany} onChangeText={setOtherCompany} />}
          <Field label="Note (z. B. 10, 9.5)" value={grade} onChangeText={setGrade} keyboardType="decimal-pad" />
        </>
      )}
      <Field label="Anzahl" value={qty} onChangeText={setQty} keyboardType="number-pad" />
      <Field label="Kaufpreis pro Stück (€)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="optional" />
      <Field label="Eigener Wert pro Stück (€)" value={manual} onChangeText={setManual} keyboardType="decimal-pad" placeholder="optional, z. B. nach einem eBay-Verkauf" />
      {num(manual) != null && <Row><Chip label={preferManual ? "✓ Eigenen Wert immer verwenden" : "Nur wenn kein Cardmarket-Preis da ist"} on={preferManual} onPress={() => setPreferManual(!preferManual)} /></Row>}
      <Field label="Kaufdatum (JJJJ-MM-TT)" value={date} onChangeText={setDate} placeholder="optional" />
      <Field label="Notiz" value={notes} onChangeText={setNotes} placeholder="optional" />
      {!!err && <Sub style={{ color: "#b91c1c", marginBottom: 8 }}>{err}</Sub>}
      <Btn title={saveLabel} onPress={submit} busy={busy} />
    </View>
  );
}
