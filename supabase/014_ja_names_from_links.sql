-- 014: Englische Namen für japanische Karten aus der Verknüpfung mit dem englischen Gegenstück
-- (betrifft v.a. alte Sets ohne TCGplayer-Nummern: PMCG1-6, neo1-4, PCG3 ...). Überschreibt nichts.
-- Im Supabase "SQL Editor" einfügen und auf "Run" klicken.
update public.cards c
   set name_en = e.name_en
  from public.ja_card_links l
  join public.cards e on e.id = l.source_card_id
 where c.id = l.card_id
   and c.name_en is null
   and e.name_en is not null;

-- Kontrolle: wie viele japanische Karten haben noch keinen englischen Namen, je Set (Top 30)?
select set_id, count(*) as ohne_name
  from public.cards
 where set_id like 'ja:%' and name_en is null
 group by set_id order by ohne_name desc limit 30;
