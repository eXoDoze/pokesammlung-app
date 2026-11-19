-- =====================================================================
-- Pokémon-Sammlungs-App – Erweiterung 008: Pokédex-Nummern als Dezimalzahlen
-- Im Supabase "SQL Editor" einmal einfügen und auf "Run" klicken.
--
-- Manche japanische Karten haben Pokédex-Nummern wie 384.1 (Formen).
-- Die Spalte dex_ids erlaubte bisher nur ganze Zahlen.
-- =====================================================================

drop index if exists public.cards_dex_ids_idx;

alter table public.cards
  alter column dex_ids drop default;

alter table public.cards
  alter column dex_ids type numeric[] using dex_ids::numeric[];

alter table public.cards
  alter column dex_ids set default '{}';

create index cards_dex_ids_idx on public.cards using gin (dex_ids);
