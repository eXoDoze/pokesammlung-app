-- 032: NUR LESEN, ändert nichts. Prüft, ob die Karten aus "Expansion Sheet" in den Vending-Machine-Sets doppelt vorhanden sind.

-- 1) Alle Sets mit "Vending" oder "Expansion Sheet" im Namen
select id, name_en, region, card_count,
       (select count(*) from cards c where c.set_id = sets.id) as karten
from sets
where name_en ilike '%vending%' or name_en ilike 'Expansion Sheet%'
order by region, name_en;

-- 2) Jede Expansion-Sheet-Karte mit den gleichnamigen Karten aus Vending-Sets + wie oft sie in Sammlungen liegt
select e.id, e.number, e.name_en,
       (select count(*) from collection_items ci where ci.card_id = e.id) as in_sammlung,
       string_agg(distinct s.name_en || ' #' || c.number, ' | ') as kandidaten
from cards e
join sets es on es.id = e.set_id and es.name_en = 'Expansion Sheet'
left join cards c on lower(c.name_en) = lower(e.name_en)
                 and c.set_id in (select id from sets where name_en ilike '%vending%')
left join sets s on s.id = c.set_id
group by e.id, e.number, e.name_en
order by e.number::int nulls last;
