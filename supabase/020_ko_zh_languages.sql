-- 020: Koreanisch und Chinesisch (vereinfacht/traditionell) im Katalog zulassen.
-- Im Supabase "SQL Editor" einfügen und auf "Run" klicken.
alter table public.sets drop constraint if exists sets_region_check;
alter table public.sets add constraint sets_region_check
  check (region in ('international', 'japan', 'korea', 'china', 'taiwan'));

alter table public.sets  add column if not exists name_ko text;
alter table public.sets  add column if not exists name_zh text;
alter table public.cards add column if not exists name_ko text;
alter table public.cards add column if not exists name_zh text;
