-- =====================================================================
-- Pokémon-Sammlungs-App – Erweiterung 005: tägliche Cardmarket-Preise
-- Im Supabase "SQL Editor" einmal einfügen und auf "Run" klicken.
-- (Setzt 001 bis 004 voraus.)
--
-- Pro Cardmarket-Produkt und Tag eine Zeile. Cardmarket führt manche
-- Varianten (z. B. Shadowless und Shadowless 1st Edition) unter derselben
-- Produktnummer, deshalb ist die Produktnummer der Schlüssel und nicht die Karte.
-- Alle Preise in Euro. Die "foil"-Spalten werden gespeichert, ihre genaue
-- Bedeutung ist noch ungeklärt und sie werden vorerst nicht verwendet.
-- =====================================================================

create table public.cardmarket_prices (
  cardmarket_product_id bigint not null,
  snapshot_date         date   not null,
  trend                 numeric(10, 2),
  avg                   numeric(10, 2),
  low                   numeric(10, 2),
  avg1                  numeric(10, 2),
  avg7                  numeric(10, 2),
  avg30                 numeric(10, 2),
  trend_foil            numeric(10, 2),
  avg_foil              numeric(10, 2),
  low_foil              numeric(10, 2),
  primary key (cardmarket_product_id, snapshot_date)
);

create index cardmarket_prices_date_idx on public.cardmarket_prices (snapshot_date);

alter table public.cardmarket_prices enable row level security;

create policy "Cardmarket-Preise lesen" on public.cardmarket_prices
  for select to authenticated using (true);

grant select on public.cardmarket_prices to authenticated;
grant all on public.cardmarket_prices to service_role;
