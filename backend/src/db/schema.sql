-- GymPad — Supabase schema.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).
--
-- Design notes:
--  • `profiles` extends Supabase's built-in `auth.users` 1:1. We never store
--    passwords or emails here — Supabase Auth owns identity. A row is created on
--    first login (see the trigger at the bottom).
--  • Row-Level Security is ON for every table, and every policy is scoped to
--    `auth.uid()`. A user can only ever touch their own rows. This is the whole
--    security model — the API also checks the JWT, but even a leaked service
--    call cannot cross users because the policies are enforced in Postgres.
--  • The AI-facing tables (`intakes`, `plans`) store the raw model output as
--    JSONB so the plan structure can evolve without a migration.

-- ─── Profiles (extends auth.users) ───────────────────────────────────────────
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  lang text default 'en' check (lang in ('en', 'am')),
  created_at timestamptz default now()
);

-- ─── Health intake (one row per plan request) ────────────────────────────────
create table if not exists public.intakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  goal text not null check (goal in ('loss', 'build')),
  duration_weeks int not null check (duration_weeks in (1, 4, 12, 26, 52)),
  age int check (age between 13 and 90),
  weight_kg numeric,
  height_cm numeric,
  biological_sex text check (biological_sex in ('male', 'female', 'prefer_not')),
  fitness_level text check (fitness_level in ('beginner', 'intermediate', 'advanced')),
  conditions text[] default '{}',
  medications text,
  injuries text,
  available_equipment text[] default '{}',
  sessions_per_week int check (sessions_per_week between 2 and 6),
  session_duration_min int,
  additional_notes text,
  -- Filled by the AI screening step.
  ai_clearance text check (ai_clearance in ('clear', 'modify', 'defer')),
  ai_clearance_notes text,
  bmi numeric,
  bmi_category text,
  created_at timestamptz default now()
);

-- ─── AI-generated plans ──────────────────────────────────────────────────────
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  intake_id uuid references public.intakes(id) on delete set null,
  goal text not null,
  duration_weeks int not null,
  recommended_split text,
  phases jsonb not null,          -- array of phase objects (see planEngine.js)
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ─── Logged workout sessions ─────────────────────────────────────────────────
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  plan_id uuid references public.plans(id) on delete set null,
  phase_index int default 0,
  week_number int,
  day_label text,
  duration_min int,
  exercises_completed jsonb default '[]',   -- [{id, sets_done, reps_or_time}]
  notes text,
  logged_at timestamptz default now()
);

-- Indexes for the read patterns we actually have: "my plans", "my recent sessions".
create index if not exists idx_plans_user_active on public.plans (user_id, is_active);
create index if not exists idx_sessions_user_time on public.sessions (user_id, logged_at desc);
create index if not exists idx_intakes_user_time on public.intakes (user_id, created_at desc);

-- ─── Row-Level Security ──────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.intakes  enable row level security;
alter table public.plans    enable row level security;
alter table public.sessions enable row level security;

-- Drop-and-recreate so this file is safe to re-run.
drop policy if exists "own profile"  on public.profiles;
drop policy if exists "own intakes"  on public.intakes;
drop policy if exists "own plans"    on public.plans;
drop policy if exists "own sessions" on public.sessions;

create policy "own profile"  on public.profiles for all using (auth.uid() = id)      with check (auth.uid() = id);
create policy "own intakes"  on public.intakes  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own plans"    on public.plans    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own sessions" on public.sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Auto-create a profile row on signup ─────────────────────────────────────
-- Without this, a brand-new user has an auth.users row but no profile, and every
-- foreign key into profiles fails on their first action.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
