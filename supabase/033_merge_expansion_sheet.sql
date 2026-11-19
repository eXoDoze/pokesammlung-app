-- 033: Karten aus "Expansion Sheet" (SCNDX-Import) auf die echten Vending-Machine-Karten umhängen.
-- Deine Sammlungseinträge (Zustand, Kaufpreis, eigener Wert, Notizen) bleiben erhalten, nur die Karte dahinter wechselt.
-- Eindeutige Namen (23 Karten) werden automatisch umgehängt. Mehrdeutige stehen unten als Block zum Ausfüllen.
-- Ausführen im Supabase SQL-Editor. Alles läuft in einer Transaktion.

begin;

-- 1) Eindeutige Zuordnung: genau eine gleichnamige Karte in den Vending-Sets
create temp table es_map on commit drop as
select e.id as old_id,
       (array_agg(c.id))[1] as new_id
from cards e
join sets es on es.id = e.set_id and es.name_en = 'Expansion Sheet'
join cards c on lower(c.name_en) = lower(e.name_en)
            and c.set_id in (select id from sets where name_en ilike '%vending%')
group by e.id
having count(*) = 1;

-- 2) Manuelle Zuordnung für mehrdeutige Karten. Beispiel-Zeilen unten ENTFERNEN oder anpassen, bevor du sie benutzt:
--    old_id = Expansion-Sheet-Karte, new_id = Karte im Vending-Set (id aus: select id, name_en, set_id from cards where set_id like 'tcgp:2420%')
-- insert into es_map values ('scndx:expansion-sheet-39', 'tcgp:...');   -- Graveler
-- insert into es_map values ('scndx:expansion-sheet-60', 'tcgp:...');   -- Machoke
-- insert into es_map values ('scndx:expansion-sheet-82', 'tcgp:...');   -- Mewtwo

-- 3) Sammlungseinträge umhängen (Variante: bevorzugt die Nicht-Holo-Variante der neuen Karte)
update collection_items ci
set card_id = m.new_id,
    variant_id = (select v.id from card_variants v where v.card_id = m.new_id
                  order by (v.finish = 'non_holo') desc, v.id limit 1)
from es_map m
where ci.card_id = m.old_id;

-- 4) Alte Expansion-Sheet-Karten ohne Sammlungseintrag löschen
delete from card_variants where card_id in (select old_id from es_map);
delete from cards c
where c.set_id = 'scndx:expansion-sheet'
  and not exists (select 1 from collection_items ci where ci.card_id = c.id);

-- 5) Set löschen, wenn leer
delete from sets s
where s.id = 'scndx:expansion-sheet'
  and not exists (select 1 from cards c where c.set_id = s.id);

commit;

-- Kontrolle: Was ist von Expansion Sheet übrig?
select c.id, c.number, c.name_en, (select count(*) from collection_items ci where ci.card_id = c.id) as in_sammlung
from cards c where c.set_id = 'scndx:expansion-sheet' order by c.number::int;

-- Hilfsabfrage für die Nachzügler (Kadabra, Pokémon Machine):
-- select c.id, c.name_en, c.number, s.name_en as setname from cards c join sets s on s.id = c.set_id
-- where s.name_en ilike '%vending%' and (c.name_en ilike '%kadabra%' or c.name_en ilike '%machine%');
