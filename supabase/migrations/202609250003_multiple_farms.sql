-- Una cuenta puede administrar varias fincas. Conserva los datos anteriores en una finca.
alter table public.farm_settings add column id uuid default gen_random_uuid();
update public.farm_settings set id = gen_random_uuid() where id is null;
alter table public.farm_settings alter column id set not null;
alter table public.farm_settings drop constraint farm_settings_pkey;
alter table public.farm_settings add primary key (id);
alter table public.farm_settings add constraint farm_settings_id_owner_unique unique (id, owner_id);
alter table public.farm_settings add column production_type text not null default 'doble'
  check (production_type in ('leche', 'engorde', 'doble'));
alter table public.farm_settings add column breeds text[] not null default '{}';
alter table public.farm_settings add column latitude double precision check (latitude between -90 and 90);
alter table public.farm_settings add column longitude double precision check (longitude between -180 and 180);
alter table public.farm_settings add constraint farm_location_pair check ((latitude is null) = (longitude is null));

-- También cubre cuentas antiguas con animales pero sin configuración creada.
insert into public.farm_settings (owner_id, name, polygon)
select owner_id, 'Mi finca', '[]'::jsonb from (
  select owner_id from public.animals union select owner_id from public.devices
  union select owner_id from public.events union select owner_id from public.telemetry
  union select owner_id from public.alert_acknowledgements
  union select owner_id from public.tracking_mode
  union select owner_id from public.module_registry
  union select owner_id from public.gateway_credentials
) owners where not exists (select 1 from public.farm_settings f where f.owner_id = owners.owner_id);

do $$ declare t text; begin
  foreach t in array array['animals','devices','events','telemetry','alert_acknowledgements',
                          'tracking_mode','module_registry','gateway_credentials'] loop
    execute format('alter table public.%I add column farm_id uuid', t);
    execute format('update public.%I x set farm_id = (select f.id from public.farm_settings f where f.owner_id = x.owner_id limit 1)', t);
    execute format('alter table public.%I alter column farm_id set not null', t);
    execute format('alter table public.%I add constraint %I foreign key (farm_id, owner_id) references public.farm_settings(id, owner_id) on delete cascade', t, t || '_farm_owner_fk');
    execute format('create index %I on public.%I(farm_id)', t || '_farm_id_idx', t);
  end loop;
end $$;

-- La misma identificación de arete puede usarse en fincas distintas.
drop index public.animals_owner_tag;
create unique index animals_farm_tag on public.animals(farm_id, lower(ear_tag));
alter table public.animals add constraint animals_id_farm_owner_unique unique (id, farm_id, owner_id);
alter table public.devices add constraint devices_id_animal_farm_owner_unique unique (id, animal_id, farm_id, owner_id);
alter table public.devices add constraint devices_id_farm_owner_unique unique (id, farm_id, owner_id);
alter table public.devices add constraint devices_animal_farm_fk foreign key (animal_id, farm_id, owner_id)
  references public.animals(id, farm_id, owner_id);
alter table public.events add constraint events_animal_farm_fk foreign key (animal_id, farm_id, owner_id)
  references public.animals(id, farm_id, owner_id);
alter table public.telemetry add constraint telemetry_device_farm_fk foreign key (device_id, animal_id, farm_id, owner_id)
  references public.devices(id, animal_id, farm_id, owner_id);
alter table public.module_registry add constraint modules_device_farm_fk foreign key (device_id, farm_id, owner_id)
  references public.devices(id, farm_id, owner_id);

alter table public.tracking_mode drop constraint tracking_mode_pkey;
alter table public.tracking_mode add primary key (farm_id);
alter table public.alert_acknowledgements drop constraint alert_acknowledgements_pkey;
alter table public.alert_acknowledgements add primary key (farm_id, alert_id);

create index telemetry_farm_time on public.telemetry(farm_id, recorded_at desc);
create index events_farm_date on public.events(farm_id, date desc);

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename = 'farm_settings') then
    alter publication supabase_realtime add table public.farm_settings;
  end if;
end $$;
