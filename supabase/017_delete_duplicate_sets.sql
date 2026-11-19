-- 017: Dubletten-Sets löschen (nur "tcgp:"-Kopien von Sets, die als "ja:" schon vollständig sind).
-- Sicherheitsnetz: es werden nur Sets gelöscht, in denen KEINE Karte in deiner Sammlung liegt.
-- Nicht enthalten (bleiben): tcgp:23729 (Neo 4, einzige Namensquelle), tcgp:23975, tcgp:23847, tcgp:23905 (BW8, noch zu klären).
create temp table dup_sets(id text primary key);
insert into dup_sets values
 ('tcgp:23730'),('tcgp:23731'),('tcgp:23732'),('tcgp:23733'),('tcgp:23734'),('tcgp:24141'),
 ('tcgp:24117'),('tcgp:24114'),('tcgp:24103'),('tcgp:24101'),('tcgp:24085'),('tcgp:24084'),
 ('tcgp:24099'),('tcgp:24090'),('tcgp:23793');

delete from dup_sets d where exists (
  select 1 from public.collection_items i join public.cards c on c.id = i.card_id where c.set_id = d.id);

delete from public.card_variants where card_id in (select id from public.cards where set_id in (select id from dup_sets));
delete from public.cards where set_id in (select id from dup_sets);
delete from public.sets where id in (select id from dup_sets);

select count(*) as verbleibende_tcgp_sets from public.sets where id like 'tcgp:%';
