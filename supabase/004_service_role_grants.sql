-- =====================================================================
-- Pokémon-Sammlungs-App – Erweiterung 004: Rechte für den Katalogimport
-- Im Supabase "SQL Editor" einmal einfügen und auf "Run" klicken.
--
-- Der Importlauf in der Cloud schreibt mit der Rolle "service_role" in die
-- Tabellen. Weil die Option "Grant API access to new tables automatically"
-- bei dir aus war, vergeben wir diese Rechte sicherheitshalber selbst.
-- Die normalen App-Nutzer bekommen dadurch KEINE zusätzlichen Rechte.
-- =====================================================================

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
