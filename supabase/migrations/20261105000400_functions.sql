-- CodeBloom — database functions.
--   private.*                 helpers, never exposed
--   service-only public RPCs  called by Edge Functions with the service role (EXECUTE revoked from learners)
--   learner public RPCs       SECURITY DEFINER, identity from auth.uid(), ownership re-checked in every statement
-- Errors raised to learners use SQLSTATE 'PTxyz' so the Data API answers with HTTP status xyz.

---------------------------------------------------------------------------------------------------
-- Identity: profile row for every new (anonymous) auth user
---------------------------------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

---------------------------------------------------------------------------------------------------
-- Helpers
---------------------------------------------------------------------------------------------------
create or replace function private.derive_title(p_message text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  t text;
  q integer;
begin
  t := coalesce(p_message, '');
  t := regexp_replace(t, '```[^\n]*', E'\n', 'g');
  select line into t
  from regexp_split_to_table(t, E'\n') with ordinality as s(line, n)
  where btrim(line) <> ''
  order by n
  limit 1;
  t := btrim(regexp_replace(regexp_replace(coalesce(t, ''), '[`*_#>]', '', 'g'), '\s+', ' ', 'g'));
  q := position('?' in t);
  if q between 12 and 80 then
    t := left(t, q);
  end if;
  if char_length(t) > 60 then
    t := regexp_replace(left(t, 60), '\s+\S*$', '') || '…';
  end if;
  if t = '' or t = '…' then
    t := 'New chat';
  end if;
  return t;
end;
$$;

-- Completed turns only, newest first within budget, returned oldest first.
create or replace function private.conversation_history(
  p_conversation_id uuid,
  p_exclude_turn uuid,
  p_max_messages integer,
  p_max_chars integer
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with recent as (
    select m.id, m.role, m.content, m.mode, m.created_at
    from public.messages m
    join public.generation_requests g on g.id = m.generation_request_id
    where m.conversation_id = p_conversation_id
      and g.id <> p_exclude_turn
      and g.status = 'completed'
      and m.status = 'completed'
    order by m.created_at desc, m.id desc
    limit p_max_messages
  ),
  budgeted as (
    select r.*, sum(char_length(r.content)) over (order by r.created_at desc, r.id desc) as running
    from recent r
  )
  select coalesce(
    jsonb_agg(jsonb_build_object('role', role, 'content', content, 'mode', mode) order by created_at, id),
    '[]'::jsonb)
  from budgeted
  where running <= p_max_chars;
$$;

-- Expired leases become `incomplete`; their placeholder answers stop "streaming".
create or replace function private.reconcile_turns(p_user_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.generation_requests g
       set status = 'incomplete',
           error_code = coalesce(g.error_code, 'LEASE_EXPIRED'),
           completed_at = now()
     where g.status in ('accepted', 'retrieving', 'streaming')
       and g.lease_expires_at < now()
       and (p_user_id is null or g.user_id = p_user_id)
    returning g.id
  )
  update public.messages m
     set status = 'incomplete', updated_at = now()
    from expired e
   where m.generation_request_id = e.id
     and m.role = 'assistant'
     and m.status = 'streaming';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function private.error(p_code text, p_http integer, p_retry_after integer default null)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'status', 'error', 'code', p_code, 'http', p_http, 'retry_after', p_retry_after));
$$;

---------------------------------------------------------------------------------------------------
-- Service-only: runtime config + server secrets for Edge Functions
---------------------------------------------------------------------------------------------------
create or replace function public.get_runtime_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'generation_enabled', c.generation_enabled,
    'allowed_origins', to_jsonb(c.allowed_origins),
    'secrets', jsonb_build_object(
      'groq_api_key', (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'groq_api_key' order by s.created_at desc limit 1),
      'xai_api_key', (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'xai_api_key' order by s.created_at desc limit 1),
      'ip_hash_salt', (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'ip_hash_salt' order by s.created_at desc limit 1)
    )
  )
  from private.app_config c
  where c.id;
