import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

export type Collection = { id: string; name: string };
type Ctx = {
  session: Session | null; ready: boolean;
  collections: Collection[]; active: Collection | null;
  setActive: (id: string) => void; reloadCollections: () => Promise<void>;
};
const C = createContext<Ctx>(null as any);
export const useApp = () => useContext(C);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const reloadCollections = useCallback(async () => {
    if (!session) { setCollections([]); return; }
    const { data } = await supabase.from("collections").select("id,name").order("created_at");
    const list = (data ?? []) as Collection[];
    setCollections(list);
    const saved = await AsyncStorage.getItem(`active:${session.user.id}`);
    setActiveId((cur) => (cur && list.some((c) => c.id === cur) ? cur
      : saved && list.some((c) => c.id === saved) ? saved : list[0]?.id ?? null));
  }, [session]);

  useEffect(() => { reloadCollections(); }, [reloadCollections]);

  const setActive = (id: string) => {
    setActiveId(id);
    if (session) AsyncStorage.setItem(`active:${session.user.id}`, id).catch(() => {});
  };
  const active = collections.find((c) => c.id === activeId) ?? null;
  return (
    <C.Provider value={{ session, ready, collections, active, setActive, reloadCollections }}>
      {children}
    </C.Provider>
  );
}
