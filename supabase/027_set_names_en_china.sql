-- Englische Namen für chinesische Sets (nur wo name_en noch leer ist).
-- Quelle: pokipair.com / Bulbapedia Set-Listen; SV7–SV10 sind Traditional-Chinese-Sets (japanische Originalnamen).
update sets s set name_en = v.n
from (values
 ('zh-cn:CS1.5C','Dynamax Tactics'),
 ('zh-cn:CS1aC','Dynamax Clash (A)'),
 ('zh-cn:CS1bC','Dynamax Clash (B)'),
 ('zh-cn:CS2.5C','Brilliant Counterattack'),
 ('zh-cn:CS2aC','Vivid Portrayals (A)'),
 ('zh-cn:CS2bC','Vivid Portrayals (B)'),
 ('zh-cn:CS3.5C','Scorching Skies'),
 ('zh-cn:CS3aC','Primordial Arts (A)'),
 ('zh-cn:CS3bC','Primordial Arts (B)'),
 ('zh-cn:CS4.5C','Final Flame Dance'),
 ('zh-cn:CS4aC','Nine Colors Gathering (A)'),
 ('zh-cn:CS4bC','Nine Colors Gathering (B)'),
 ('zh-cn:CS5.5C','Shadow of Glory'),
 ('zh-cn:CS5aC','Brave Stars (A)'),
 ('zh-cn:CS5bC','Brave Stars (B)'),
 ('zh-cn:CS6.5C','Victory Stars'),
 ('zh-cn:CS6aC','Shadow of the Blue Sea (A)'),
 ('zh-cn:CS6bC','Shadow of the Blue Sea (B)'),
 ('zh-cn:csm1.5','Battle Elite'),
 ('zh-cn:CSM1.5C','Battle Elite'),
 ('zh-cn:csm1a','Storming Emergence (A)'),
 ('zh-cn:CSM1aC','Storming Emergence (A)'),
 ('zh-cn:csm1b','Storming Emergence (B)'),
 ('zh-cn:CSM1bC','Storming Emergence (B)'),
 ('zh-cn:csm1c','Storming Emergence (C)'),
 ('zh-cn:CSM1cC','Storming Emergence (C)'),
 ('zh-cn:csm2.5','Striking Competition'),
 ('zh-cn:CSM2.5C','Striking Competition'),
 ('zh-cn:csm2a','Shining Synergy (A)'),
 ('zh-cn:CSM2aC','Shining Synergy (A)'),
 ('zh-cn:csm2b','Shining Synergy (B)'),
 ('zh-cn:CSM2bC','Shining Synergy (B)'),
 ('zh-cn:csm2c','Shining Synergy (C)'),
 ('zh-cn:CSM2cC','Shining Synergy (C)'),
 ('zh-cn:CSMPiC','Battle Party Combo Bonus Pack'),
 ('zh-cn:CSV1C','Eternal Beginnings'),
 ('zh-cn:CSV2C','Miracle Journey'),
 ('zh-cn:CSV3C','Fearless Terastal'),
 ('zh-cn:CSV4C','Reward Round'),
 ('zh-cn:CSV5C','Dark Crystal Blaze'),
 ('zh-cn:CSV6C','Paradox Veil'),
 ('zh-cn:CSV7C','Blade Awakened'),
 ('zh-cn:CSV8C','Bright Fantasy'),
 ('zh-cn:CSV9.5C','Crystal Gathering'),
 ('zh-cn:CSV9C','Stellar Crystal'),
 ('zh-cn:SV7','Stellar Miracle'),
 ('zh-cn:SV7a','Paradise Dragona'),
 ('zh-cn:SV8','Super Electric Breaker'),
 ('zh-cn:SV8a','Terastal Fest ex'),
 ('zh-cn:SV10','Glory of Team Rocket')
) as v(id, n)
where s.id = v.id and (s.name_en is null or s.name_en = '');

-- Kontrolle: was fehlt noch?
select region, id, name_ja, name_ko, name_zh
from sets where region <> 'international' and (name_en is null or name_en = '')
order by region, id;
