create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    full_name text check (full_name is null or length(btrim(full_name)) between 1 and 200),
    email text unique,
    user_type text not null default 'farmer' check (length(btrim(user_type)) between 1 and 50),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.farms (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id) on delete cascade,
    farm_name text not null check (length(btrim(farm_name)) between 1 and 200),
    latitude double precision not null check (latitude between -90 and 90),
    longitude double precision not null check (longitude between -180 and 180),
    location text check (location is null or length(location) <= 500),
    farm_size_hectares numeric(12, 2) check (
        farm_size_hectares is null
        or (farm_size_hectares >= 0 and farm_size_hectares <> 'NaN'::numeric)
    ),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.climate_observations (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    source text not null check (length(btrim(source)) between 1 and 100),
    parameter text not null check (length(btrim(parameter)) between 1 and 100),
    value double precision not null check (
        value > '-Infinity'::double precision
        and value < 'Infinity'::double precision
    ),
    unit text check (unit is null or length(unit) <= 50),
    observation_date date not null,
    latitude double precision not null check (latitude between -90 and 90),
    longitude double precision not null check (longitude between -180 and 180),
    created_at timestamptz not null default now(),
    constraint climate_observations_source_parameter_date_key
        unique (farm_id, source, parameter, observation_date)
);

create table public.crop_catalog (
    id uuid primary key default gen_random_uuid(),
    crop_name text not null unique check (length(btrim(crop_name)) between 1 and 200),
    scientific_name text check (scientific_name is null or length(scientific_name) <= 200),
    crop_category text check (crop_category is null or length(crop_category) <= 100),
    description text
);

create table public.crop_recommendations (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    crop_id uuid not null references public.crop_catalog (id) on delete restrict,
    recommendation_reason text not null check (length(btrim(recommendation_reason)) > 0),
    confidence_level numeric(5, 4) check (confidence_level is null or confidence_level between 0 and 1),
    created_at timestamptz not null default now()
);

create table public.crop_rotation_plans (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    previous_crop text check (previous_crop is null or length(btrim(previous_crop)) > 0),
    recommended_crop text not null check (length(btrim(recommended_crop)) > 0),
    planting_year integer not null check (planting_year between 1900 and 2200),
    explanation text,
    created_at timestamptz not null default now()
);

create index farms_owner_created_idx on public.farms (owner_id, created_at desc);
create index climate_observations_farm_date_idx
    on public.climate_observations (farm_id, observation_date desc);
create index climate_observations_farm_parameter_date_idx
    on public.climate_observations (farm_id, parameter, observation_date desc);
create index crop_recommendations_farm_created_idx
    on public.crop_recommendations (farm_id, created_at desc);
