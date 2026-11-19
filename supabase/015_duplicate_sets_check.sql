-- 015: NUR ANZEIGEN (ändert nichts). Mögliche Dubletten: ein "tcgp:"-Set, zu dem es ein "ja:"-Set
-- mit gleichem Veröffentlichungsdatum und ähnlicher Kartenzahl gibt, das ebenfalls Karten hat.
-- "in_sammlung" = Anzahl deiner Einträge in Karten des tcgp-Sets (muss 0 sein, sonst nicht löschen).
select t.id as tcgp_set, t.name_en as tcgp_name, t.card_count as tcgp_karten,
       j.id as ja_set, j.name_en as ja_name, j.card_count as ja_karten, t.release_date,
       (select count(*) from public.collection_items i join public.cards c on c.id = i.card_id where c.set_id = t.id) as in_sammlung
  from public.sets t
  join public.sets j on j.id like 'ja:%' and j.release_date = t.release_date
                    and abs(j.card_count - t.card_count) <= greatest(3, 0.1 * t.card_count)
 where t.id like 'tcgp:%'
   and exists (select 1 from public.cards c where c.set_id = j.id)
 order by t.release_date, t.id;