$$;

create or replace function public.verify_operator_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select extensions.digest(coalesce(p_token, ''), 'sha256') = extensions.digest(s.decrypted_secret, 'sha256')
     from vault.decrypted_secrets s
     where s.name = 'operator_token'
     order by s.created_at desc
     limit 1),
    false)
  and char_length(coalesce(p_token, '')) >= 32;
$$;

---------------------------------------------------------------------------------------------------
-- Service-only: atomic turn reservation (DATABASE.md "Atomic turn reservation")
---------------------------------------------------------------------------------------------------
create or replace function public.reserve_turn(
  p_user_id uuid,
  p_conversation_id uuid,
  p_idempotency_key uuid,
  p_request_hash text,
  p_message text,
  p_mode text,
  p_language text,
  p_ip_bucket text,
  p_prompt_version text,
  p_model text,
  p_provider text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg private.app_config;
  v_existing public.generation_requests;
  v_conv public.conversations;
  v_profile public.profiles;
  v_global private.usage_global_daily;
  v_today date := (now() at time zone 'utc')::date;
  v_recent integer;
  v_oldest timestamptz;
  v_daily integer;
  v_ip integer;
  v_turn uuid;
  v_user_msg uuid;
  v_asst_msg uuid;
  v_until_midnight integer;
begin
  if p_mode is null or p_mode not in ('explain', 'debug', 'practice')
     or p_language is null or p_language not in ('python', 'javascript', 'typescript', 'sql', 'html_css')
     or p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$'
     or p_idempotency_key is null or p_user_id is null
     or (p_ip_bucket is not null and p_ip_bucket !~ '^[0-9a-f]{64}$') then
    return private.error('INVALID_REQUEST', 400);
  end if;
  if char_length(btrim(coalesce(p_message, ''))) = 0 then
    return private.error('INVALID_REQUEST', 400);
  end if;
  if char_length(p_message) > 12000 then
    return private.error('INPUT_TOO_LARGE', 413);
  end if;

  select * into cfg from private.app_config where id;

  -- Serialise reservations per learner.
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    return private.error('SESSION_REQUIRED', 401);
  end if;
  if exists (select 1 from private.data_deletion_jobs j
             where j.user_id = p_user_id and j.status in ('requested', 'running')) then
    return private.error('SESSION_REQUIRED', 401);
  end if;

  -- Idempotency (API.md table).
  select * into v_existing
  from public.generation_requests
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then
      return private.error('IDEMPOTENCY_MISMATCH', 409);
    end if;
    if v_existing.status in ('accepted', 'retrieving', 'streaming') and v_existing.lease_expires_at >= now() then
      return private.error('TURN_IN_PROGRESS', 409) || jsonb_build_object('turn_id', v_existing.id);
    end if;
    perform private.reconcile_turns(p_user_id);
    return jsonb_build_object(
      'status', 'replay',
      'turn_id', v_existing.id,
      'turn_status', (select g.status from public.generation_requests g where g.id = v_existing.id),
      'conversation_id', v_existing.conversation_id,
      'assistant_message', (
        select jsonb_build_object('id', m.id, 'content', m.content, 'status', m.status,
                                  'mode', m.mode, 'language', m.language)
        from public.messages m
        where m.generation_request_id = v_existing.id and m.role = 'assistant'),
      'sources', coalesce((
        select jsonb_agg(jsonb_build_object('label', s.citation_label, 'title', s.document_title,
                                            'url', s.source_url, 'section', s.section)
                         order by s.citation_label)
        from public.message_sources s
        join public.messages m on m.id = s.message_id
        where m.generation_request_id = v_existing.id), '[]'::jsonb),
      'usage', jsonb_build_object('input_tokens', v_existing.input_tokens, 'output_tokens', v_existing.output_tokens)
    );
  end if;

  perform private.reconcile_turns(p_user_id);

  if not cfg.generation_enabled then
    return private.error('GENERATION_PAUSED', 503, 300);
  end if;

  if p_conversation_id is not null then
    select * into v_conv from public.conversations
    where id = p_conversation_id and user_id = p_user_id;
    if not found then
      return private.error('NOT_FOUND', 404);
    end if;
  end if;

  if exists (select 1 from public.generation_requests g
             where g.user_id = p_user_id and g.status in ('accepted', 'retrieving', 'streaming')) then
    return private.error('TURN_IN_PROGRESS', 409);
  end if;

  select count(*), min(created_at) into v_recent, v_oldest
  from public.generation_requests
  where user_id = p_user_id and created_at > now() - interval '60 seconds';
  if v_recent >= cfg.max_turns_per_minute then
    return private.error('RATE_LIMITED', 429,
      greatest(1, ceil(60 - extract(epoch from (now() - v_oldest))))::integer);
  end if;

  v_until_midnight := ceil(extract(epoch from
    ((date_trunc('day', now() at time zone 'utc') + interval '1 day') - (now() at time zone 'utc'))))::integer;

  select accepted_turns into v_daily from public.usage_daily
  where user_id = p_user_id and usage_date = v_today;
  if coalesce(v_daily, 0) >= cfg.max_turns_per_day then
    return private.error('DAILY_LIMIT_REACHED', 429, v_until_midnight);
  end if;

  if p_ip_bucket is not null then
    insert into private.usage_ip_daily (ip_bucket, usage_date) values (p_ip_bucket, v_today)
    on conflict do nothing;
    select accepted_turns into v_ip from private.usage_ip_daily
    where ip_bucket = p_ip_bucket and usage_date = v_today
    for update;
    if v_ip >= cfg.max_turns_per_ip_per_day then
      return private.error('NETWORK_LIMIT_REACHED', 429, v_until_midnight);
    end if;
  end if;

  insert into private.usage_global_daily (usage_date) values (v_today) on conflict do nothing;
  select * into v_global from private.usage_global_daily where usage_date = v_today for update;
  if v_global.accepted_turns >= cfg.global_max_turns_per_day
     or v_global.estimated_cost >= cfg.global_daily_budget_usd then
    return private.error('BUDGET_PAUSED', 503, v_until_midnight);
  end if;

  if v_conv.id is null then
    insert into public.conversations (user_id, title, language, mode)
    values (p_user_id, private.derive_title(p_message), p_language, p_mode)
    returning * into v_conv;
  else
    update public.conversations
       set updated_at = now(), mode = p_mode, language = p_language
     where id = v_conv.id;
  end if;

  insert into public.generation_requests (
    user_id, conversation_id, idempotency_key, request_hash, status, mode, language,
    lease_expires_at, provider, prompt_version, model, ip_bucket)
  values (
    p_user_id, v_conv.id, p_idempotency_key, p_request_hash, 'accepted', p_mode, p_language,
    now() + make_interval(secs => cfg.generation_lease_seconds), p_provider, p_prompt_version, p_model, p_ip_bucket)
  returning id into v_turn;

  insert into public.messages (user_id, conversation_id, generation_request_id, role, content, status, mode, language)
  values (p_user_id, v_conv.id, v_turn, 'user', p_message, 'completed', p_mode, p_language)
  returning id into v_user_msg;

  insert into public.messages (user_id, conversation_id, generation_request_id, role, content, status, mode, language)
  values (p_user_id, v_conv.id, v_turn, 'assistant', '', 'streaming', p_mode, p_language)
  returning id into v_asst_msg;

  insert into public.usage_daily (user_id, usage_date, accepted_turns) values (p_user_id, v_today, 1)
  on conflict (user_id, usage_date) do update set accepted_turns = public.usage_daily.accepted_turns + 1;
  if p_ip_bucket is not null then
    update private.usage_ip_daily set accepted_turns = accepted_turns + 1
    where ip_bucket = p_ip_bucket and usage_date = v_today;
  end if;
  update private.usage_global_daily set accepted_turns = accepted_turns + 1 where usage_date = v_today;
  update public.profiles set last_active_at = now() where id = p_user_id;

  return jsonb_build_object(
    'status', 'reserved',
    'turn_id', v_turn,
    'conversation_id', v_conv.id,
    'conversation_title', v_conv.title,
    'user_message_id', v_user_msg,
    'assistant_message_id', v_asst_msg,
    'lease_seconds', cfg.generation_lease_seconds,
    'history', private.conversation_history(v_conv.id, v_turn, 16, 12000),
    'preferences', jsonb_build_object(
      'preferred_language', v_profile.preferred_language,
      'explanation_language', v_profile.explanation_language,
      'experience_level', v_profile.experience_level,
      'explanation_depth', v_profile.explanation_depth)
  );
end;
$$;

-- Lifecycle progress + cancellation probe used while a turn streams.
create or replace function public.turn_heartbeat(p_turn_id uuid, p_status text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if p_status is not null and p_status not in ('retrieving', 'streaming') then
    return private.error('INVALID_REQUEST', 400);
  end if;
  if p_status is not null then
    update public.generation_requests
       set status = p_status
     where id = p_turn_id
       and status in ('accepted', 'retrieving', 'streaming')
       and status <> p_status;
  end if;
  select g.status, g.cancel_requested_at into r from public.generation_requests g where g.id = p_turn_id;
  if not found then
    return jsonb_build_object('exists', false, 'cancel', true);
  end if;
  return jsonb_build_object(
    'exists', true,
    'status', r.status,
    'cancel', r.cancel_requested_at is not null or r.status not in ('accepted', 'retrieving', 'streaming'));
end;
$$;

-- Durable finalisation (DATABASE.md "Finalization"). Never resurrects deleted conversations.
create or replace function public.finalize_turn(
  p_turn_id uuid,
  p_status text,
  p_content text,
  p_sources jsonb,
  p_input_tokens integer,
  p_output_tokens integer,
  p_reasoning_tokens integer,
  p_model text,
  p_provider_request_id text,
  p_error_code text,
  p_retrieval_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.generation_requests;
  v_final text := p_status;
  v_content text := coalesce(p_content, '');
  v_error text := p_error_code;
  v_price jsonb;
  v_cost numeric(12, 6);
  v_msg uuid;
  v_day date;
begin
  if p_status is null or p_status not in ('completed', 'failed', 'interrupted', 'incomplete') then
    return private.error('INVALID_REQUEST', 400);
  end if;

  select * into r from public.generation_requests where id = p_turn_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if r.status not in ('accepted', 'retrieving', 'streaming') then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_FINAL', 'status', r.status);
  end if;

  if v_final = 'completed' and r.cancel_requested_at is not null then
    v_final := 'interrupted';
    v_error := coalesce(v_error, 'CANCELLED');
  end if;
  if char_length(v_content) > 40000 then
    v_content := left(v_content, 40000);
    if v_final = 'completed' then
      v_final := 'incomplete';
      v_error := coalesce(v_error, 'OUTPUT_TOO_LARGE');
    end if;
  end if;
  if v_final = 'completed' and char_length(btrim(v_content)) = 0 then
    v_final := 'failed';
    v_error := coalesce(v_error, 'EMPTY_ANSWER');
  end if;

  select c.model_prices -> coalesce(p_model, r.model) into v_price from private.app_config c where c.id;
  v_cost := (coalesce(p_input_tokens, 0) * coalesce((v_price ->> 'input')::numeric, 0)
           + (coalesce(p_output_tokens, 0) + coalesce(p_reasoning_tokens, 0)) * coalesce((v_price ->> 'output')::numeric, 0))
           / 1000000;

  update public.messages
     set content = v_content, status = v_final, updated_at = now()
   where generation_request_id = p_turn_id and role = 'assistant'
  returning id into v_msg;

  if v_final = 'completed' and jsonb_typeof(p_sources) = 'array' then
    insert into public.message_sources (message_id, citation_label, chunk_id, document_title, source_url, section, document_version)
    select v_msg, s.label, c.id, d.title, d.source_url, d.section, d.source_version
    from jsonb_to_recordset(p_sources) as s(label text, chunk_id uuid)
    join public.document_chunks c on c.id = s.chunk_id
    join public.documents d on d.id = c.document_id and d.status = 'published'
    where s.label ~ '^S[1-9][0-9]?$'
    on conflict do nothing;
  end if;

  update public.generation_requests
     set status = v_final,
         completed_at = now(),
         input_tokens = p_input_tokens,
         output_tokens = p_output_tokens,
         reasoning_tokens = p_reasoning_tokens,
         cost_amount = v_cost,
         model = coalesce(p_model, model),
         provider_request_id = p_provider_request_id,
         error_code = v_error,
         retrieval_count = p_retrieval_count
   where id = p_turn_id;

  v_day := (r.created_at at time zone 'utc')::date;
  update public.usage_daily
     set input_tokens = input_tokens + coalesce(p_input_tokens, 0),
         output_tokens = output_tokens + coalesce(p_output_tokens, 0),
         reasoning_tokens = reasoning_tokens + coalesce(p_reasoning_tokens, 0),
         unknown_usage_turns = unknown_usage_turns + case when p_output_tokens is null then 1 else 0 end
   where user_id = r.user_id and usage_date = v_day;
  update private.usage_global_daily
     set estimated_cost = estimated_cost + v_cost
   where usage_date = v_day;
  update public.conversations set updated_at = now() where id = r.conversation_id;

  return jsonb_build_object('ok', v_final = p_status, 'status', v_final, 'assistant_message_id', v_msg);
end;
$$;

---------------------------------------------------------------------------------------------------
-- Service-only: "Delete all my data" (the Edge Function deletes the auth user in between)
---------------------------------------------------------------------------------------------------
create or replace function public.begin_data_deletion(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job uuid;
begin
  insert into private.data_deletion_jobs (user_id, status) values (p_user_id, 'running') returning id into v_job;
  update public.generation_requests
     set status = 'interrupted', cancel_requested_at = coalesce(cancel_requested_at, now()),
         error_code = 'DATA_DELETED', completed_at = now()
   where user_id = p_user_id and status in ('accepted', 'retrieving', 'streaming');
  delete from public.conversations where user_id = p_user_id;
  delete from public.usage_daily where user_id = p_user_id;
  return v_job;
end;
$$;

create or replace function public.complete_data_deletion(p_job_id uuid, p_ok boolean, p_error_code text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.data_deletion_jobs
     set status = case when p_ok then 'completed' else 'failed' end,
         completed_at = now(),
         error_code = case when p_ok then null else left(coalesce(p_error_code, 'UNKNOWN'), 64) end
   where id = p_job_id;
$$;

---------------------------------------------------------------------------------------------------
-- Learner RPCs (role authenticated). Identity = auth.uid(); never a client-supplied user id.
---------------------------------------------------------------------------------------------------
create or replace function private.require_uid()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v uuid := auth.uid();
begin
  if v is null then
    raise sqlstate 'PT401' using message = 'SESSION_REQUIRED';
  end if;
  return v;
end;
$$;

create or replace function public.rename_conversation(p_conversation_id uuid, p_title text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_title text := btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g'));
  r public.conversations;
begin
  if char_length(v_title) = 0 then
    raise sqlstate 'PT400' using message = 'INVALID_REQUEST', detail = 'A title can''t be empty.';
  end if;
  if char_length(v_title) > 120 then
    raise sqlstate 'PT413' using message = 'INPUT_TOO_LARGE', detail = 'Titles can be up to 120 characters.';
  end if;
  update public.conversations set title = v_title
   where id = p_conversation_id and user_id = v_uid
  returning * into r;
  if not found then
    raise sqlstate 'PT404' using message = 'NOT_FOUND';
  end if;
  return jsonb_build_object('id', r.id, 'title', r.title);
end;
$$;

create or replace function public.delete_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  delete from public.conversations where id = p_conversation_id and user_id = v_uid;
  if not found then
    raise sqlstate 'PT404' using message = 'NOT_FOUND';
  end if;
end;
$$;

create or replace function public.delete_all_conversations(p_confirm text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_count integer;
begin
  if p_confirm is distinct from 'DELETE_ALL_CONVERSATIONS' then
    raise sqlstate 'PT400' using message = 'INVALID_REQUEST', detail = 'Confirmation text did not match.';
  end if;
  delete from public.conversations where user_id = v_uid;
  get diagnostics v_count = row_count;
  return jsonb_build_object('deleted', v_count);
end;
$$;

create or replace function public.complete_onboarding()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_at timestamptz;
begin
  update public.profiles set onboarded_at = coalesce(onboarded_at, now()), last_active_at = now()
   where id = v_uid
  returning onboarded_at into v_at;
  if not found then
    raise sqlstate 'PT401' using message = 'SESSION_REQUIRED';
  end if;
  return v_at;
end;
$$;

-- Keeps the inactivity clock honest for learners who read but don't send (called at most hourly).
create or replace function public.touch_activity()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set last_active_at = now()
   where id = (select auth.uid()) and last_active_at < now() - interval '1 hour';
$$;

create or replace function private.require_own_answer(p_uid uuid, p_message_id uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.messages m
    where m.id = p_message_id and m.user_id = p_uid
      and m.role = 'assistant' and m.status = 'completed') then
    raise sqlstate 'PT404' using message = 'NOT_FOUND';
  end if;
end;
$$;

create or replace function public.set_feedback(p_message_id uuid, p_rating text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_rating is not null and p_rating not in ('helpful', 'not_helpful') then
    raise sqlstate 'PT400' using message = 'INVALID_REQUEST';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise sqlstate 'PT413' using message = 'INPUT_TOO_LARGE';
  end if;
  perform private.require_own_answer(v_uid, p_message_id);
  if p_rating is null then
    delete from public.feedback where user_id = v_uid and message_id = p_message_id;
  else
    insert into public.feedback (user_id, message_id, rating, reason)
    values (v_uid, p_message_id, p_rating, v_reason)
    on conflict (user_id, message_id)
    do update set rating = excluded.rating, reason = excluded.reason, updated_at = now();
  end if;
end;
$$;

create or replace function public.add_bookmark(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  perform private.require_own_answer(v_uid, p_message_id);
  insert into public.bookmarks (user_id, message_id) values (v_uid, p_message_id)
  on conflict do nothing;
end;
$$;

create or replace function public.remove_bookmark(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  delete from public.bookmarks where user_id = v_uid and message_id = p_message_id;
end;
$$;

create or replace function public.cancel_turn(p_turn_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_status text;
begin
  update public.generation_requests
     set cancel_requested_at = coalesce(cancel_requested_at, now())
   where id = p_turn_id and user_id = v_uid and status in ('accepted', 'retrieving', 'streaming')
  returning status into v_status;
  if found then
    return jsonb_build_object('status', 'cancellation_requested');
  end if;
  select status into v_status from public.generation_requests where id = p_turn_id and user_id = v_uid;
  if not found then
    raise sqlstate 'PT404' using message = 'NOT_FOUND';
  end if;
  return jsonb_build_object('status', v_status);
end;
$$;

---------------------------------------------------------------------------------------------------
-- Retrieval (RAG.md): SECURITY INVOKER so the caller's RLS limits results to published content.
---------------------------------------------------------------------------------------------------
create or replace function public.match_document_chunks(
  query_embedding extensions.vector(384),
  match_count integer default 5,
  min_similarity double precision default 0.8,
  language_filter text default null,
  p_embedding_version text default 'gte-small-384-v1'
)
returns table (
  chunk_id uuid,
  document_id uuid,
  heading text,
  content text,
  title text,
  section text,
  source_url text,
  source_version text,
  programming_language text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, d.id, c.heading, c.content, d.title, d.section, d.source_url, d.source_version,
         d.programming_language,
         1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where d.status = 'published'
    and c.embedding is not null
    and c.embedding_version = p_embedding_version
    and (language_filter is null or d.programming_language in (language_filter, 'general'))
    and 1 - (c.embedding operator(extensions.<=>) query_embedding) >= min_similarity
  order by c.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(coalesce(match_count, 5), 1), 10);
$$;

---------------------------------------------------------------------------------------------------
-- Maintenance (scheduled with pg_cron in the next migration)
---------------------------------------------------------------------------------------------------
create or replace function private.reconcile_expired_turns()
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.reconcile_turns(null);
$$;

create or replace function private.purge_inactive_anonymous_users()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer;
  v_count integer;
begin
  select anon_retention_days into v_days from private.app_config where id;
  delete from auth.users u
   where u.id in (
     select u2.id
     from auth.users u2
     left join public.profiles p on p.id = u2.id
     where u2.is_anonymous
       and coalesce(p.last_active_at, u2.created_at) < now() - make_interval(days => v_days)
     limit 5000);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function private.purge_old_usage()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.usage_ip_daily where usage_date < (now() at time zone 'utc')::date - 7;
  delete from private.data_deletion_jobs where requested_at < now() - interval '30 days';
  delete from public.usage_daily where usage_date < (now() at time zone 'utc')::date - 400;
$$;

---------------------------------------------------------------------------------------------------
-- Privileges: learners execute only their own RPCs; everything else is service_role only.
---------------------------------------------------------------------------------------------------
revoke all on all functions in schema private from public, anon, authenticated;

revoke execute on function
  public.get_runtime_config(),
  public.verify_operator_token(text),
  public.reserve_turn(uuid, uuid, uuid, text, text, text, text, text, text, text, text),
  public.turn_heartbeat(uuid, text),
  public.finalize_turn(uuid, text, text, jsonb, integer, integer, integer, text, text, text, integer),
  public.begin_data_deletion(uuid),
  public.complete_data_deletion(uuid, boolean, text)
from public, anon, authenticated;

grant execute on function
  public.get_runtime_config(),
  public.verify_operator_token(text),
  public.reserve_turn(uuid, uuid, uuid, text, text, text, text, text, text, text, text),
  public.turn_heartbeat(uuid, text),
  public.finalize_turn(uuid, text, text, jsonb, integer, integer, integer, text, text, text, integer),
  public.begin_data_deletion(uuid),
  public.complete_data_deletion(uuid, boolean, text)
to service_role;

revoke execute on function
  public.rename_conversation(uuid, text),
  public.delete_conversation(uuid),
  public.delete_all_conversations(text),
  public.complete_onboarding(),
  public.touch_activity(),
  public.set_feedback(uuid, text, text),
  public.add_bookmark(uuid),
  public.remove_bookmark(uuid),
  public.cancel_turn(uuid),
  public.match_document_chunks(extensions.vector, integer, double precision, text, text)
from public, anon;

grant execute on function
  public.rename_conversation(uuid, text),
  public.delete_conversation(uuid),
  public.delete_all_conversations(text),
  public.complete_onboarding(),
  public.touch_activity(),
  public.set_feedback(uuid, text, text),
  public.add_bookmark(uuid),
  public.remove_bookmark(uuid),
  public.cancel_turn(uuid),
  public.match_document_chunks(extensions.vector, integer, double precision, text, text)
to authenticated, service_role;
