-- =====================================================================
-- Pokémon-Sammlungs-App – Erweiterung 011: digitale Sets entfernen
-- Im Supabase "SQL Editor" einmal einfügen und auf "Run" klicken.
--
-- Löscht alle Sets der Serie "Pokémon TCG Pocket" (nur digital, keine
-- physischen Karten) samt Karten und Varianten. Sets, aus denen bereits
-- Karten in einer Sammlung liegen, bleiben aus Sicherheitsgründen erhalten.
-- =====================================================================

delete from public.sets s
where s.series ilike '%pocket%'
  and not exists (
    select 1 from public.collection_items i
    join public.cards c on c.id = i.card_id
    where c.set_id = s.id
  );

-- Kontrolle: sollte 0 Zeilen liefern
select id, name_en, series from public.sets where series ilike '%pocket%';
