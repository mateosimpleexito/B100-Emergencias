-- B100-Emergencias — Supabase Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text not null,
  badge       text unique,
  role        text not null default 'bombero' check (role in ('bombero', 'admin')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Bomberos only see their own profile; admins see all
create policy "Own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Admin all profiles" on public.profiles
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ─────────────────────────────────────────
-- INCIDENTS
-- ─────────────────────────────────────────
create table public.incidents (
  id              uuid primary key default gen_random_uuid(),
  nro_parte       text unique not null,
  type            text not null,
  address         text not null,
  district        text,
  lat             float8,
  lng             float8,
  status          text not null default 'ATENDIENDO'
                    check (status in ('ATENDIENDO', 'CERRADO')),
  dispatched_at   timestamptz not null,
  units           text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Index for fast lookup of recent/active incidents
create index incidents_dispatched_at_idx on public.incidents (dispatched_at desc);
create index incidents_status_idx on public.incidents (status);

alter table public.incidents enable row level security;

-- All authenticated users can read incidents
create policy "Authenticated read incidents" on public.incidents
  for select using (auth.role() = 'authenticated');

-- Only service role can insert/update (scraper uses service key)
create policy "Service role write incidents" on public.incidents
  for all using (auth.role() = 'service_role');

-- ─────────────────────────────────────────
-- PUSH SUBSCRIPTIONS
-- ─────────────────────────────────────────
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade,
  endpoint    text unique not null,
  p256dh      text not null,
  auth        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Users manage their own subscriptions
create policy "Own subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id);

-- Service role reads all (for sending push notifications)
create policy "Service role read subs" on public.push_subscriptions
  for select using (auth.role() = 'service_role');

-- ─────────────────────────────────────────
-- AUTO-UPDATE updated_at on incidents
-- ─────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger incidents_updated_at
  before update on public.incidents
  for each row execute function public.handle_updated_at();

-- ─────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────
-- Enable realtime on incidents so the frontend receives live updates
alter publication supabase_realtime add table public.incidents;
