-- 031: Fehlende Bilder (Taiwan/Korea/China/Japan) mit dem Bild derselben Karte aus einem Schwester-Set füllen.
-- Gleicher Set-Code + gleiche Kartennummer = gleiche Karte (z. B. zh-tw:SV5K Nr. 001 = ja:SV5K Nr. 001).
-- Das Bild zeigt dann die japanische (bzw. englische) Version, aber die richtige Illustration.
-- Echte Bilder können später das Fallback ersetzen: image_fallback = true markiert diese Karten.

alter table cards add column if not exists image_fallback boolean not null default false;

with donor as (
  select distinct on (lower(split_part(s.id, ':', 2)), c.number)
         lower(split_part(s.id, ':', 2)) as code, c.number, c.image_url
  from cards c join sets s on s.id = c.set_id
  where c.image_url is not null and c.image_fallback = false and s.id like '%:%'
  order by lower(split_part(s.id, ':', 2)), c.number,
           case s.region when 'japan' then 1 when 'korea' then 2 when 'taiwan' then 3 else 4 end
), target as (
  select c.id, lower(split_part(c.set_id, ':', 2)) as code, c.number
  from cards c
  where c.image_url is null and c.set_id like '%:%'
)
update cards c set image_url = d.image_url, image_fallback = true
from target t join donor d on d.code = t.code and d.number = t.number
where c.id = t.id;

-- Kontrolle: was fehlt jetzt noch?
select s.region, left(c.id, 8) as praefix, count(*) as ohne_bild
from cards c join sets s on s.id = c.set_id
where c.image_url is null
group by 1, 2 order by 3 desc limit 30;
