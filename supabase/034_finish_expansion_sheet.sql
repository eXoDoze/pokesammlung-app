-- 034: Letzte fünf Expansion-Sheet-Karten umhängen, dann Expansion Sheet löschen.
-- Graveler -> Serie 3, Machoke -> Serie 2, Mewtwo -> Serie 3 (+ Notiz "Tattoo Leg"), Kadabra -> Shin-ichi Yoshida,
-- Ooyama's Pokémon Machine (fehlt bei TCGplayer) wird als eigene Karte in Serie 3 angelegt.

begin;

-- 1) Fehlende Karte in Vending Series 3 anlegen
insert into cards (id, set_id, number, name_en, rarity, image_url, finishes, dex_ids)
values ('tcgp:24208-ooyama-pokemon-machine', 'tcgp:24208', '', 'Ooyama Pokemon Machine', null, null, array['non_holo'], '{}')
on conflict (id) do nothing;
insert into card_variants (id, card_id, finish, stamps)
values ('tcgp:24208-ooyama-pokemon-machine:std', 'tcgp:24208-ooyama-pokemon-machine', 'non_holo', '{}')
on conflict (id) do nothing;

-- 2) Zuordnung
create temp table es_map (old_id text, new_id text) on commit drop;
insert into es_map values
 ('scndx:expansion-sheet-39',  'tcgp:617522'),                           -- Graveler, Serie 3
 ('scndx:expansion-sheet-60',  'tcgp:617485'),                           -- Machoke, Serie 2
 ('scndx:expansion-sheet-82',  'tcgp:617539'),                           -- Mewtwo, Serie 3
 ('scndx:expansion-sheet-51',  'tcgp:617532'),                           -- Kadabra (Shin-ichi Yoshida)
 ('scndx:expansion-sheet-113', 'tcgp:24208-ooyama-pokemon-machine');     -- Ooyama Pokémon Machine

-- 3) Sammlungseinträge umhängen
update collection_items ci
set card_id = m.new_id,
    variant_id = (select v.id from card_variants v where v.card_id = m.new_id
                  order by (v.finish = 'non_holo') desc, v.id limit 1)
from es_map m
where ci.card_id = m.old_id;

-- 4) Mewtwo: Misprint-Hinweis in die Notiz
update collection_items
set notes = trim(both ' ' from concat_ws(' | ', nullif(notes, ''), 'Misprint: Tattoo Leg'))
where card_id = 'tcgp:617539' and (notes is null or notes not ilike '%tattoo leg%');

-- 5) Alte Karten und das Set entfernen
delete from card_variants where card_id in (select old_id from es_map);
delete from cards c
where c.set_id = 'scndx:expansion-sheet'
  and not exists (select 1 from collection_items ci where ci.card_id = c.id);
delete from sets s
where s.id = 'scndx:expansion-sheet'
  and not exists (select 1 from cards c where c.set_id = s.id);

commit;

-- Kontrolle: übrig im Expansion Sheet (sollte leer sein) und die fünf umgehängten Einträge
select c.id, c.name_en from cards c where c.set_id = 'scndx:expansion-sheet';
select ci.card_id, c.name_en, s.name_en as setname, ci.notes, ci.manual_value
from collection_items ci join cards c on c.id = ci.card_id join sets s on s.id = c.set_id
where ci.card_id in ('tcgp:617522','tcgp:617485','tcgp:617539','tcgp:617532','tcgp:24208-ooyama-pokemon-machine');
