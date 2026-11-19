-- 035: Eigener Wert kann Vorrang vor dem Cardmarket-Preis haben (z. B. Misprint "Tattoo Leg", der bei Cardmarket keine eigene Variante ist).
alter table public.collection_items add column if not exists prefer_manual boolean not null default false;

-- Dein Tattoo-Leg-Mewtwo: eigenen Wert (100 €) immer verwenden
update public.collection_items set prefer_manual = true
where card_id = 'tcgp:617539' and manual_value is not null;
