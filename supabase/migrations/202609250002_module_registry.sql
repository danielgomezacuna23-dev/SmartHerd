-- Identidad física del ESP32 y su función. Registrar no configura el firmware.
alter table public.devices add constraint devices_id_owner_unique unique (id, owner_id);
create table public.module_registry (
  owner_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null check (module_id ~ '^[0-9A-F]{12}$'),
  role text not null check (role in ('emisor','receptor')),
  name text not null check (length(trim(name)) between 1 and 80),
  device_id text,
  created_at timestamptz not null default now(),
  primary key (owner_id, module_id),
  foreign key (device_id, owner_id) references public.devices(id, owner_id),
  check ((role = 'emisor') = (device_id is not null))
);
create unique index one_emitter_per_collar on public.module_registry(owner_id, device_id) where device_id is not null;
alter table public.module_registry enable row level security;
create policy own_modules on public.module_registry for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
revoke all on public.module_registry from anon;
grant select, insert, update, delete on public.module_registry to authenticated;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename = 'module_registry') then
    alter publication supabase_realtime add table public.module_registry;
  end if;
end $$;
