-- =====================================================================
-- Pokémon-Sammlungs-App – Erweiterung 013: eigener Wert pro Eintrag
-- Im Supabase "SQL Editor" einmal einfügen und auf "Run" klicken.
--
-- Optionaler, von Hand gesetzter Wert pro Stück in Euro. Die App nutzt ihn nur,
-- wenn für den Eintrag kein Zustandspreis und kein Marktwert vorliegt, und
-- kennzeichnet ihn als "von Hand".
-- =====================================================================
alter table public.collection_items
  add column if not exists manual_value numeric(10, 2);
