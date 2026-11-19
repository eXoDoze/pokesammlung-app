-- 018: ja:BW8b enthält fälschlich Spiral-Force-Karten (Kopie von BW8a). Richtig ist Thunder Knuckle (= tcgp:23905).
-- Bricht ab (ändert nichts), wenn in BW8b oder tcgp:23905 schon Karten in deiner Sammlung liegen.
do $$
begin
  if exists (select 1 from public.collection_items i join public.cards c on c.id = i.card_id
              where c.set_id in ('ja:BW8b','tcgp:23905')) then
    raise exception 'Abbruch: Es liegen Sammlungseinträge in BW8b oder tcgp:23905.';
  end if;

  delete from public.card_variants where card_id in (select id from public.cards where set_id = 'ja:BW8b');
  delete from public.cards where set_id = 'ja:BW8b';

  update public.cards set set_id = 'ja:BW8b' where set_id = 'tcgp:23905';
  delete from public.sets where id = 'tcgp:23905';
end $$;

-- Kontrolle: BW8b soll jetzt Weedle/Kakuna/Beedrill enthalten
select set_id, number, name_en from public.cards where set_id = 'ja:BW8b' and ltrim(number,'0') in ('1','2','3') order by number;
