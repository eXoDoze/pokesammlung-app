-- Wie viele asiatische Sets haben KEINEN englischen Namen?
select region, count(*) as sets, count(*) filter (where name_en is null or name_en = '') as ohne_englisch
from sets group by region order by region;

-- Beispiele ohne englischen Namen
select id, region, name_ja, name_ko, name_zh
from sets where region <> 'international' and (name_en is null or name_en = '')
order by region, id limit 50;
