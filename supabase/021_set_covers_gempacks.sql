-- 021: Titelbild je Set + Gem Packs in eine gemeinsame Serie

-- 1) Neue Spalte für ein Titelbild (Karte aus dem Set, wenn es kein Logo gibt)
alter table public.sets add column if not exists cover_url text;

update public.sets s
set cover_url = (
  select c.image_url from public.cards c
  where c.set_id = s.id and c.image_url is not null
  order by c.number
  limit 1
)
where s.cover_url is null;

-- 2) Gem Packs: eine Serie, Erscheinungsdatum (Näherung: Aufnahme bei Cardmarket), deutscher Name
update public.sets set series = 'Gem Pack (China)' where id like 'zh-cn:CBB_C';

update public.sets s set release_date = d.dt::date
from (values
  ('zh-cn:CBB1C', '2025-01-16'), ('zh-cn:CBB2C', '2025-05-15'), ('zh-cn:CBB3C', '2025-09-19'),
  ('zh-cn:CBB4C', '2026-02-06'), ('zh-cn:CBB5C', '2026-04-24'), ('zh-cn:CBB6C', '2026-08-07'),
  ('zh-cn:CBB7C', '2026-10-20')
) as d(id, dt)
where s.id = d.id and s.release_date is null;

update public.sets set name_en = 'Gem Pack Vol. ' || substring(id from 'CBB(\d)C')
where id like 'zh-cn:CBB_C' and (name_en is null or name_en = '');

-- 3) Kontrolle
select id, name_en, name_zh, series, release_date, card_count, cover_url is not null as hat_bild
from public.sets where id like 'zh-cn:CBB_C' order by id;
