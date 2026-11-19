-- =====================================================================
-- Pokémon-Sammlungs-App – Erweiterung 002: Kartenvarianten
-- Im Supabase "SQL Editor" einmal komplett einfügen und auf "Run" klicken.
-- (Setzt voraus, dass 001_schema.sql bereits ausgeführt wurde.)
--
-- Hintergrund: Dieselbe Karte kann mehrere Varianten haben, z. B. Base Set
-- Glurak als Unlimited, als Shadowless oder als 1st Edition. Cardmarket
-- führt manche davon als eigenes Produkt mit eigener Nummer.
-- =====================================================================

create table public.card_variants (
  id                     text primary key,            -- Varianten-ID aus der Katalogquelle
  card_id                text not null references public.cards (id) on delete cascade,
  finish                 text not null
                         check (finish in ('non_holo', 'holo', 'reverse_holo')),
  subtype                text,                        -- z. B. unlimited, shadowless, 1999-2000-copyright
  stamps                 text[] not null default '{}', -- z. B. {1st-edition}
  cardmarket_product_id  bigint,                      -- Cardmarket-Produktnummer dieser Variante
  created_at             timestamptz not null default now()
);

create index card_variants_card_idx on public.card_variants (card_id);
create index card_variants_cm_idx   on public.card_variants (cardmarket_product_id);

alter table public.card_variants enable row level security;

create policy "Kartenvarianten lesen" on public.card_variants
  for select to authenticated using (true);

grant select on public.card_variants to authenticated;

-- Sammlungseinträge können jetzt genau auf eine Variante zeigen
alter table public.collection_items
  add column variant_id text references public.card_variants (id);

create index collection_items_variant_idx on public.collection_items (variant_id);
