-- =====================================================================
-- Pokémon-Sammlungs-App – Etappe 1: Datenbankschema (Supabase / PostgreSQL)
-- Einmal komplett im Supabase "SQL Editor" einfügen und auf "Run" klicken.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) KATALOG (für alle angemeldeten Nutzer lesbar, geschrieben wird nur
--    durch die automatischen Importe in der Cloud)
-- ---------------------------------------------------------------------

create table public.sets (
  id                      text primary key,          -- Quell-ID, z. B. 'base1'
  name_en                 text not null,
  name_de                 text,
  name_ja                 text,
  series                  text,
  region                  text not null default 'international'
                          check (region in ('international', 'japan')),
  release_date            date,
  card_count              int,                       -- Anzahl Karten inkl. Secret Rares
  printed_total           int,                       -- aufgedruckte Setgröße (z. B. 102 bei 4/102)
  logo_url                text,
  symbol_url              text,
  cardmarket_expansion_id int,
  created_at              timestamptz not null default now()
);

create table public.cards (
  id                     text primary key,           -- Quell-ID, z. B. 'base1-4'
  set_id                 text not null references public.sets (id) on delete cascade,
  number                 text not null,              -- als Text, z. B. '004' oder 'SWSH123'
  name_en                text not null,              -- englischer Name (wichtig für Cardmarket)
  name_de                text,
  name_ja                text,
  rarity                 text,
  image_url              text,
  cardmarket_product_id  bigint,
  cardmarket_url         text,
  finishes               text[] not null default '{non_holo}',  -- vorhandene Ausführungen: non_holo, holo, reverse_holo
  created_at             timestamptz not null default now()
);

create index cards_set_idx on public.cards (set_id);
create index cards_name_en_idx on public.cards (lower(name_en));
create index cards_cm_product_idx on public.cards (cardmarket_product_id);

-- ---------------------------------------------------------------------
-- 2) PREISE
-- ---------------------------------------------------------------------

-- Tägliche Preisübersicht (Cardmarket Price Guide), pro Karte und Tag.
-- Daraus entstehen Preisverlauf sowie Gewinner und Verlierer.
create table public.price_snapshots (
  card_id        text not null references public.cards (id) on delete cascade,
  snapshot_date  date not null,
  finish         text not null default 'normal',     -- 'normal' oder 'foil'
  trend          numeric(10, 2),
  avg            numeric(10, 2),
  low            numeric(10, 2),
  avg7           numeric(10, 2),
  avg30          numeric(10, 2),
  primary key (card_id, snapshot_date, finish)
);

-- Preise pro Zustand (aus Cardmarket-Angeboten und eBay "Verkauft").
create table public.condition_prices (
  id               bigint generated always as identity primary key,
  card_id          text not null references public.cards (id) on delete cascade,
  source           text not null check (source in ('cardmarket', 'ebay_sold')),
  language         text not null default 'any',
  finish           text not null default 'non_holo'
                   check (finish in ('non_holo', 'holo', 'reverse_holo')),
  is_first_edition boolean not null default false,
  stamp            text,                             -- Stempel, leer = ohne Stempel
  condition        text not null
                   check (condition in ('MT', 'NM', 'EX', 'GD', 'LP', 'PL', 'PO')),
  is_graded        boolean not null default false,
  grading_company  text,
  grade            numeric(3, 1),
  price            numeric(10, 2) not null,          -- in Euro
  price_kind       text not null default 'lowest'
                   check (price_kind in ('lowest', 'median')),
  sample_size      int,
  fetched_at       timestamptz not null default now()
);

create index condition_prices_card_idx
  on public.condition_prices (card_id, fetched_at desc);

-- ---------------------------------------------------------------------
-- 3) SAMMLUNGEN (privat pro Nutzer)
-- ---------------------------------------------------------------------

