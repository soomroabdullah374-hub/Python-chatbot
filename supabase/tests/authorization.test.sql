-- CodeBloom database authorization + lifecycle tests (pgTAP). Run with `supabase test db`,
-- or through `npm run db:tests:build` for environments without the CLI (see scripts/build-db-tests.mjs).
-- Two anonymous learners (U1, U2), one stale anonymous learner (U3) and the `anon` role.
begin;
select plan(90);

insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now(), '{}', '{}'),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now(), '{}', '{}'),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now() - interval '200 days', now(), '{}', '{}');

select is((select count(*)::int from public.profiles where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333')), 3, 'trigger creates a profile for every new anonymous user');
select is((select preferred_language || '/' || explanation_language || '/' || experience_level || '/' || explanation_depth || '/' || enter_to_send::text from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 'python/en/new/concise/true', 'profile defaults are applied');
select is((select onboarded_at from public.profiles where id = '11111111-1111-4111-8111-111111111111'), null, 'new learners have not finished onboarding');

insert into public.documents (id, slug, title, source_version, programming_language, section, license_note, content_hash, status, embedding_version) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'test-published', 'Published lesson', 'v1', 'python', 'Basics', 'test fixture', 'hash-a', 'published', 'gte-small-384-v1'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'test-draft', 'Draft lesson', 'v1', 'python', 'Basics', 'test fixture', 'hash-b', 'draft', 'gte-small-384-v1');
insert into public.document_chunks (id, document_id, chunk_index, heading, content, token_count, embedding, embedding_version) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 0, 'Variables', 'A variable is a name for a value.', 9, array_fill(0.05::real, array[384])::extensions.vector, 'gte-small-384-v1'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 0, 'Draft', 'Unpublished draft text.', 4, array_fill(0.05::real, array[384])::extensions.vector, 'gte-small-384-v1');

-- ===== Service role: turn lifecycle =====
set local role service_role;
select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000001', repeat('a', 64), 'What is a variable in Python?', 'explain', 'python', repeat('b', 64), 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'status'), 'reserved', 'service role reserves a turn and creates the conversation');
select is((select title from public.conversations where user_id = '11111111-1111-4111-8111-111111111111'), 'What is a variable in Python?', 'conversation title is derived from the first prompt');
select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000001', repeat('a', 64), 'What is a variable in Python?', 'explain', 'python', repeat('b', 64), 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'TURN_IN_PROGRESS', 'replaying an active turn reports TURN_IN_PROGRESS');
select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000001', repeat('c', 64), 'Something else', 'explain', 'python', repeat('b', 64), 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'IDEMPOTENCY_MISMATCH', 'reusing a key with different input is rejected');
select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000002', repeat('d', 64), 'Second question', 'explain', 'python', repeat('b', 64), 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'TURN_IN_PROGRESS', 'a learner cannot run two turns at once');
select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000009', repeat('d', 64), '   ', 'explain', 'python', null, 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'INVALID_REQUEST', 'blank messages are rejected');
select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000009', repeat('d', 64), repeat('x', 12001), 'explain', 'python', null, 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'INPUT_TOO_LARGE', 'oversized messages are rejected');
select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000009', repeat('d', 64), 'hi', 'chat', 'python', null, 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'INVALID_REQUEST', 'unsupported modes are rejected');
select is((select count(*)::int from public.generation_requests where user_id = '11111111-1111-4111-8111-111111111111'), 1, 'idempotent retries do not duplicate turns');
select ok(set_config('test.t1', (select id::text from public.generation_requests where idempotency_key = 'a0000000-0000-4000-8000-000000000001'), true) is not null, 'captured turn 1');
select is((public.turn_heartbeat(current_setting('test.t1')::uuid, 'streaming') ->> 'status'), 'streaming', 'heartbeat advances the lifecycle');
select is((public.finalize_turn(current_setting('test.t1')::uuid, 'completed', '## Short answer' || chr(10) || 'A variable is a name for a value. [S1]', '[{"label":"S1","chunk_id":"aaaaaaaa-0000-4000-8000-000000000001"},{"label":"S2","chunk_id":"bbbbbbbb-0000-4000-8000-000000000001"}]'::jsonb, 120, 60, 10, 'openai/gpt-oss-120b', 'req_1', null, 2) ->> 'status'), 'completed', 'finalize stores a completed answer');
select is((select count(*)::int from public.message_sources s join public.messages m on m.id = s.message_id where m.user_id = '11111111-1111-4111-8111-111111111111'), 1, 'sources pointing at unpublished documents are dropped');
select is((public.finalize_turn(current_setting('test.t1')::uuid, 'completed', 'again', null, 1, 1, 0, null, null, null, 0) ->> 'code'), 'ALREADY_FINAL', 'a turn cannot be finalised twice');
select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000001', repeat('a', 64), 'What is a variable in Python?', 'explain', 'python', repeat('b', 64), 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') -> 'assistant_message' ->> 'status'), 'completed', 'replaying a completed turn returns the stored answer');
select is((select accepted_turns from public.usage_daily where user_id = '11111111-1111-4111-8111-111111111111'), 1, 'usage counts one accepted turn despite retries');
select is((select output_tokens::int from public.usage_daily where user_id = '11111111-1111-4111-8111-111111111111'), 60, 'usage records provider token counts');
select is((public.reserve_turn('22222222-2222-4222-8222-222222222222', null, 'b0000000-0000-4000-8000-000000000001', repeat('e', 64), 'Explain loops', 'explain', 'python', repeat('b', 64), 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'status'), 'reserved', 'a second learner reserves a turn');
select ok(set_config('test.t2', (select id::text from public.generation_requests where idempotency_key = 'b0000000-0000-4000-8000-000000000001'), true) is not null, 'captured turn 2');
select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', (select conversation_id from public.generation_requests where id = current_setting('test.t2')::uuid), 'a0000000-0000-4000-8000-000000000003', repeat('d', 64), 'Can I post into this chat?', 'explain', 'python', null, 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'NOT_FOUND', 'a learner cannot add turns to someone else''s conversation');

-- ===== Learner U1 =====
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":true}';
select is((select count(*)::int from public.conversations), 1, 'learner sees only their own conversations');
select is((select count(*)::int from public.messages), 2, 'learner sees only their own messages');
select is((select count(*)::int from public.message_sources), 1, 'learner sees sources of their own answers');
select is((select count(*)::int from public.documents where slug in ('test-published', 'test-draft')), 1, 'unpublished documents are hidden from learners');
select is((select count(*)::int from public.document_chunks where document_id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')), 1, 'chunks of unpublished documents are hidden');
select is((select count(*)::int from public.match_document_chunks(array_fill(0.05::real, array[384])::extensions.vector, 5, 0.1, null, 'gte-small-384-v1') where document_id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')), 1, 'retrieval RPC returns published chunks only (the identical draft chunk is excluded)');
select is((select count(*)::int from public.generation_requests), 1, 'learner reads own turn status');
select throws_ok($q$select ip_bucket from public.generation_requests$q$, '42501', null, 'learner cannot read hashed IP buckets');
select throws_ok($q$insert into public.messages (user_id, conversation_id, generation_request_id, role, content, status, mode, language) select user_id, conversation_id, generation_request_id, 'assistant', 'forged', 'completed', mode, language from public.messages limit 1$q$, '42501', null, 'learner cannot insert assistant messages');
select throws_ok($q$update public.messages set content = 'tampered'$q$, '42501', null, 'learner cannot edit stored messages');
select throws_ok($q$delete from public.conversations$q$, '42501', null, 'learner cannot delete rows directly');
select throws_ok($q$update public.usage_daily set accepted_turns = 0$q$, '42501', null, 'learner cannot alter usage counters');
select throws_ok($q$insert into public.usage_daily (user_id, usage_date) values ('11111111-1111-4111-8111-111111111111', current_date - 1)$q$, '42501', null, 'learner cannot create usage rows');
select throws_ok($q$select * from private.usage_ip_daily$q$, '42501', null, 'per-IP usage is not readable by learners');
select throws_ok($q$select * from private.usage_global_daily$q$, '42501', null, 'global usage is not readable by learners');
select throws_ok($q$select * from private.data_deletion_jobs$q$, '42501', null, 'deletion jobs are not readable by learners');
select throws_ok($q$select public.reserve_turn('11111111-1111-4111-8111-111111111111', null, gen_random_uuid(), repeat('a', 64), 'x', 'explain', 'python', null, 'v', 'm', 'p')$q$, '42501', null, 'learners cannot call the reservation RPC');
select throws_ok($q$select public.finalize_turn(gen_random_uuid(), 'completed', 'x', null, 1, 1, 0, null, null, null, 0)$q$, '42501', null, 'learners cannot call the finalisation RPC');
select throws_ok($q$select public.get_runtime_config()$q$, '42501', null, 'learners cannot read server config or secrets');
select throws_ok($q$select public.begin_data_deletion('22222222-2222-4222-8222-222222222222')$q$, '42501', null, 'learners cannot start deletion for anyone');
select throws_ok($q$update public.profiles set onboarded_at = now()$q$, '42501', null, 'learners cannot write non-preference profile columns');
update public.profiles set explanation_depth = 'detailed', preferred_language = 'javascript';
select is((select explanation_depth || '/' || preferred_language from public.profiles), 'detailed/javascript', 'learner updates own preference columns');
update public.profiles set explanation_depth = 'detailed' where id = '22222222-2222-4222-8222-222222222222';
select throws_ok($q$update public.profiles set experience_level = 'expert'$q$, '23514', null, 'preference values are enum-validated');
select isnt(public.complete_onboarding(), null, 'complete_onboarding sets onboarded_at');
select lives_ok($q$select public.add_bookmark((select id from public.messages where role = 'assistant' limit 1))$q$, 'learner bookmarks own completed answer');
select lives_ok($q$select public.add_bookmark((select id from public.messages where role = 'assistant' limit 1))$q$, 'bookmarking is idempotent');
select is((select count(*)::int from public.bookmarks), 1, 'one bookmark stored');
select is((select question from public.saved_explanations), 'What is a variable in Python?', 'saved explanations include the original question');
select lives_ok($q$select public.set_feedback((select id from public.messages where role = 'assistant' limit 1), 'helpful')$q$, 'learner rates own answer');
select is((select rating from public.feedback), 'helpful', 'feedback stored');
select throws_ok($q$select public.set_feedback((select id from public.messages where role = 'assistant' limit 1), 'amazing')$q$, 'PT400', null, 'feedback ratings are validated');
select throws_ok($q$select public.add_bookmark((select id from public.messages where role = 'user' limit 1))$q$, 'PT404', null, 'only assistant answers can be saved');
select is((public.cancel_turn(current_setting('test.t1')::uuid) ->> 'status'), 'completed', 'cancelling a completed turn keeps it completed');
select throws_ok($q$select public.rename_conversation((select id from public.conversations limit 1), '   ')$q$, 'PT400', null, 'blank titles are rejected');
select is((public.rename_conversation((select id from public.conversations limit 1), '  Python   variables ') ->> 'title'), 'Python variables', 'learner renames own conversation (trimmed)');

-- ===== Learner U2 cannot touch U1's data =====
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","is_anonymous":true}';
select is((select count(*)::int from public.conversations where user_id = '11111111-1111-4111-8111-111111111111'), 0, 'other learners'' conversations are invisible');
select is((select count(*)::int from public.messages where user_id = '11111111-1111-4111-8111-111111111111'), 0, 'other learners'' messages are invisible');
select is((select count(*)::int from public.message_sources), 0, 'other learners'' sources are invisible');
select is((select count(*)::int from public.bookmarks) + (select count(*)::int from public.feedback) + (select count(*)::int from public.saved_explanations), 0, 'other learners'' bookmarks and feedback are invisible');
select is((select explanation_depth from public.profiles), 'concise', 'a learner cannot change someone else''s profile');
select throws_ok($q$select public.rename_conversation((select conversation_id from public.generation_requests where id = current_setting('test.t1')::uuid), 'hijack')$q$, 'PT404', null, 'cannot rename another learner''s conversation');
select throws_ok($q$select public.delete_conversation((select conversation_id from public.saved_explanations limit 1))$q$, 'PT404', null, 'cannot delete another learner''s conversation');
select throws_ok($q$select public.cancel_turn(current_setting('test.t1')::uuid)$q$, 'PT404', null, 'cannot cancel another learner''s turn');

-- ===== anon (no session) gets nothing =====
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($q$select count(*) from public.conversations$q$, '42501', null, 'anon cannot read conversations');
select throws_ok($q$select count(*) from public.documents$q$, '42501', null, 'anon cannot read documents');
select throws_ok($q$select public.complete_onboarding()$q$, '42501', null, 'anon cannot call learner RPCs');

-- ===== Quotas, kill switch, late completions, leases =====
reset role;
update private.app_config set max_turns_per_ip_per_day = 2;
set local role service_role;
select is((public.finalize_turn(current_setting('test.t2')::uuid, 'completed', 'Loops repeat code.', null, 10, 10, 0, 'openai/gpt-oss-120b', 'req_2', null, 0) ->> 'status'), 'completed', 'second learner''s turn completes');
select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000004', repeat('f', 64), 'Another question', 'explain', 'python', repeat('b', 64), 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'NETWORK_LIMIT_REACHED', 'per-IP quota blocks a second identity on the same network');
select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000005', repeat('f', 64), 'Another question', 'debug', 'python', repeat('9', 64), 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'status'), 'reserved', 'a different network bucket is unaffected');
select ok(set_config('test.t5', (select id::text from public.generation_requests where idempotency_key = 'a0000000-0000-4000-8000-000000000005'), true) is not null, 'captured turn 5');
reset role;
update private.app_config set generation_enabled = false;
set local role service_role;
select is((public.reserve_turn('22222222-2222-4222-8222-222222222222', null, 'b0000000-0000-4000-8000-000000000002', repeat('e', 64), 'Explain functions', 'explain', 'python', null, 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'GENERATION_PAUSED', 'the kill switch pauses new turns');
reset role;
update private.app_config set generation_enabled = true, max_turns_per_minute = 1;
set local role service_role;
select is((public.reserve_turn('22222222-2222-4222-8222-222222222222', null, 'b0000000-0000-4000-8000-000000000003', repeat('e', 64), 'Explain functions', 'explain', 'python', null, 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'RATE_LIMITED', 'per-minute limit applies per learner');
reset role;
update private.app_config set max_turns_per_minute = 10;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":true}';
select lives_ok($q$select public.delete_conversation((select conversation_id from public.generation_requests where id = current_setting('test.t5')::uuid))$q$, 'learner deletes a conversation while its answer is being written');
reset role;
set local role service_role;
select is((public.finalize_turn(current_setting('test.t5')::uuid, 'completed', 'late answer', null, 1, 1, 0, null, null, null, 0) ->> 'code'), 'NOT_FOUND', 'a late completion cannot resurrect a deleted conversation');
select is((public.turn_heartbeat(current_setting('test.t5')::uuid) ->> 'cancel'), 'true', 'heartbeat tells the stream to stop after deletion');
select is((public.reserve_turn('22222222-2222-4222-8222-222222222222', null, 'b0000000-0000-4000-8000-000000000004', repeat('e', 64), 'Explain functions', 'explain', 'python', null, 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'status'), 'reserved', 'learner 2 reserves another turn');
reset role;
update public.generation_requests set lease_expires_at = now() - interval '1 minute' where idempotency_key = 'b0000000-0000-4000-8000-000000000004';
select is(private.reconcile_expired_turns(), 1, 'expired leases are reconciled');
select is((select m.status from public.messages m join public.generation_requests g on g.id = m.generation_request_id where g.idempotency_key = 'b0000000-0000-4000-8000-000000000004' and m.role = 'assistant'), 'incomplete', 'abandoned answers are marked incomplete');

-- ===== Delete-all, data deletion, inactivity purge =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":true}';
select throws_ok($q$select public.delete_all_conversations('yes')$q$, 'PT400', null, 'delete-all requires the confirmation string');
select is((public.delete_all_conversations('DELETE_ALL_CONVERSATIONS') ->> 'deleted')::int, 1, 'delete-all removes every conversation of the caller');
select is((select count(*)::int from public.bookmarks) + (select count(*)::int from public.feedback) + (select count(*)::int from public.messages), 0, 'messages, bookmarks and feedback cascade away');
select is((select preferred_language from public.profiles), 'javascript', 'delete-all keeps preferences');
reset role;
set local role service_role;
select ok(public.begin_data_deletion('22222222-2222-4222-8222-222222222222') is not null, 'data deletion job starts');
select is((public.reserve_turn('22222222-2222-4222-8222-222222222222', null, 'b0000000-0000-4000-8000-000000000005', repeat('e', 64), 'Explain functions', 'explain', 'python', null, 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'SESSION_REQUIRED', 'generation is blocked while data is deleted');
reset role;
select is((select count(*)::int from public.conversations where user_id = '22222222-2222-4222-8222-222222222222'), 0, 'deletion removes the learner''s conversations');
update public.profiles set last_active_at = now() - interval '200 days' where id = '33333333-3333-4333-8333-333333333333';
select is(private.purge_inactive_anonymous_users(), 1, 'inactive anonymous learners are purged after the retention period');
select is((select count(*)::int from public.profiles where id = '33333333-3333-4333-8333-333333333333'), 0, 'purge cascades to app data');

select * from finish();
rollback;
