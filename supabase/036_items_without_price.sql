-- 036: NUR LESEN. Welche Einträge deiner Sammlung haben weder Cardmarket-Preis noch eigenen Wert?
-- Zeigt pro Eintrag, ob die Karte gar keine Cardmarket-Zuordnung hat ("keine Zuordnung") oder ob die Zuordnung da ist, aber kein Preis ("kein Preis").
with latest as (
  select distinct on (cardmarket_product_id) cardmarket_product_id, trend, trend_foil
  from cardmarket_prices order by cardmarket_product_id, snapshot_date desc
)
select s.region, coalesce(s.name_en, s.name_ja, s.id) as setname, c.id as card_id, c.number, coalesce(c.name_en, c.name_ja) as karte,
       ci.language, ci.finish, ci.condition, ci.quantity,
       v.cardmarket_product_id,
       case when v.cardmarket_product_id is null then 'keine Zuordnung' else 'kein Preis' end as grund
from collection_items ci
join cards c on c.id = ci.card_id
join sets s on s.id = c.set_id
left join card_variants v on v.id = ci.variant_id
left join latest l on l.cardmarket_product_id = v.cardmarket_product_id
where ci.status = 'owned' and ci.manual_value is null and not ci.is_graded
  and (v.cardmarket_product_id is null or coalesce(case when ci.finish = 'reverse_holo' then l.trend_foil else l.trend end, 0) = 0)
  and not exists (select 1 from condition_prices cp where cp.card_id = ci.card_id and cp.condition = ci.condition and cp.source = 'cardmarket')
order by grund, s.region, setname, c.number;
