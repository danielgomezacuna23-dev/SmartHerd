-- Permite actualizar el panel al recibir cambios; RLS existente limita cada finca.
-- Ejecutar después de 202609160001_initial.sql en el proyecto SmartHerd.
do $$
declare table_name text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'create publication supabase_realtime';
  end if;
  foreach table_name in array array[
    'telemetry', 'devices', 'animals', 'events',
    'farm_settings', 'alert_acknowledgements'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
