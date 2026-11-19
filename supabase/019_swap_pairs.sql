-- 019: In fünf Doppel-Sets waren a und b vertauscht (Zuordnung über Datum war reine Reihenfolge).
-- Die Karten wechseln das Set; Sammlungseinträge hängen an der Karte und bleiben dadurch korrekt.
update public.cards
   set set_id = case set_id
     when 'ja:BW1a' then 'ja:BW1b' when 'ja:BW1b' then 'ja:BW1a'
     when 'ja:BW3a' then 'ja:BW3b' when 'ja:BW3b' then 'ja:BW3a'
     when 'ja:BW5a' then 'ja:BW5b' when 'ja:BW5b' then 'ja:BW5a'
     when 'ja:BW6a' then 'ja:BW6b' when 'ja:BW6b' then 'ja:BW6a'
     when 'ja:XY1a' then 'ja:XY1b' when 'ja:XY1b' then 'ja:XY1a'
   end
 where set_id in ('ja:BW1a','ja:BW1b','ja:BW3a','ja:BW3b','ja:BW5a','ja:BW5b',
                  'ja:BW6a','ja:BW6b','ja:XY1a','ja:XY1b');

-- Kontrolle: Karte 001 je Set (BW1a soll jetzt das Black-Collection-Set sein)
select s.id, s.name_ja, c.number, c.name_en
  from public.sets s join public.cards c on c.set_id = s.id
 where s.id in ('ja:BW1a','ja:BW1b','ja:BW3a','ja:BW3b','ja:BW5a','ja:BW5b','ja:BW6a','ja:BW6b','ja:XY1a','ja:XY1b')
   and ltrim(c.number,'0') = '1' order by s.id;
