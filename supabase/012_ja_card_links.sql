-- =====================================================================
-- Pokémon-Sammlungs-App – Erweiterung 012: Verknüpfung japanischer Karten
-- Im Supabase "SQL Editor" einmal einfügen und auf "Run" klicken.
--
-- Japanische Karten werden bei Cardmarket oft über das Produkt der englischen
-- Karte gehandelt (nur die Sprache "Japanisch" ist anders). Diese Tabelle hält
-- die Verknüpfung fest, ohne cards.cardmarket_product_id zu überschreiben,
-- denn der Preis der Preisdatei gilt für alle Sprachen gemischt und darf bei
-- japanischen Karten NICHT als Marktwert gezeigt werden.
-- =====================================================================

create table if not exists public.ja_card_links (
  card_id               text primary key references public.cards (id) on delete cascade,
  cardmarket_product_id bigint not null,
  source_card_id        text references public.cards (id) on delete set null,
  method                text not null,   -- 'dex_unique' | 'dex_number'
  created_at            timestamptz not null default now()
);

alter table public.ja_card_links enable row level security;
create policy "ja_card_links lesen" on public.ja_card_links for select to authenticated using (true);
grant select on public.ja_card_links to authenticated;
grant all on public.ja_card_links to service_role;
