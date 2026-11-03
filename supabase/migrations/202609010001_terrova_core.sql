-- Schéma métier Terrova pour Supabase Postgres.
-- Les sessions et identités restent gérées par Supabase Auth.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nouveau projet',
  property_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null default 'starter',
  balance integer not null default 120 check (balance >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  entry_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('reservation', 'consumption', 'release', 'purchase', 'grant')),
  amount integer not null,
  reference_id text not null,
  created_at timestamptz not null default now(),
  unique (entry_type, reference_id)
);

create table if not exists public.generation_jobs (
  job_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  provider text not null,
  status text not null,
  input_json jsonb not null,
  output_key text,
  provider_job_id text,
  provider_status_url text,
  credit_cost integer,
  credit_reservation_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists generation_jobs_user_id_idx on public.generation_jobs(user_id);
create index if not exists generation_jobs_status_idx on public.generation_jobs(status);
create index if not exists credit_ledger_user_id_idx on public.credit_ledger(user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
    updated_at = now();

  insert into public.credit_wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Rattrapage pour les comptes créés avant l’installation de cette migration.
insert into public.profiles (id, email, full_name, avatar_url)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
  raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;

insert into public.credit_wallets (user_id)
select id from auth.users
on conflict (user_id) do nothing;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.credit_wallets enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.generation_jobs enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists projects_own on public.projects;
create policy projects_own on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists credit_wallets_own on public.credit_wallets;
create policy credit_wallets_own on public.credit_wallets
  for select using (auth.uid() = user_id);

drop policy if exists credit_ledger_own on public.credit_ledger;
create policy credit_ledger_own on public.credit_ledger
  for select using (auth.uid() = user_id);

drop policy if exists generation_jobs_own on public.generation_jobs;
create policy generation_jobs_own on public.generation_jobs
  for select using (auth.uid() = user_id);
