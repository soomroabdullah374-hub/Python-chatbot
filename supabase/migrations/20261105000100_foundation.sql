-- CodeBloom — foundation: extensions, private schema, privilege hardening, runtime config.
-- Learners are Supabase *anonymous* auth users (role `authenticated`, claim is_anonymous=true).
-- There is no login of any kind (IDENTITY.md).

create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;

-- `private` is never exposed through the Data API. Service-only tables and helpers live here.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- Supabase grants new public tables/functions to anon + authenticated by default.
-- CodeBloom grants every privilege explicitly instead (DATABASE.md "Access matrix").
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- The `http` extension is used only by operators (smoke tests, ingestion trigger) from SQL.
-- Make sure no API role can execute it (only its own functions; pgvector etc. stay usable).
create extension if not exists http with schema extensions;
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_depend d on d.objid = p.oid and d.classid = 'pg_proc'::regclass and d.deptype = 'e'
    join pg_extension e on e.oid = d.refobjid and e.extname = 'http'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- Runtime policy, editable by operators without a redeploy (kill switch, limits, CORS origins).
create table private.app_config (
  id boolean primary key default true check (id),
  generation_enabled boolean not null default true,
  max_turns_per_minute integer not null default 10 check (max_turns_per_minute > 0),
  max_turns_per_day integer not null default 100 check (max_turns_per_day > 0),
  max_turns_per_ip_per_day integer not null default 300 check (max_turns_per_ip_per_day > 0),
  global_max_turns_per_day integer not null default 3000 check (global_max_turns_per_day > 0),
  global_daily_budget_usd numeric(10, 2) not null default 5.00 check (global_daily_budget_usd >= 0),
  generation_lease_seconds integer not null default 120 check (generation_lease_seconds between 30 and 600),
  anon_retention_days integer not null default 90 check (anon_retention_days between 1 and 3650),
  allowed_origins text[] not null default array['http://localhost:3000'],
  -- USD per million tokens, used only for the spend breaker estimate.
  model_prices jsonb not null default '{
    "openai/gpt-oss-120b": {"input": 0.15, "output": 0.75},
    "openai/gpt-oss-20b": {"input": 0.10, "output": 0.50},
    "grok-4-fast-non-reasoning": {"input": 0.20, "output": 0.50}
  }'::jsonb,
  updated_at timestamptz not null default now()
);
insert into private.app_config default values;
alter table private.app_config enable row level security;
revoke all on private.app_config from public, anon, authenticated;

-- Generic updated_at trigger.
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
