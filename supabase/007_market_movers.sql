-- =====================================================================
-- Pokémon-Sammlungs-App – Erweiterung 007: Top-Mover im Gesamtmarkt
-- Im Supabase "SQL Editor" einmal einfügen und auf "Run" klicken.
-- (Setzt 001 bis 006 voraus.)
--
-- Vergleicht pro Cardmarket-Produkt den aktuellen Trend mit dem Trend von
-- vor p_days Tagen. Liegt noch kein eigener Verlauf vor, wird ersatzweise
-- der 7-Tage-Durchschnitt (p_days <= 7) bzw. 30-Tage-Durchschnitt der
-- Quelle als Vergleichswert genommen (Spalte aus_verlauf = false).
--
-- WICHTIG: Cardmarkets Trend und Durchschnitte enthalten keine Zustands-
-- angabe. Das ist ein Marktindikator, kein Preis für einen bestimmten Zustand.
-- =====================================================================

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
  with latest as (
    select distinct on (cardmarket_product_id) *
    from public.cardmarket_prices
    order by cardmarket_product_id, snapshot_date desc
  ),
  old as (
    select distinct on (cardmarket_product_id) cardmarket_product_id, trend
    from public.cardmarket_prices
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
      b.price_now - b.price_then                              as change_abs,
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
    r.card_id,
    c.name_en,
    c.image_url,
    r.price_then,
    r.price_now,
    r.change_abs,
    r.change_pct,
    r.aus_verlauf
  from ranked r
  join public.cards c on c.id = r.card_id
  where r.rn_up <= p_limit or r.rn_down <= p_limit
  order by r.change_pct desc;
$$;

grant execute on function public.market_movers(int, int, numeric) to authenticated;
