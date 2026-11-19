-- 023: Kartensuche nach Pokémon-Namen
-- Findet alle Karten, deren Name (EN/DE/JA/KO/ZH) den Suchbegriff enthält. Zusätzlich werden alle Karten
-- desselben Pokémon über die Pokédex-Nummer gefunden (z. B. "Glurak" findet auch japanische/koreanische Glurak-Karten).

create extension if not exists pg_trgm;
create index if not exists cards_name_en_trgm on public.cards using gin (name_en gin_trgm_ops);
create index if not exists cards_name_de_trgm on public.cards using gin (name_de gin_trgm_ops);

create or replace function public.search_cards(
  p_q      text,
  p_region text default 'all',
  p_limit  int  default 60,
  p_offset int  default 0
)
returns table (
  id text, number text, name_en text, name_de text, name_ja text, name_ko text, name_zh text,
  rarity text, image_url text, set_id text, set_name text, region text, release_date date, total bigint
)
language sql
stable
security invoker
as $$
  with q as (
    select '%' || replace(replace(replace(trim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  ),
  named as (
    select c.id, c.dex_ids
    from public.cards c, q
    where length(trim(p_q)) >= 2
      and (c.name_en ilike q.pat or c.name_de ilike q.pat or c.name_ja ilike q.pat
           or c.name_ko ilike q.pat or c.name_zh ilike q.pat)
  ),
  dex as (  -- Pokédex-Nummer der Treffer: nur Karten mit genau EINEM Pokémon (Tag-Team-Karten würden Partner-Pokémon einschleppen)
    select distinct n.dex_ids[1] as d from named n
    where cardinality(n.dex_ids) = 1
  ),
  dexn as (select count(*) as n from dex),
  hits as (
    select n.id from named n
    union
    select c.id from public.cards c, dexn
    where dexn.n between 1 and 6 and c.dex_ids && array(select d from dex)
  )
  select c.id, c.number, c.name_en, c.name_de, c.name_ja, c.name_ko, c.name_zh,
         c.rarity, c.image_url, c.set_id,
         coalesce(s.name_de, s.name_en, s.name_ja, s.name_zh, s.name_ko, s.id) as set_name,
         s.region, s.release_date,
         count(*) over () as total
  from hits h
  join public.cards c on c.id = h.id
  join public.sets s on s.id = c.set_id
  where p_region = 'all' or s.region = p_region
  order by s.release_date desc nulls last, c.set_id, c.number
  limit p_limit offset p_offset
$$;

grant execute on function public.search_cards(text, text, int, int) to authenticated;

-- Test: select name_en, set_name, number, total from search_cards('Pikachu') limit 5;
