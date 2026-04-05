-- ============================================================
-- Browser Use — Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. user_settings
create table public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  default_model text not null default 'gemini-2.5-flash',
  max_steps integer not null default 25,
  use_vision boolean not null default true,
  headless boolean not null default false,
  max_actions_per_step integer not null default 5,
  default_timeout integer not null default 300,
  google_api_key text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

alter table public.user_settings enable row level security;
create policy "Users can view own settings" on public.user_settings for select using (auth.uid() = user_id);
create policy "Users can insert own settings" on public.user_settings for insert with check (auth.uid() = user_id);
create policy "Users can update own settings" on public.user_settings for update using (auth.uid() = user_id);

-- 2. sessions
create table public.sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task text not null,
  status text not null default 'running',
  result text,
  error text,
  files text[] default '{}',
  model text,
  steps_count integer not null default 0,
  duration real not null default 0,
  created_at timestamptz not null default now()
);

alter table public.sessions enable row level security;
create policy "Users can view own sessions" on public.sessions for select using (auth.uid() = user_id);
create policy "Users can insert own sessions" on public.sessions for insert with check (auth.uid() = user_id);
create policy "Users can update own sessions" on public.sessions for update using (auth.uid() = user_id);
create policy "Users can delete own sessions" on public.sessions for delete using (auth.uid() = user_id);

-- 3. session_steps
create table public.session_steps (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  step_number integer not null,
  thinking text default '',
  evaluation text default '',
  memory text default '',
  next_goal text default '',
  actions text[] default '{}',
  screenshot text,
  created_at timestamptz not null default now()
);

create index idx_session_steps_session on public.session_steps(session_id);

alter table public.session_steps enable row level security;
create policy "Users can view own steps" on public.session_steps for select using (auth.uid() = user_id);
create policy "Users can insert own steps" on public.session_steps for insert with check (auth.uid() = user_id);

-- 4. skills
create table public.skills (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text default '',
  prompt text not null,
  created_at timestamptz not null default now()
);

alter table public.skills enable row level security;
create policy "Users can view own skills" on public.skills for select using (auth.uid() = user_id);
create policy "Users can insert own skills" on public.skills for insert with check (auth.uid() = user_id);
create policy "Users can delete own skills" on public.skills for delete using (auth.uid() = user_id);

-- 5. scheduled_jobs
create table public.scheduled_jobs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  task text not null,
  cron text not null,
  enabled boolean not null default true,
  last_run timestamptz,
  created_at timestamptz not null default now()
);

alter table public.scheduled_jobs enable row level security;
create policy "Users can view own jobs" on public.scheduled_jobs for select using (auth.uid() = user_id);
create policy "Users can insert own jobs" on public.scheduled_jobs for insert with check (auth.uid() = user_id);
create policy "Users can update own jobs" on public.scheduled_jobs for update using (auth.uid() = user_id);
create policy "Users can delete own jobs" on public.scheduled_jobs for delete using (auth.uid() = user_id);

-- 6. remote_browsers
create table public.remote_browsers (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  ws_url text not null,
  status text default 'unknown',
  created_at timestamptz not null default now()
);

alter table public.remote_browsers enable row level security;
create policy "Users can view own browsers" on public.remote_browsers for select using (auth.uid() = user_id);
create policy "Users can insert own browsers" on public.remote_browsers for insert with check (auth.uid() = user_id);
create policy "Users can update own browsers" on public.remote_browsers for update using (auth.uid() = user_id);
create policy "Users can delete own browsers" on public.remote_browsers for delete using (auth.uid() = user_id);

-- Auto-create user_settings on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
