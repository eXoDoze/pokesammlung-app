-- =====================================================================
-- Pokémon-Sammlungs-App – Erweiterung 006: Gewinner und Verlierer nach Zustand
-- Im Supabase "SQL Editor" einmal einfügen und auf "Run" klicken.
-- (Setzt 001 bis 005 voraus.)
--
-- Vergleicht pro Sammlungseintrag den aktuellen Zustandspreis mit dem Preis
-- von vor p_days Tagen. Berücksichtigt werden Zustand, Ausführung (Holo /
-- Reverse / Non-Holo), 1st Edition, Stempel, Sprache sowie Graded-Daten
-- (Firma und Note) des Sammlungseintrags.
--
-- Es gibt nur Ergebnisse, wenn für einen Eintrag Zustandspreise aus zwei
-- Zeitpunkten vorliegen (der ältere zwischen p_days und 2 * p_days Tage alt).
-- =====================================================================

create or replace function public.collection_movers(
  p_collection uuid,
  p_days       int default 7,
  p_limit      int default 10
)
returns table (
  kind               text,
  collection_item_id uuid,
  card_id            text,
  name_en            text,
  image_url          text,
  condition          text,
  is_graded          boolean,
  grading_company    text,
  grade              numeric,
  price_then         numeric,
  price_now          numeric,
  change_abs         numeric,
  change_pct         numeric,
  then_at            timestamptz,
  now_at             timestamptz
)
language sql
stable
security invoker
as $$
  with items as (
    select ci.*
    from public.collection_items ci
    where ci.collection_id = p_collection
  ),
  matched as (
    select i.id as item_id, cp.price, cp.fetched_at
    from items i
    join public.condition_prices cp
      on  cp.card_id          = i.card_id
      and cp.source           = 'cardmarket'
      and cp.price_kind       = 'lowest'
      and cp.condition        = i.condition
      and cp.is_graded        = i.is_graded
      and coalesce(cp.grading_company, '') = coalesce(i.grading_company, '')
      and coalesce(cp.grade, -1)           = coalesce(i.grade, -1)
      and cp.finish           = i.finish
      and cp.is_first_edition = i.is_first_edition
      and coalesce(cp.stamp, '')           = coalesce(i.stamp, '')
      and cp.language in (i.language, 'any')
  ),
  now_p as (
    select distinct on (item_id) item_id, price, fetched_at
    from matched
    order by item_id, fetched_at desc
  ),
  then_p as (
    select distinct on (item_id) item_id, price, fetched_at
    from matched
    where fetched_at <= now() - make_interval(days => p_days)
      and fetched_at >= now() - make_interval(days => p_days * 2)
    order by item_id, fetched_at desc
  ),
  moves as (
    select
      n.item_id,
      t.price                                         as price_then,
      n.price                                         as price_now,
      n.price - t.price                               as change_abs,
      round((n.price - t.price) / t.price * 100, 1)   as change_pct,
      t.fetched_at                                    as then_at,
      n.fetched_at                                    as now_at
    from now_p n
    join then_p t on t.item_id = n.item_id
    where t.price > 0
  ),
  ranked as (
    select
      m.*,
      row_number() over (order by m.change_pct desc) as rn_up,
      row_number() over (order by m.change_pct asc)  as rn_down
    from moves m
  )
  select
    case when r.change_pct >= 0 then 'gewinner' else 'verlierer' end,
    i.id,
    i.card_id,
    c.name_en,
    c.image_url,
    i.condition,
    i.is_graded,
    i.grading_company,
    i.grade,
    r.price_then,
    r.price_now,
    r.change_abs,
    r.change_pct,
    r.then_at,
    r.now_at
  from ranked r
  join items i on i.id = r.item_id
  join public.cards c on c.id = i.card_id
  where r.rn_up <= p_limit or r.rn_down <= p_limit
  order by r.change_pct desc;
$$;

grant execute on function public.collection_movers(uuid, int, int) to authenticated;
