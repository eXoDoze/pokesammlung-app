-- =====================================================================
-- Pokémon-Sammlungs-App – Erweiterung 009: Verkäufer-Herkunft bei Zustandspreisen
-- Im Supabase "SQL Editor" einmal einfügen und auf "Run" klicken.
--
-- Regel: Es werden zuerst nur Angebote deutscher Verkäufer betrachtet.
-- Gibt es für Karte + Zustand + Variante keine, werden Verkäufer aus
-- anderen Ländern verwendet. Die Spalte seller_scope hält fest, welcher
-- Fall vorlag, damit die App es anzeigen kann ("nur Ausland").
--   'DE'    = Preis aus Angeboten deutscher Verkäufer
--   'other' = keine deutschen Angebote, Preis aus anderen Ländern
-- =====================================================================

alter table public.condition_prices
  add column if not exists seller_scope text not null default 'DE'
  check (seller_scope in ('DE', 'other'));

create index if not exists condition_prices_lookup_idx
  on public.condition_prices (card_id, source, condition, finish, fetched_at desc);
