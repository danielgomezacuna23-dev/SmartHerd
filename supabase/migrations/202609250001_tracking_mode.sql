-- Preferencia de rastreo por finca. El modo rápido caduca automáticamente.
create table if not exists public.tracking_mode (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  interval_seconds integer not null default 300 check (interval_seconds in (5, 300)),
  live_until timestamptz,
  requested_at timestamptz not null default now(),
  check ((interval_seconds = 5) = (live_until is not null))
);
alter table public.tracking_mode enable row level security;
create policy own_tracking_mode on public.tracking_mode
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
revoke all on public.tracking_mode from anon;
grant select, insert, update on public.tracking_mode to authenticated;
grant select on public.tracking_mode to service_role;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'tracking_mode'
  ) then
    alter publication supabase_realtime add table public.tracking_mode;
  end if;
end $$;
