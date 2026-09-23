-- SmartHerd: ejecutar en un proyecto Supabase dedicado. No modifica EcoPoints.
create table public.animals (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 80), ear_tag text not null check(length(trim(ear_tag)) between 1 and 50),
 breed text not null check(length(trim(breed)) between 1 and 80), sex text not null check(sex in ('hembra','macho')),
 purpose text not null check(purpose in ('leche','engorde','doble')), birth_date date not null check(birth_date<=current_date),
 status text not null default 'activo' check(status in ('activo','vendido','baja')), created_at timestamptz not null default now(), unique(id,owner_id)
);
create unique index animals_owner_tag on public.animals(owner_id,lower(ear_tag));
create table public.devices (
 id text primary key check(id ~ '^SH-[A-Z0-9-]{3,40}$'), owner_id uuid not null references auth.users(id) on delete cascade,
 animal_id uuid not null unique, enabled boolean not null default true, created_at timestamptz not null default now(),
 foreign key(animal_id,owner_id) references public.animals(id,owner_id), unique(id,animal_id,owner_id)
);
create table public.events (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade, animal_id uuid not null,
 type text not null check(type in ('peso','vacuna','tratamiento','revision','celo','servicio','preniez','parto')),
 date date not null check(date<=current_date),value numeric,notes text not null default '' check(length(notes)<=2000), next_date date,
 foreign key(animal_id,owner_id) references public.animals(id,owner_id),
 check((type='peso' and value is not null and value>0 and value<=2000) or (type<>'peso' and value is null))
);
create table public.telemetry (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 device_id text not null,animal_id uuid not null,packet_id text not null check(packet_id ~ '^[a-zA-Z0-9_-]{1,80}$'),
 recorded_at timestamptz not null,received_at timestamptz not null default now(),
 temperature_c double precision check(temperature_c between -55 and 125),activity double precision check(activity between 0 and 100),
 battery_pct double precision check(battery_pct between 0 and 100),latitude double precision check(latitude between -90 and 90),longitude double precision check(longitude between -180 and 180),
 check((latitude is null)=(longitude is null)),check(coalesce(temperature_c,activity,battery_pct,latitude) is not null),
 foreign key(device_id,animal_id,owner_id) references public.devices(id,animal_id,owner_id),unique(device_id,packet_id)
);
create index telemetry_owner_time on public.telemetry(owner_id,recorded_at desc);
create index telemetry_animal_time on public.telemetry(animal_id,recorded_at desc);
create table public.farm_settings (
 owner_id uuid primary key references auth.users(id) on delete cascade,name text not null check(length(trim(name)) between 1 and 100),
 polygon jsonb not null default '[]'::jsonb check(jsonb_typeof(polygon)='array'),
 offline_minutes integer not null default 30 check(offline_minutes between 1 and 10080),
 temperature_delta numeric not null default 2 check(temperature_delta between 0.1 and 20),
 activity_ratio numeric not null default 2 check(activity_ratio between 1.1 and 20),
 battery_min numeric not null default 20 check(battery_min between 0 and 100)
);
create table public.alert_acknowledgements (
 owner_id uuid not null references auth.users(id) on delete cascade,alert_id text not null check(length(alert_id)<=200),
 created_at timestamptz not null default now(),primary key(owner_id,alert_id)
);
-- Hashes de claves de estación. Nunca accesibles desde el navegador.
create table public.gateway_credentials (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'), enabled boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.gateway_credentials enable row level security;
revoke all on public.gateway_credentials from anon,authenticated;
grant select on public.gateway_credentials to service_role;
do $$ declare t text;begin
 foreach t in array array['animals','devices','events','farm_settings','alert_acknowledgements'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy own_rows on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',t);
 execute format('revoke all on public.%I from anon',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
end $$;
alter table public.telemetry enable row level security;
create policy own_readings on public.telemetry for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.telemetry from anon,authenticated;
grant select on public.telemetry to authenticated;
grant select,insert on public.telemetry to service_role;
grant select on public.devices,public.animals to service_role;
