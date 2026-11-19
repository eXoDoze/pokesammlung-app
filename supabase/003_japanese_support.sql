-- =====================================================================
-- Pokémon-Sammlungs-App – Erweiterung 003: Unterstützung japanischer Karten
-- Im Supabase "SQL Editor" einmal komplett einfügen und auf "Run" klicken.
-- (Setzt voraus, dass 001_schema.sql und 002_card_variants.sql ausgeführt wurden.)
--
-- Hintergrund: Japanische Sets und Karten haben in der Katalogquelle zunächst
-- nur japanische Namen. Der englische Name wird später ergänzt (bei Pokémon über
-- die Pokédex-Nummer, bei Trainerkarten und Energien aus einer weiteren Quelle).
-- =====================================================================

-- Englische Namen dürfen anfangs leer sein
alter table public.sets  alter column name_en drop not null;
alter table public.cards alter column name_en drop not null;

-- Zusatzfelder an den Karten
alter table public.cards add column category text;                        -- Pokemon, Trainer, Energy
alter table public.cards add column dex_ids  int[] not null default '{}'; -- Pokédex-Nummern

create index cards_dex_ids_idx on public.cards using gin (dex_ids);
