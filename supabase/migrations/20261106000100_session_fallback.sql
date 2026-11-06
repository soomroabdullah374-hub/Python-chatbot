-- Fallback for the silent anonymous session (DECISIONS D13).
-- When Supabase Auth's "Anonymous Sign-ins" is switched off, the browser cannot create its own
-- anonymous user. The `session` Edge Function then creates one server-side: it reserves a slot here
-- (per-IP and global limits), creates a user with throwaway credentials, signs in once, and calls
-- finish_fallback_session() to make the user exactly like a native anonymous user (no email, no
-- password, is_anonymous = true), so RLS, deletion and the 90-day purge treat it identically.
-- The browser always tries the native anonymous sign-in first; the fallback is unused once the
-- dashboard switch is on, and can be turned off with session_fallback_enabled = false.

alter table private.app_config
  add column if not exists session_fallback_enabled boolean not null default true,
  add column if not exists max_sessions_per_ip_per_hour integer not null default 10
    check (max_sessions_per_ip_per_hour between 1 and 1000),
  add column if not exists max_sessions_per_hour integer not null default 500
    check (max_sessions_per_hour between 1 and 100000);

create table if not exists private.session_ip_hourly (
  ip_bucket text not null,
  hour timestamptz not null,
  created integer not null default 0,
  primary key (ip_bucket, hour)
);

create table if not exists private.session_global_hourly (
  hour timestamptz primary key,
  created integer not null default 0
);

alter table private.session_ip_hourly enable row level security;
alter table private.session_global_hourly enable row level security;
revoke all on private.session_ip_hourly, private.session_global_hourly from public, anon, authenticated;

-- Atomically counts one new fallback session against the caller's hashed-IP bucket and the global
-- hourly cap. Returns {"status":"ok"} or an error object (private.error) the function relays.
create or replace function public.reserve_session_slot(p_ip_bucket text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg private.app_config;
  v_hour timestamptz := date_trunc('hour', now());
  v_retry integer := greatest(1, ceil(extract(epoch from (date_trunc('hour', now()) + interval '1 hour' - now())))::integer);
  v_ip integer;
  v_all integer;
begin
  select * into v_cfg from private.app_config where id;
  if not coalesce(v_cfg.session_fallback_enabled, false) then
    return private.error('SESSION_REQUIRED', 401);
  end if;
  if p_ip_bucket is not null then
    insert into private.session_ip_hourly as s (ip_bucket, hour, created) values (p_ip_bucket, v_hour, 1)
    on conflict (ip_bucket, hour) do update set created = s.created + 1
    returning s.created into v_ip;
    if v_ip > v_cfg.max_sessions_per_ip_per_hour then
      return private.error('RATE_LIMITED', 429, v_retry);
    end if;
  end if;
  insert into private.session_global_hourly as g (hour, created) values (v_hour, 1)
  on conflict (hour) do update set created = g.created + 1
  returning g.created into v_all;
  if v_all > v_cfg.max_sessions_per_hour then
    return private.error('RATE_LIMITED', 429, v_retry);
  end if;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Strips the throwaway credentials from a just-created fallback user and marks it anonymous.
-- Only users created by the session function (synthetic .invalid address) can be touched.
create or replace function public.finish_fallback_session(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_found boolean;
begin
  update auth.users
     set is_anonymous = true,
         email = null,
         encrypted_password = null,
         email_confirmed_at = null,
         raw_app_meta_data = jsonb_build_object('provider', 'anonymous', 'providers', jsonb_build_array('anonymous'))
   where id = p_user_id
     and email like '%@anon.codebloom.invalid';
  v_found := found;
  if v_found then
    delete from auth.identities where user_id = p_user_id and provider = 'email';
  end if;
  return v_found;
end;
$$;

-- Old hourly counters are only needed for the current hour.
create or replace function private.purge_old_session_counters()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from private.session_ip_hourly where hour < now() - interval '2 hours';
  get diagnostics v_count = row_count;
  delete from private.session_global_hourly where hour < now() - interval '2 days';
  return v_count;
end;
$$;

revoke all on function private.purge_old_session_counters() from public, anon, authenticated;
revoke execute on function public.reserve_session_slot(text), public.finish_fallback_session(uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_session_slot(text), public.finish_fallback_session(uuid)
  to service_role;

select cron.schedule('codebloom-purge-session-counters', '41 * * * *', $$select private.purge_old_session_counters()$$);
