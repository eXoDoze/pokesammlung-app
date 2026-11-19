-- =====================================================================
-- Pokémon-Sammlungs-App – Erweiterung 010: zwei Preisquellen
-- Im Supabase "SQL Editor" einmal einfügen und auf "Run" klicken.
-- (Setzt 001 bis 009 voraus.)
--
--  source = 'cardmarket_file'  Cardmarkets eigene Preisdatei (Hauptquelle)
--  source = 'tcgdex'           Preise aus TCGdex (zweite Reihe zum Gegenprüfen)
--
-- Außerdem: die 1-/7-/30-Tage-Durchschnitte der "Holo"-Spalten (bei Pokémon
-- die Reverse-Holo-Preise) und eine Auswertung market_movers, die nur noch
-- die Hauptquelle verwendet.
-- =====================================================================

alter table public.cardmarket_prices
  add column if not exists source text not null default 'tcgdex'
    check (source in ('cardmarket_file', 'tcgdex')),
  add column if not exists avg1_foil  numeric(10, 2),
  add column if not exists avg7_foil  numeric(10, 2),
  add column if not exists avg30_foil numeric(10, 2);

alter table public.cardmarket_prices drop constraint cardmarket_prices_pkey;
alter table public.cardmarket_prices
  add primary key (cardmarket_product_id, snapshot_date, source);

-- market_movers: nur Hauptquelle (Cardmarket-Datei)
create or replace function public.market_movers(
  p_days      int     default 7,
  p_limit     int     default 10,
  p_min_price numeric default 5
)
returns table (
  kind        text,
  card_id     text,
  name_en     text,
  image_url   text,
  price_then  numeric,
  price_now   numeric,
  change_abs  numeric,
  change_pct  numeric,
  aus_verlauf boolean
)
language sql
stable
security invoker
as $$
  with src as (
    select * from public.cardmarket_prices where source = 'cardmarket_file'
  ),
  latest as (
    select distinct on (cardmarket_product_id) *
    from src
    order by cardmarket_product_id, snapshot_date desc
  ),
  old as (
    select distinct on (cardmarket_product_id) cardmarket_product_id, trend
    from src
    where snapshot_date <= current_date - p_days
      and snapshot_date >= current_date - p_days * 2
    order by cardmarket_product_id, snapshot_date desc
  ),
  base as (
    select
      l.cardmarket_product_id,
      l.trend as price_now,
      coalesce(o.trend, case when p_days <= 7 then l.avg7 else l.avg30 end) as price_then,
      (o.trend is not null) as aus_verlauf
    from latest l
    left join old o using (cardmarket_product_id)
    where l.trend is not null
      and l.snapshot_date >= current_date - 3
  ),
  moves as (
    select
      b.*,
      b.price_now - b.price_then                                  as change_abs,
      round((b.price_now - b.price_then) / b.price_then * 100, 1) as change_pct
    from base b
    where b.price_then is not null
      and b.price_then >= p_min_price
  ),
  mapped as (
    select distinct on (cardmarket_product_id) cardmarket_product_id, card_id
    from public.card_variants
    where cardmarket_product_id is not null
    order by cardmarket_product_id, id
  ),
  ranked as (
    select
      m.*,
      mp.card_id,
      row_number() over (order by m.change_pct desc) as rn_up,
      row_number() over (order by m.change_pct asc)  as rn_down
    from moves m
    join mapped mp on mp.cardmarket_product_id = m.cardmarket_product_id
  )
  select
    case when r.change_pct >= 0 then 'gewinner' else 'verlierer' end,
    r.card_id, c.name_en, c.image_url,
    r.price_then, r.price_now, r.change_abs, r.change_pct, r.aus_verlauf
  from ranked r
  join public.cards c on c.id = r.card_id
  where r.rn_up <= p_limit or r.rn_down <= p_limit
  order by r.change_pct desc;
$$;

grant execute on function public.market_movers(int, int, numeric) to authenticated;
