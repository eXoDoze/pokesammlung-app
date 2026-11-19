-- 022: Eigenes Set "Pokémon Snap Contest" (TCGplayer hat die Karten fälschlich in CoroCoro einsortiert)

insert into public.sets (id, name_en, name_ja, series, region, card_count)
values ('tcgp:snap-contest', 'Pokémon Snap Contest', 'ポケモンスナップコンテスト', 'TCGplayer Japan', 'japan', 0)
on conflict (id) do nothing;

-- Karten verschieben (Produkt-IDs von TCGplayer)
update public.cards
set set_id = 'tcgp:snap-contest'
where id in ('tcgp:617217', 'tcgp:617247', 'tcgp:617253', 'tcgp:617237', 'tcgp:617228');

-- Kartenzahlen aktualisieren
update public.sets s
set card_count = (select count(*) from public.cards c where c.set_id = s.id)
where s.id in ('tcgp:snap-contest', 'tcgp:24194');

-- Kontrolle
select s.id, s.name_en, s.card_count, (select string_agg(c.name_en, ', ' order by c.name_en) from public.cards c where c.set_id = s.id) as karten
from public.sets s where s.id in ('tcgp:snap-contest', 'tcgp:24194');
