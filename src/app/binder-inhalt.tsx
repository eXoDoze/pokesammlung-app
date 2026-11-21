import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Easing, FlatList, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Btn, CardImg, Chip, Empty, Field, Row, Screen, Segmented, Sub, Thumb } from "../components/ui";
import { Binder, Slot, addItemUnplaced, fetchSlots, getPageFlip, layoutCols, layoutLabel, layoutRows, moveSlot, placeItem, removeSlot, slotsPerPage, unplaceSlot } from "../lib/binder";
import { ITEM_SELECT, Item, Value, valuesForItems } from "../lib/data";
import { FINISH_LABEL, cardName, conditionLabel, eur, setTitle } from "../lib/labels";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/theme";

export default function BinderInhalt() {
  const { binderId, place } = useLocalSearchParams<{ binderId: string; place?: string }>();
  const router = useRouter();
  const t = useTheme();
  const { width: winW } = useWindowDimensions();
  const [binder, setBinder] = useState<Binder | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [view, setView] = useState<"seiten" | "liste">("seiten");
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [moving, setMoving] = useState<Slot | null>(null);
  const [sel, setSel] = useState<Slot | null>(null);        // angetippte Karte → Aktionen
  const [menu, setMenu] = useState(false);
  const [jump, setJump] = useState(false);
  const [jumpTxt, setJumpTxt] = useState("");
  const [newName, setNewName] = useState("");
  const [flip, setFlip] = useState(true);
  const [placing, setPlacing] = useState<Item | null>(null);   // Karte von der Kartenseite, für die ein Platz gesucht wird
  const [unplacedList, setUnplacedList] = useState(false);
  const [vals, setVals] = useState<Map<string, Value>>(new Map());

  const load = useCallback(async () => {
    const { data } = await supabase.from("binders").select("*").eq("id", binderId).single();
    if (!data) return;
    setBinder(data as Binder);
    const sl = await fetchSlots(binderId);
    setSlots(sl);
    try { setVals(await valuesForItems(sl.map((x) => x.item).filter(Boolean) as Item[])); } catch { /* Wert bleibt leer */ }
    setFlip(await getPageFlip());
    try { const v = await AsyncStorage.getItem(`binderview:${binderId}`); if (v === "liste" || v === "seiten") setView(v); } catch { /* egal */ }
  }, [binderId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    if (!place) return;
    supabase.from("collection_items").select(ITEM_SELECT).eq("id", place).single().then(({ data }) => { if (data) { setPlacing(data as any); setView("seiten"); } });
  }, [place]);

  const layout = binder?.layout ?? "3x3";
  const per = slotsPerPage(layout);
  const isGrid = layout !== "list";
  const pages = binder?.pages ?? 1;
  const showGrid = isGrid && view === "seiten";

  const setViewSaved = (v: "seiten" | "liste") => { setView(v); AsyncStorage.setItem(`binderview:${binderId}`, v).catch(() => {}); };

  // Maße des Rasters
  const W = Math.min(winW, 760) - 32, GAP = 8;
  const cols = layoutCols(layout), rows = layoutRows(layout);
  const cellW = Math.floor((W - GAP * (cols - 1)) / cols), cellH = Math.round(cellW * 1.4);

  const slotMap = useMemo(() => { const m = new Map<string, Slot>(); for (const s of slots) if (s.page != null && s.slot != null) m.set(`${s.page}:${s.slot}`, s); return m; }, [slots]);
  const needle = q.trim().toLowerCase();
  const matches = useCallback((s: Slot) => !needle || !!s.item && [s.item.cards.name_en, s.item.cards.name_de, s.item.cards.name_ja, s.item.cards.number, s.item.cards.sets?.name_de, s.item.cards.sets?.name_en].some((x) => x?.toLowerCase().includes(needle)), [needle]);
  const hitPages = useMemo(() => needle && per ? [...new Set(slots.filter((s) => s.page != null && matches(s)).map((s) => s.page as number))].sort((a, b) => a - b) : [], [slots, needle, per, matches]);
  const listRows = useMemo(() => slots.filter(matches).sort((a, b) => (a.page ?? 1e9) - (b.page ?? 1e9) || (a.slot ?? 0) - (b.slot ?? 0)), [slots, matches]);
  const unplaced = useMemo(() => slots.filter((s) => s.page == null), [slots]);
  // Wert: jede Karte zählt einmal (ein Platz = eine Karte); Karten ohne Preis werden mitgezählt, aber nicht bewertet
  const valueOfSlots = (list: Slot[]) => {
    let sum = 0, noPrice = 0;
    for (const s of list) { const v = s.item ? vals.get(s.item.id) : null; if (v) sum += v.price; else noPrice++; }
    return { sum, noPrice };
  };
  const totalVal = useMemo(() => valueOfSlots(slots), [slots, vals]);
  const pageVal = useMemo(() => valueOfSlots(slots.filter((s) => s.page === page)), [slots, vals, page]);

  // Umblättern mit Animation (Einstellung unter "Mehr")
  const rot = useRef(new Animated.Value(0)).current;
  const [pivot, setPivot] = useState(1);
  const busyAnim = useRef(false);
  const goPage = useCallback((n: number) => {
    if (n < 0 || n >= pages || n === page || busyAnim.current) return;
    if (!flip) { setPage(n); return; }
    busyAnim.current = true;
    const d = n > page ? 1 : -1;
    setPivot(d); rot.setValue(0);
    Animated.timing(rot, { toValue: d, duration: 170, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      setPage(n); rot.setValue(-d);
      Animated.timing(rot, { toValue: 0, duration: 230, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => { busyAnim.current = false; });
    });
  }, [page, pages, flip, rot]);
  const shift = pivot === 1 ? -W / 2 : W / 2;

  const tapSlot = async (p: number, i: number) => {
    const s = slotMap.get(`${p}:${i}`) ?? null;
    if (placing) {                       // Platz für eine Karte von der Kartenseite wählen
      if (s) { Alert.alert("Binder", "Dieser Platz ist belegt. Wähle einen freien Platz."); return; }
      const err = await placeItem(binderId, p, i, placing.id);
      if (err) return Alert.alert("Binder", err);
      setPlacing(null); await load(); return;
    }
    if (moving) {
      if (s && s.id === moving.id) { setMoving(null); return; }
      const err = await moveSlot(binderId, moving, p, i, s);
      setMoving(null);
      if (err) Alert.alert("Binder", err);
      await load(); return;
    }
    if (s) setSel(s);
    else router.push(`/binder-karte-waehlen?binderId=${binderId}&page=${p}&slot=${i}`);
  };
  const placeWithoutPosition = async () => {
    if (!placing) return;
    const err = await addItemUnplaced(binderId, placing.id);
    if (err) return Alert.alert("Binder", err);
    setPlacing(null); await load();
  };
  const unplaceSel = () => {
    if (!sel) return;
    const s = sel; setSel(null);
    unplaceSlot(s.id).then((err) => { if (err) Alert.alert("Binder", err); load(); });
  };

  const removeSel = () => {
    if (!sel) return;
    const s = sel; setSel(null);
    removeSlot(s.id).then((err) => { if (err) Alert.alert("Binder", err); load(); });
  };
  const moveSel = () => {
    if (!sel) return;
    setMoving(sel);
    if (!showGrid) { setViewSaved("seiten"); }
    if (sel.page != null) goPage(sel.page);
    setSel(null);
  };

  const updateBinder = async (patch: Partial<Binder>) => {
    const { error } = await supabase.from("binders").update(patch).eq("id", binderId);
    if (error) Alert.alert("Fehler", error.message); else await load();
  };
  const lastPageUsed = slots.some((s) => s.page === pages - 1);
  const delBinder = () => Alert.alert("Binder löschen?", `„${binder?.name}“ wird gelöscht. Deine Karten bleiben in der Sammlung erhalten.`, [
    { text: "Abbrechen", style: "cancel" },
    { text: "Löschen", style: "destructive", onPress: async () => { await supabase.from("binders").delete().eq("id", binderId); router.back(); } },
  ]);

  const cell = (p: number, i: number) => {
    const s = slotMap.get(`${p}:${i}`);
    const it = s?.item;
    const isMoving = moving?.id === s?.id && !!s;
    const hit = !needle || (s && matches(s));
    const closed = it && it.status && it.status !== "owned";
    return (
      <Pressable key={i} onPress={() => tapSlot(p, i)} style={{ width: cellW, height: cellH }}>
        {s && it ? (
          <View style={{ opacity: hit ? (closed ? 0.45 : 1) : 0.18, borderRadius: 8, borderWidth: isMoving ? 2 : needle && hit ? 2 : 0, borderColor: isMoving ? t.good : t.accent }}>
            <CardImg uri={it.cards.image_url} width={cellW} height={cellH} label={cardName(it.cards)} sub={it.cards.number} radius={8} />
            {closed ? <View style={{ position: "absolute", bottom: 4, left: 4, backgroundColor: "rgba(11,8,32,0.85)", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}><Text style={{ color: t.text, fontSize: 10, fontWeight: "800" }}>{it.status === "sold" ? "verkauft" : "getauscht"}</Text></View> : null}
          </View>
        ) : (
          <View style={{ flex: 1, borderRadius: 8, borderWidth: 1.5, borderStyle: "dashed", borderColor: moving ? t.good : t.line, alignItems: "center", justifyContent: "center", opacity: needle ? 0.4 : 1 }}>
            <Ionicons name={moving ? "arrow-down" : "add"} size={26} color={moving ? t.good : t.sub} />
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{
        title: binder?.name ?? "Binder",
        headerRight: () => <Pressable onPress={() => { setNewName(binder?.name ?? ""); setMenu(true); }} hitSlop={10}><Ionicons name="ellipsis-vertical" size={22} color={t.text} /></Pressable>,
      }} />
      <View style={{ paddingHorizontal: 16, paddingTop: 12, maxWidth: 760, width: "100%", alignSelf: "center" }}>
        {isGrid && (
          <View style={{ marginBottom: 8 }}>
            <Segmented value={view} onChange={(v) => setViewSaved(v as "seiten" | "liste")} options={[{ value: "seiten", label: `Seiten (${layoutLabel(layout)})` }, { value: "liste", label: "Liste" }]} />
          </View>
        )}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
          <Sub>{slots.length} Karten im Binder{totalVal.noPrice ? ` · ${totalVal.noPrice} ohne Preis` : ""}</Sub>
          <Text style={{ color: t.text, fontWeight: "800", fontSize: 13 }}>Binder: {eur(totalVal.sum)}</Text>
        </View>
        <Field label="" value={q} onChangeText={setQ} placeholder="In diesem Binder suchen: Name, Nummer oder Set" />
        {placing && (
          <View style={{ backgroundColor: t.accent + "33", borderRadius: 12, padding: 10, marginBottom: 8 }}>
            <Text style={{ color: t.text, fontSize: 13 }}>Tippe auf einen freien Platz für „{cardName(placing.cards)}".</Text>
            <View style={{ flexDirection: "row", gap: 18, marginTop: 6 }}>
              <Pressable onPress={placeWithoutPosition}><Text style={{ color: t.accent, fontWeight: "800" }}>Ohne Platz hinzufügen</Text></Pressable>
              <Pressable onPress={() => setPlacing(null)}><Text style={{ color: t.sub, fontWeight: "800" }}>Abbrechen</Text></Pressable>
            </View>
          </View>
        )}
        {unplaced.length > 0 && !placing && !moving && (
          <Pressable onPress={() => setUnplacedList(true)} style={{ backgroundColor: t.chip, borderRadius: 12, padding: 10, marginBottom: 8, flexDirection: "row", alignItems: "center" }}>
            <Text style={{ color: t.text, flex: 1, fontSize: 13 }}>{unplaced.length} Karte{unplaced.length === 1 ? "" : "n"} ohne Platz im Binder</Text>
            <Text style={{ color: t.accent, fontWeight: "800", fontSize: 13 }}>Zuordnen ›</Text>
          </Pressable>
        )}
        {moving && (
          <View style={{ backgroundColor: t.good + "26", borderRadius: 12, padding: 10, marginBottom: 8, flexDirection: "row", alignItems: "center" }}>
            <Text style={{ color: t.text, flex: 1, fontSize: 13 }}>Tippe auf den neuen Platz für „{moving.item ? cardName(moving.item.cards) : "Karte"}". Ist er belegt, tauschen beide.</Text>
            <Pressable onPress={() => setMoving(null)}><Text style={{ color: t.accent, fontWeight: "800" }}>Abbrechen</Text></Pressable>
          </View>
        )}
        {needle ? <Sub style={{ marginBottom: 6 }}>{listRows.length} Treffer{showGrid && hitPages.length ? " auf Seite:" : ""}</Sub> : null}
        {showGrid && needle && hitPages.length > 0 && <Row>{hitPages.slice(0, 30).map((p) => <Chip key={p} label={String(p + 1)} on={p === page} onPress={() => goPage(p)} />)}</Row>}
      {showGrid && (
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginBottom: 6 }}>
        <Pressable onPress={() => goPage(page - 1)} disabled={page === 0} style={{ padding: 8, opacity: page === 0 ? 0.3 : 1 }}><Ionicons name="chevron-back" size={26} color={t.text} /></Pressable>
        <Pressable onPress={() => { setJumpTxt(String(page + 1)); setJump(true); }}>
          <Text style={{ color: t.text, fontSize: 16, fontWeight: "800" }}>Seite {page + 1} / {pages}</Text>
          <Text style={{ color: t.sub, fontSize: 11, textAlign: "center" }}>{slots.filter((s) => s.page === page).length} von {per} Plätzen belegt · {eur(pageVal.sum)}</Text>
        </Pressable>
        <Pressable onPress={() => goPage(page + 1)} disabled={page >= pages - 1} style={{ padding: 8, opacity: page >= pages - 1 ? 0.3 : 1 }}><Ionicons name="chevron-forward" size={26} color={t.text} /></Pressable>
      </View>
      )}
      </View>

      {showGrid ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, maxWidth: 760, width: "100%", alignSelf: "center" }} keyboardShouldPersistTaps="handled">
          <Animated.View style={{
            opacity: rot.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.55, 1, 0.55] }),
            transform: [{ perspective: 1400 }, { translateX: shift }, { rotateY: rot.interpolate({ inputRange: [-1, 1], outputRange: ["-90deg", "90deg"] }) }, { translateX: -shift }],
          }}>
            <View style={{ backgroundColor: t.card2, borderRadius: 14, padding: 0, borderColor: t.line, borderWidth: 1 }}>
              <View style={{ padding: 0, gap: GAP }}>
                {Array.from({ length: rows }, (_, r) => (
                  <View key={r} style={{ flexDirection: "row", gap: GAP }}>{Array.from({ length: cols }, (_, c) => cell(page, r * cols + c))}</View>
                ))}
              </View>
            </View>
          </Animated.View>
          <Sub style={{ textAlign: "center", marginTop: 10 }}>Zum Umblättern die Pfeile nutzen. Leeren Platz antippen = Karte hinzufügen.</Sub>
        </ScrollView>
      ) : (
        <FlatList data={listRows} keyExtractor={(s) => s.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: 16, paddingTop: 6, maxWidth: 760, width: "100%", alignSelf: "center" }}
          ListEmptyComponent={<Empty text={needle ? "Keine Karte in diesem Binder gefunden." : "Der Binder ist noch leer."} />}
          ListHeaderComponent={!isGrid ? <Btn title="Karte hinzufügen" onPress={() => router.push(`/binder-karte-waehlen?binderId=${binderId}&page=0&slot=${slots.reduce((m, s) => Math.max(m, (s.slot ?? -1) + 1), 0)}`)} /> : undefined}
          renderItem={({ item: s }) => {
            const it = s.item; if (!it) return null;
            const closed = it.status && it.status !== "owned";
            return (
              <Pressable onPress={() => setSel(s)} style={{ marginBottom: 10, opacity: closed ? 0.55 : 1 }}>
                <View style={{ flexDirection: "row", gap: 12, backgroundColor: t.card, borderRadius: 18, padding: 12, borderColor: t.line, borderWidth: 1 }}>
                  <Thumb uri={it.cards.image_url} w={52} />
                  <View style={{ flex: 1, justifyContent: "center" }}>
                    <Text numberOfLines={1} style={{ color: t.text, fontSize: 15, fontWeight: "800" }}>{cardName(it.cards)}</Text>
                    <Text numberOfLines={1} style={{ color: t.sub, fontSize: 12, marginTop: 1 }}>{setTitle(it.cards.sets as any)}{it.cards.number ? ` · #${it.cards.number}` : ""}</Text>
                    <Text numberOfLines={1} style={{ color: t.sub, fontSize: 12, marginTop: 1 }}>{FINISH_LABEL[it.finish] ?? it.finish} · {it.is_graded ? `${it.grading_company} ${it.grade}` : conditionLabel(it.condition)} · {it.language.toUpperCase()}{closed ? ` · ${it.status === "sold" ? "verkauft" : "getauscht"}` : ""}</Text>
                  </View>
                  {isGrid && <Text style={{ color: s.page == null ? t.sub : t.accent, fontSize: 12, fontWeight: "800", alignSelf: "center" }}>{s.page == null || s.slot == null ? "ohne Platz" : `S. ${s.page + 1} · P. ${s.slot + 1}`}</Text>}
                </View>
              </Pressable>
            );
          }} />
      )}

      {/* Aktionen für eine Karte */}
      <Modal visible={!!sel} transparent animationType="fade" onRequestClose={() => setSel(null)}>
        <Pressable onPress={() => setSel(null)} style={{ flex: 1, backgroundColor: "rgba(5,3,20,0.7)", justifyContent: "center", padding: 24 }}>
          <Pressable style={{ backgroundColor: t.card, borderRadius: 18, borderColor: t.line, borderWidth: 1, padding: 16, width: "100%", maxWidth: 420, alignSelf: "center" }}>
            {sel?.item && <View style={{ alignItems: "center", marginBottom: 8 }}>
              <CardImg uri={sel.item.cards.image_url} width={130} height={182} label={cardName(sel.item.cards)} radius={8} />
              <Text style={{ color: t.text, fontWeight: "800", fontSize: 16, marginTop: 8 }} numberOfLines={2}>{cardName(sel.item.cards)}</Text>
              <Sub>{setTitle(sel.item.cards.sets as any)} · #{sel.item.cards.number}</Sub>
            </View>}
            <Btn title="Karte öffnen" onPress={() => { const id = sel?.item_id; setSel(null); if (id) router.push(`/item/${id}`); }} />
            {isGrid && <Btn kind="ghost" title={sel?.page == null ? "Einem Platz zuordnen" : "Auf anderen Platz verschieben"} onPress={moveSel} />}
            {isGrid && sel?.page != null && <Btn kind="ghost" title="Platz freigeben (Karte bleibt im Binder)" onPress={unplaceSel} />}
            <Btn kind="danger" title="Aus dem Binder nehmen" onPress={removeSel} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Karten ohne Platz zuordnen */}
      <Modal visible={unplacedList} transparent animationType="fade" onRequestClose={() => setUnplacedList(false)}>
        <Pressable onPress={() => setUnplacedList(false)} style={{ flex: 1, backgroundColor: "rgba(5,3,20,0.7)", justifyContent: "center", padding: 24 }}>
          <Pressable style={{ backgroundColor: t.card, borderRadius: 18, borderColor: t.line, borderWidth: 1, maxHeight: "80%", width: "100%", maxWidth: 480, alignSelf: "center", overflow: "hidden" }}>
            <Text style={{ color: t.sub, fontSize: 12, padding: 14, paddingBottom: 6 }}>Karte antippen, dann den Platz im Raster wählen</Text>
            <FlatList data={unplaced} keyExtractor={(s) => s.id} renderItem={({ item: s }) => s.item ? (
              <Pressable onPress={() => { setUnplacedList(false); setMoving(s); setViewSaved("seiten"); }} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 14 }}>
                <Thumb uri={s.item.cards.image_url} w={40} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: t.text, fontWeight: "700" }}>{cardName(s.item.cards)}</Text>
                  <Text numberOfLines={1} style={{ color: t.sub, fontSize: 12 }}>{setTitle(s.item.cards.sets as any)} · #{s.item.cards.number}</Text>
                </View>
              </Pressable>
            ) : null} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Seite wählen */}
      <Modal visible={jump} transparent animationType="fade" onRequestClose={() => setJump(false)}>
        <Pressable onPress={() => setJump(false)} style={{ flex: 1, backgroundColor: "rgba(5,3,20,0.7)", justifyContent: "center", padding: 24 }}>
          <Pressable style={{ backgroundColor: t.card, borderRadius: 18, borderColor: t.line, borderWidth: 1, padding: 16, width: "100%", maxWidth: 360, alignSelf: "center" }}>
            <Field label={`Zu Seite springen (1–${pages})`} value={jumpTxt} onChangeText={setJumpTxt} keyboardType="number-pad" />
            <Btn title="Springen" onPress={() => { const n = parseInt(jumpTxt, 10); setJump(false); if (n >= 1 && n <= pages) { if (flip) goPage(n - 1); else setPage(n - 1); } }} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Binder-Menü */}
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable onPress={() => setMenu(false)} style={{ flex: 1, backgroundColor: "rgba(5,3,20,0.7)", justifyContent: "center", padding: 24 }}>
          <Pressable style={{ backgroundColor: t.card, borderRadius: 18, borderColor: t.line, borderWidth: 1, padding: 16, width: "100%", maxWidth: 420, alignSelf: "center" }}>
            <Field label="Name" value={newName} onChangeText={setNewName} />
            <Btn kind="ghost" title="Umbenennen" disabled={!newName.trim() || newName.trim() === binder?.name} onPress={() => { updateBinder({ name: newName.trim() }); setMenu(false); }} />
            {isGrid && <Btn kind="ghost" title="Seite am Ende hinzufügen" onPress={() => { updateBinder({ pages: pages + 1 }); setMenu(false); }} />}
            {isGrid && <Btn kind="ghost" title="Letzte Seite entfernen" disabled={pages <= 1 || lastPageUsed} onPress={() => { updateBinder({ pages: pages - 1 }); if (page >= pages - 1) setPage(pages - 2); setMenu(false); }} />}
            {isGrid && lastPageUsed && pages > 1 ? <Sub>Die letzte Seite enthält Karten und kann nicht entfernt werden.</Sub> : null}
            <Btn kind="danger" title="Binder löschen" onPress={() => { setMenu(false); delBinder(); }} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