create index crop_rotation_plans_farm_year_idx
    on public.crop_rotation_plans (farm_id, planting_year desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger farms_set_updated_at
before update on public.farms
for each row execute function public.set_updated_at();

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
    insert into public.profiles (id, full_name, email)
    values (
        new.id,
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        new.email
    )
    on conflict (id) do update
    set email = excluded.email;
    return new;
end;
$$;

create trigger on_auth_user_created_or_email_updated
after insert or update of email on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles (id, full_name, email, created_at, updated_at)
select
    id,
    nullif(btrim(raw_user_meta_data ->> 'full_name'), ''),
    email,
    coalesce(created_at, now()),
    coalesce(updated_at, created_at, now())
from auth.users
on conflict (id) do nothing;

revoke all on function public.set_updated_at() from public, anon, authenticated, service_role;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.farms enable row level security;
alter table public.climate_observations enable row level security;
alter table public.crop_catalog enable row level security;
alter table public.crop_recommendations enable row level security;
alter table public.crop_rotation_plans enable row level security;

revoke all on table
    public.profiles,
    public.farms,
    public.climate_observations,
    public.crop_catalog,
    public.crop_recommendations,
    public.crop_rotation_plans
from public, anon, authenticated, service_role;

grant select on public.profiles to authenticated;
grant select on public.profiles to service_role;
grant update (full_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.farms to authenticated;
grant select, insert, update, delete on public.climate_observations to authenticated;
grant select on public.crop_catalog to authenticated;
grant select, insert, update, delete on public.crop_recommendations to authenticated;
grant select, insert, update, delete on public.crop_rotation_plans to authenticated;

create policy "Users can read their own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their own profile name"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Farm owners can read their farms"
on public.farms for select to authenticated
using ((select auth.uid()) = owner_id);

create policy "Farm owners can create their farms"
on public.farms for insert to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Farm owners can update their farms"
on public.farms for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Farm owners can delete their farms"
on public.farms for delete to authenticated
using ((select auth.uid()) = owner_id);

create policy "Authenticated users can read the crop catalog"
on public.crop_catalog for select to authenticated
using ((select auth.uid()) is not null);

create policy "Farm owners can read climate observations"
on public.climate_observations for select to authenticated
using (
    exists (
        select 1 from public.farms
        where farms.id = climate_observations.farm_id
          and farms.owner_id = (select auth.uid())
    )
);

create policy "Farm owners can add climate observations"
on public.climate_observations for insert to authenticated
with check (
    exists (
        select 1 from public.farms
        where farms.id = climate_observations.farm_id
          and farms.owner_id = (select auth.uid())
    )
);

create policy "Farm owners can update climate observations"
on public.climate_observations for update to authenticated
using (
    exists (
        select 1 from public.farms
        where farms.id = climate_observations.farm_id
          and farms.owner_id = (select auth.uid())
    )
)
with check (
    exists (
        select 1 from public.farms
        where farms.id = climate_observations.farm_id
          and farms.owner_id = (select auth.uid())
    )
);

create policy "Farm owners can delete climate observations"
on public.climate_observations for delete to authenticated
using (
    exists (
        select 1 from public.farms
        where farms.id = climate_observations.farm_id
          and farms.owner_id = (select auth.uid())
    )
);

create policy "Farm owners can read crop recommendations"
on public.crop_recommendations for select to authenticated
using (
    exists (
        select 1 from public.farms
        where farms.id = crop_recommendations.farm_id
          and farms.owner_id = (select auth.uid())
    )
);

create policy "Farm owners can add crop recommendations"
on public.crop_recommendations for insert to authenticated
with check (
    exists (
        select 1 from public.farms
        where farms.id = crop_recommendations.farm_id
          and farms.owner_id = (select auth.uid())
    )
);

create policy "Farm owners can update crop recommendations"
on public.crop_recommendations for update to authenticated
using (
    exists (
        select 1 from public.farms
        where farms.id = crop_recommendations.farm_id
          and farms.owner_id = (select auth.uid())
    )
)
with check (
    exists (
        select 1 from public.farms
        where farms.id = crop_recommendations.farm_id
          and farms.owner_id = (select auth.uid())
    )
);

create policy "Farm owners can delete crop recommendations"
on public.crop_recommendations for delete to authenticated
using (
    exists (
        select 1 from public.farms
        where farms.id = crop_recommendations.farm_id
          and farms.owner_id = (select auth.uid())
    )
);

create policy "Farm owners can read crop rotation plans"
on public.crop_rotation_plans for select to authenticated
using (
    exists (
        select 1 from public.farms
        where farms.id = crop_rotation_plans.farm_id
          and farms.owner_id = (select auth.uid())
    )
);

create policy "Farm owners can add crop rotation plans"
on public.crop_rotation_plans for insert to authenticated
with check (
    exists (
        select 1 from public.farms
        where farms.id = crop_rotation_plans.farm_id
          and farms.owner_id = (select auth.uid())
    )
);

create policy "Farm owners can update crop rotation plans"
on public.crop_rotation_plans for update to authenticated
using (
    exists (
        select 1 from public.farms
        where farms.id = crop_rotation_plans.farm_id
          and farms.owner_id = (select auth.uid())
    )
)
with check (
    exists (
        select 1 from public.farms
        where farms.id = crop_rotation_plans.farm_id
          and farms.owner_id = (select auth.uid())
    )
);

create policy "Farm owners can delete crop rotation plans"
on public.crop_rotation_plans for delete to authenticated
using (
    exists (
        select 1 from public.farms
        where farms.id = crop_rotation_plans.farm_id
          and farms.owner_id = (select auth.uid())
    )
);
