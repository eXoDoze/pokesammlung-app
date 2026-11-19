-- 016: Englische Namen/Bilder für ja:SM1p..SM5p (= dieselben Sets wie SM1+..SM5+) und ja:VS1 per Kartennummer kopieren.
-- Überschreibt nichts, was schon gefüllt ist.
with pairs(target, source) as (values
  ('ja:SM1p','ja:SM1+'), ('ja:SM2p','ja:sm2+'), ('ja:SM3p','ja:SM3+'),
  ('ja:SM4p','ja:SM4+'), ('ja:SM5p','ja:SM5+'), ('ja:VS1','tcgp:24180'))
update public.cards c
   set name_en   = coalesce(c.name_en, e.name_en),
       image_url = coalesce(c.image_url, e.image_url)
  from pairs p
  join public.cards e on e.set_id = p.source
 where c.set_id = p.target
   and ltrim(e.number,'0') = ltrim(c.number,'0')
   and (c.name_en is null or c.image_url is null);

-- Kontrolle
select set_id, count(*) filter (where name_en is null) as ohne_name, count(*) as karten
  from public.cards where set_id in ('ja:SM1p','ja:SM2p','ja:SM3p','ja:SM4p','ja:SM5p','ja:VS1')
 group by set_id order by set_id;
