-- 029 (v2, NULL-Fehler behoben: Karten mit leeren Feldern trafen auf jeden Suchbegriff): Suche mit mehreren Begriffen, z. B. "pikachu xy202" oder "glurak base set".
-- Jeder Begriff muss zu Kartenname (EN/DE/JA/KO/ZH), Kartennummer, Set-Name oder Set-ID passen.
-- Die Erweiterung über die Pokédex-Nummer (alle Karten desselben Pokémon) gilt nur bei EINEM Suchbegriff.

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
  with toks as (
    select '%' || replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
    from unnest(regexp_split_to_array(trim(p_q), '\s+')) as t
    where length(t) > 0
  ),
  tcount as (select count(*) as n from toks),
  named as (
    select c.id, c.dex_ids
    from public.cards c
    join public.sets s on s.id = c.set_id
    where length(trim(p_q)) >= 2
      and (p_region = 'all' or s.region = p_region)
      and not exists (
        select 1 from toks
        where not (
          lower(concat_ws(' ', c.name_en, c.name_de, c.name_ja, c.name_ko, c.name_zh, c.number,
                              s.name_en, s.name_de, s.id)) ilike toks.pat
        )
      )
  ),
  dex as (
    select distinct c.dex_ids[1] as d
    from named n
    join public.cards c on c.id = n.id, tcount, toks
    where tcount.n = 1 and cardinality(c.dex_ids) = 1
      and lower(concat_ws(' ', c.name_en, c.name_de, c.name_ja, c.name_ko, c.name_zh)) ilike toks.pat
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

-- Test: select name_en, set_name, number, total from search_cards('pikachu xy202');
