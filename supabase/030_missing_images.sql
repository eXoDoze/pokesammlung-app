-- 030: Fehlende Kartenbilder. Erst Diagnose, dann TCGplayer-Bild aus der Produkt-ID ableiten.

-- 1) Diagnose: wie viele Karten haben kein Bild? (pro Region)
select s.region, count(*) filter (where c.image_url is null) as ohne_bild, count(*) as gesamt
from cards c join sets s on s.id = c.set_id
group by s.region order by s.region;

-- 2) Karten aus TCGplayer-Importen (id endet auf die Produkt-ID) bekommen das Standardbild
update cards
set image_url = 'https://tcgplayer-cdn.tcgplayer.com/product/' || substring(id from '(\d+)$') || '_400w.jpg'
where image_url is null and id ~ '^tcgp:(\d+-[^-]+-)?\d+$';

-- 3) Was fehlt danach noch? (Gem Packs: Bilder folgen später)
select s.region, left(c.id, 8) as praefix, count(*) as ohne_bild
from cards c join sets s on s.id = c.set_id
where c.image_url is null
group by 1, 2 order by 3 desc limit 30;