create table public.collections (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create index collections_owner_idx on public.collections (owner_id);

create table public.collection_items (
  id               uuid primary key default gen_random_uuid(),
  collection_id    uuid not null references public.collections (id) on delete cascade,
  card_id          text not null references public.cards (id),
  language         text not null default 'en',       -- Sprache der Karte (en, de, ja, ...)
  finish           text not null default 'non_holo'
                   check (finish in ('non_holo', 'holo', 'reverse_holo')),
  is_first_edition boolean not null default false,
  is_shadowless    boolean not null default false,
  stamp            text,                             -- Stempel, z. B. Prerelease; leer = ohne Stempel
  condition        text not null default 'NM'
                   check (condition in ('MT', 'NM', 'EX', 'GD', 'LP', 'PL', 'PO')),
  is_graded        boolean not null default false,
  grading_company  text,                             -- PSA, BGS, PGS, CGC, ...
  grade            numeric(3, 1),                    -- z. B. 10 oder 9.5
  quantity         int not null default 1 check (quantity > 0),
  purchase_price   numeric(10, 2),                   -- Kaufpreis pro Stück in Euro
  purchased_at     date,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint graded_needs_company_and_grade
    check (not is_graded or (grading_company is not null and grade is not null))
);

create index collection_items_collection_idx on public.collection_items (collection_id);
create index collection_items_card_idx on public.collection_items (card_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger collection_items_touch
  before update on public.collection_items
  for each row execute function public.touch_updated_at();

-- Beim ersten Anmelden automatisch eine Standard-Sammlung anlegen
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.collections (owner_id, name)
  values (new.id, 'Meine Sammlung');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4) ZUGRIFFSREGELN (Row Level Security)
--    Jeder sieht nur seine eigenen Sammlungen. Den Katalog und die
--    Preise dürfen alle angemeldeten Nutzer lesen.
-- ---------------------------------------------------------------------

alter table public.sets             enable row level security;
alter table public.cards            enable row level security;
alter table public.price_snapshots  enable row level security;
alter table public.condition_prices enable row level security;
alter table public.collections      enable row level security;
alter table public.collection_items enable row level security;

create policy "Katalog lesen: Sets" on public.sets
  for select to authenticated using (true);

create policy "Katalog lesen: Karten" on public.cards
  for select to authenticated using (true);

create policy "Preise lesen: Tagespreise" on public.price_snapshots
  for select to authenticated using (true);

create policy "Preise lesen: Zustandspreise" on public.condition_prices
  for select to authenticated using (true);

-- Zustandspreise darf die App selbst eintragen (die App holt sie vom Handy aus)
create policy "Preise schreiben: Zustandspreise" on public.condition_prices
  for insert to authenticated with check (true);

create policy "Eigene Sammlungen" on public.collections
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Eigene Sammlungseintraege" on public.collection_items
  for all to authenticated
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_items.collection_id
        and c.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_items.collection_id
        and c.owner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- 5) GEWINNER UND VERLIERER (für die Startseite)
--    p_collection = Sammlungs-ID  -> nur Karten dieser Sammlung
--    p_collection = null          -> alle Karten im Katalog
-- ---------------------------------------------------------------------

create or replace function public.card_movers(
  p_days       int     default 7,
  p_collection uuid    default null,
  p_limit      int     default 10,
  p_min_price  numeric default 1
)
returns table (
  kind        text,
  card_id     text,
  name_en     text,
  image_url   text,
  price_then  numeric,
  price_now   numeric,
  change_abs  numeric,
  change_pct  numeric
)
language sql
stable
security invoker
as $$
  with scope as (
    select distinct ci.card_id
    from public.collection_items ci
    where p_collection is not null
      and ci.collection_id = p_collection
  ),
  now_p as (
    select distinct on (s.card_id) s.card_id, s.trend
    from public.price_snapshots s
    where s.finish = 'normal'
      and s.trend is not null
      and (p_collection is null or s.card_id in (select card_id from scope))
    order by s.card_id, s.snapshot_date desc
  ),
  then_p as (
    select distinct on (s.card_id) s.card_id, s.trend
    from public.price_snapshots s
    where s.finish = 'normal'
      and s.trend is not null
      and s.snapshot_date <= current_date - p_days
      and (p_collection is null or s.card_id in (select card_id from scope))
    order by s.card_id, s.snapshot_date desc
  ),
  moves as (
    select
      n.card_id,
      t.trend                                          as price_then,
      n.trend                                          as price_now,
      n.trend - t.trend                                as change_abs,
      round((n.trend - t.trend) / t.trend * 100, 1)    as change_pct
    from now_p n
    join then_p t on t.card_id = n.card_id
    where t.trend >= p_min_price
  ),
  ranked as (
    select
      m.*,
      row_number() over (order by m.change_pct desc) as rn_up,
      row_number() over (order by m.change_pct asc)  as rn_down
    from moves m
  )
  select
    case when r.change_pct >= 0 then 'gewinner' else 'verlierer' end as kind,
    r.card_id,
    c.name_en,
    c.image_url,
    r.price_then,
    r.price_now,
    r.change_abs,
    r.change_pct
  from ranked r
  join public.cards c on c.id = r.card_id
  where r.rn_up <= p_limit or r.rn_down <= p_limit
  order by r.change_pct desc;
$$;

-- ---------------------------------------------------------------------
-- 6) ZUGRIFFSRECHTE FÜR DIE DATEN-API
--    Stellt sicher, dass angemeldete Nutzer die Tabellen über die App
--    erreichen. Welche Zeilen sie sehen dürfen, regeln die Regeln aus Teil 4.
-- ---------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select on public.sets, public.cards, public.price_snapshots, public.condition_prices
  to authenticated;
grant insert on public.condition_prices to authenticated;

grant select, insert, update, delete on public.collections, public.collection_items
  to authenticated;

grant usage, select on all sequences in schema public to authenticated;

grant execute on function public.card_movers(int, uuid, int, numeric) to authenticated;
