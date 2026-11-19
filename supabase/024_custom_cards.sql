-- 024: Eigene Karten anlegen (letzter Ausweg, wenn eine Karte im Katalog fehlt)
-- Legt Karte + Variante (und bei Bedarf ein Set "custom:...") an und gibt die Karten-ID zurück.
-- Läuft mit erhöhten Rechten, weil Katalogtabellen für Nutzer sonst nur lesbar sind.

create or replace function public.create_custom_card(
  p_name      text,
  p_set_name  text default null,
  p_region    text default 'international',
  p_number    text default '',
  p_finish    text default 'non_holo',
  p_image_url text default null,
  p_rarity    text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_set  text;
  v_id   text;
  v_name text := coalesce(nullif(trim(p_set_name), ''), 'Eigene Karten');
  v_slug text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Der Name der Karte fehlt'; end if;
  if p_finish not in ('non_holo', 'holo', 'reverse_holo') then raise exception 'Ungültige Ausführung'; end if;
  if p_region not in ('international', 'japan', 'korea', 'china', 'taiwan') then raise exception 'Ungültige Region'; end if;

  -- vorhandenes Set mit gleichem Namen verwenden, sonst eigenes anlegen
  select s.id into v_set from public.sets s
  where lower(coalesce(s.name_en, '')) = lower(v_name) or lower(coalesce(s.name_de, '')) = lower(v_name)
     or lower(coalesce(s.name_ja, '')) = lower(v_name) or lower(coalesce(s.name_zh, '')) = lower(v_name)
  order by (s.region = p_region) desc, s.release_date desc nulls last
  limit 1;

  if v_set is null then
    v_slug := regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g');
    v_set := 'custom:' || coalesce(nullif(trim(both '-' from v_slug), ''), 'eigene-karten');
    insert into public.sets (id, name_en, series, region, card_count)
    values (v_set, v_name, 'Eigene Einträge', p_region, 0)
    on conflict (id) do nothing;
  end if;

  v_id := 'custom:' || gen_random_uuid()::text;
  insert into public.cards (id, set_id, number, name_en, rarity, image_url, finishes, dex_ids)
  values (v_id, v_set, coalesce(trim(p_number), ''), trim(p_name), nullif(trim(p_rarity), ''), nullif(trim(p_image_url), ''), array[p_finish], '{}');
  insert into public.card_variants (id, card_id, finish, stamps)
  values (v_id || ':std', v_id, p_finish, '{}');

  update public.sets set card_count = (select count(*) from public.cards where set_id = v_set)
  where id = v_set and id like 'custom:%';

  return v_id;
end;
$$;

revoke all on function public.create_custom_card(text, text, text, text, text, text, text) from public;
grant execute on function public.create_custom_card(text, text, text, text, text, text, text) to authenticated;
