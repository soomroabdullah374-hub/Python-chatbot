-- GENERATED from authorization.test.sql by scripts/build-db-tests.mjs — do not edit.
-- Runs the pgTAP suite and raises its TAP output; the raise rolls every fixture back.
create extension if not exists pgtap with schema extensions;
create or replace function pg_temp.tap(_n integer, _sql text) returns text language plpgsql as $f$
declare _line text;
begin
  if _sql ~* '^\s*select\M' then
    execute format('select string_agg(t.x::text, chr(10)) from (%s) as t(x)', _sql) into _line;
    return coalesce(_line, '');
  end if;
  execute _sql;
  return null;
exception when others then
  return 'not ok - statement ' || _n || ' raised ' || sqlstate || ': ' || sqlerrm;
end $f$;
do $runner$
declare _o text := '';
begin
_o := _o || coalesce(pg_temp.tap(1, $s0$select plan(90)$s0$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(2, $s1$insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now(), '{}', '{}'),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now(), '{}', '{}'),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now() - interval '200 days', now(), '{}', '{}')$s1$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(3, $s2$select is((select count(*)::int from public.profiles where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333')), 3, 'trigger creates a profile for every new anonymous user')$s2$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(4, $s3$select is((select preferred_language || '/' || explanation_language || '/' || experience_level || '/' || explanation_depth || '/' || enter_to_send::text from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 'python/en/new/concise/true', 'profile defaults are applied')$s3$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(5, $s4$select is((select onboarded_at from public.profiles where id = '11111111-1111-4111-8111-111111111111'), null, 'new learners have not finished onboarding')$s4$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(6, $s5$insert into public.documents (id, slug, title, source_version, programming_language, section, license_note, content_hash, status, embedding_version) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'test-published', 'Published lesson', 'v1', 'python', 'Basics', 'test fixture', 'hash-a', 'published', 'gte-small-384-v1'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'test-draft', 'Draft lesson', 'v1', 'python', 'Basics', 'test fixture', 'hash-b', 'draft', 'gte-small-384-v1')$s5$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(7, $s6$insert into public.document_chunks (id, document_id, chunk_index, heading, content, token_count, embedding, embedding_version) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 0, 'Variables', 'A variable is a name for a value.', 9, array_fill(0.05::real, array[384])::extensions.vector, 'gte-small-384-v1'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 0, 'Draft', 'Unpublished draft text.', 4, array_fill(0.05::real, array[384])::extensions.vector, 'gte-small-384-v1')$s6$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(8, $s7$set local role service_role$s7$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(9, $s8$select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000001', repeat('a', 64), 'What is a variable in Python?', 'explain', 'python', repeat('b', 64), 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'status'), 'reserved', 'service role reserves a turn and creates the conversation')$s8$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(10, $s9$select is((select title from public.conversations where user_id = '11111111-1111-4111-8111-111111111111'), 'What is a variable in Python?', 'conversation title is derived from the first prompt')$s9$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(11, $s10$select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000001', repeat('a', 64), 'What is a variable in Python?', 'explain', 'python', repeat('b', 64), 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'TURN_IN_PROGRESS', 'replaying an active turn reports TURN_IN_PROGRESS')$s10$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(12, $s11$select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000001', repeat('c', 64), 'Something else', 'explain', 'python', repeat('b', 64), 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'IDEMPOTENCY_MISMATCH', 'reusing a key with different input is rejected')$s11$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(13, $s12$select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000002', repeat('d', 64), 'Second question', 'explain', 'python', repeat('b', 64), 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'TURN_IN_PROGRESS', 'a learner cannot run two turns at once')$s12$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(14, $s13$select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000009', repeat('d', 64), '   ', 'explain', 'python', null, 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'INVALID_REQUEST', 'blank messages are rejected')$s13$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(15, $s14$select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000009', repeat('d', 64), repeat('x', 12001), 'explain', 'python', null, 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'INPUT_TOO_LARGE', 'oversized messages are rejected')$s14$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(16, $s15$select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000009', repeat('d', 64), 'hi', 'chat', 'python', null, 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'INVALID_REQUEST', 'unsupported modes are rejected')$s15$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(17, $s16$select is((select count(*)::int from public.generation_requests where user_id = '11111111-1111-4111-8111-111111111111'), 1, 'idempotent retries do not duplicate turns')$s16$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(18, $s17$select ok(set_config('test.t1', (select id::text from public.generation_requests where idempotency_key = 'a0000000-0000-4000-8000-000000000001'), true) is not null, 'captured turn 1')$s17$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(19, $s18$select is((public.turn_heartbeat(current_setting('test.t1')::uuid, 'streaming') ->> 'status'), 'streaming', 'heartbeat advances the lifecycle')$s18$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(20, $s19$select is((public.finalize_turn(current_setting('test.t1')::uuid, 'completed', '## Short answer' || chr(10) || 'A variable is a name for a value. [S1]', '[{"label":"S1","chunk_id":"aaaaaaaa-0000-4000-8000-000000000001"},{"label":"S2","chunk_id":"bbbbbbbb-0000-4000-8000-000000000001"}]'::jsonb, 120, 60, 10, 'openai/gpt-oss-120b', 'req_1', null, 2) ->> 'status'), 'completed', 'finalize stores a completed answer')$s19$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(21, $s20$select is((select count(*)::int from public.message_sources s join public.messages m on m.id = s.message_id where m.user_id = '11111111-1111-4111-8111-111111111111'), 1, 'sources pointing at unpublished documents are dropped')$s20$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(22, $s21$select is((public.finalize_turn(current_setting('test.t1')::uuid, 'completed', 'again', null, 1, 1, 0, null, null, null, 0) ->> 'code'), 'ALREADY_FINAL', 'a turn cannot be finalised twice')$s21$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(23, $s22$select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000001', repeat('a', 64), 'What is a variable in Python?', 'explain', 'python', repeat('b', 64), 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') -> 'assistant_message' ->> 'status'), 'completed', 'replaying a completed turn returns the stored answer')$s22$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(24, $s23$select is((select accepted_turns from public.usage_daily where user_id = '11111111-1111-4111-8111-111111111111'), 1, 'usage counts one accepted turn despite retries')$s23$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(25, $s24$select is((select output_tokens::int from public.usage_daily where user_id = '11111111-1111-4111-8111-111111111111'), 60, 'usage records provider token counts')$s24$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(26, $s25$select is((public.reserve_turn('22222222-2222-4222-8222-222222222222', null, 'b0000000-0000-4000-8000-000000000001', repeat('e', 64), 'Explain loops', 'explain', 'python', repeat('b', 64), 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'status'), 'reserved', 'a second learner reserves a turn')$s25$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(27, $s26$select ok(set_config('test.t2', (select id::text from public.generation_requests where idempotency_key = 'b0000000-0000-4000-8000-000000000001'), true) is not null, 'captured turn 2')$s26$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(28, $s27$select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', (select conversation_id from public.generation_requests where id = current_setting('test.t2')::uuid), 'a0000000-0000-4000-8000-000000000003', repeat('d', 64), 'Can I post into this chat?', 'explain', 'python', null, 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'NOT_FOUND', 'a learner cannot add turns to someone else''s conversation')$s27$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(29, $s28$reset role$s28$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(30, $s29$set local role authenticated$s29$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(31, $s30$set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":true}'$s30$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(32, $s31$select is((select count(*)::int from public.conversations), 1, 'learner sees only their own conversations')$s31$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(33, $s32$select is((select count(*)::int from public.messages), 2, 'learner sees only their own messages')$s32$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(34, $s33$select is((select count(*)::int from public.message_sources), 1, 'learner sees sources of their own answers')$s33$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(35, $s34$select is((select count(*)::int from public.documents where slug in ('test-published', 'test-draft')), 1, 'unpublished documents are hidden from learners')$s34$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(36, $s35$select is((select count(*)::int from public.document_chunks where document_id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')), 1, 'chunks of unpublished documents are hidden')$s35$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(37, $s36$select is((select count(*)::int from public.match_document_chunks(array_fill(0.05::real, array[384])::extensions.vector, 5, 0.1, null, 'gte-small-384-v1') where document_id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')), 1, 'retrieval RPC returns published chunks only (the identical draft chunk is excluded)')$s36$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(38, $s37$select is((select count(*)::int from public.generation_requests), 1, 'learner reads own turn status')$s37$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(39, $s38$select throws_ok($q$select ip_bucket from public.generation_requests$q$, '42501', null, 'learner cannot read hashed IP buckets')$s38$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(40, $s39$select throws_ok($q$insert into public.messages (user_id, conversation_id, generation_request_id, role, content, status, mode, language) select user_id, conversation_id, generation_request_id, 'assistant', 'forged', 'completed', mode, language from public.messages limit 1$q$, '42501', null, 'learner cannot insert assistant messages')$s39$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(41, $s40$select throws_ok($q$update public.messages set content = 'tampered'$q$, '42501', null, 'learner cannot edit stored messages')$s40$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(42, $s41$select throws_ok($q$delete from public.conversations$q$, '42501', null, 'learner cannot delete rows directly')$s41$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(43, $s42$select throws_ok($q$update public.usage_daily set accepted_turns = 0$q$, '42501', null, 'learner cannot alter usage counters')$s42$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(44, $s43$select throws_ok($q$insert into public.usage_daily (user_id, usage_date) values ('11111111-1111-4111-8111-111111111111', current_date - 1)$q$, '42501', null, 'learner cannot create usage rows')$s43$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(45, $s44$select throws_ok($q$select * from private.usage_ip_daily$q$, '42501', null, 'per-IP usage is not readable by learners')$s44$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(46, $s45$select throws_ok($q$select * from private.usage_global_daily$q$, '42501', null, 'global usage is not readable by learners')$s45$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(47, $s46$select throws_ok($q$select * from private.data_deletion_jobs$q$, '42501', null, 'deletion jobs are not readable by learners')$s46$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(48, $s47$select throws_ok($q$select public.reserve_turn('11111111-1111-4111-8111-111111111111', null, gen_random_uuid(), repeat('a', 64), 'x', 'explain', 'python', null, 'v', 'm', 'p')$q$, '42501', null, 'learners cannot call the reservation RPC')$s47$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(49, $s48$select throws_ok($q$select public.finalize_turn(gen_random_uuid(), 'completed', 'x', null, 1, 1, 0, null, null, null, 0)$q$, '42501', null, 'learners cannot call the finalisation RPC')$s48$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(50, $s49$select throws_ok($q$select public.get_runtime_config()$q$, '42501', null, 'learners cannot read server config or secrets')$s49$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(51, $s50$select throws_ok($q$select public.begin_data_deletion('22222222-2222-4222-8222-222222222222')$q$, '42501', null, 'learners cannot start deletion for anyone')$s50$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(52, $s51$select throws_ok($q$update public.profiles set onboarded_at = now()$q$, '42501', null, 'learners cannot write non-preference profile columns')$s51$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(53, $s52$update public.profiles set explanation_depth = 'detailed', preferred_language = 'javascript'$s52$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(54, $s53$select is((select explanation_depth || '/' || preferred_language from public.profiles), 'detailed/javascript', 'learner updates own preference columns')$s53$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(55, $s54$update public.profiles set explanation_depth = 'detailed' where id = '22222222-2222-4222-8222-222222222222'$s54$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(56, $s55$select throws_ok($q$update public.profiles set experience_level = 'expert'$q$, '23514', null, 'preference values are enum-validated')$s55$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(57, $s56$select isnt(public.complete_onboarding(), null, 'complete_onboarding sets onboarded_at')$s56$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(58, $s57$select lives_ok($q$select public.add_bookmark((select id from public.messages where role = 'assistant' limit 1))$q$, 'learner bookmarks own completed answer')$s57$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(59, $s58$select lives_ok($q$select public.add_bookmark((select id from public.messages where role = 'assistant' limit 1))$q$, 'bookmarking is idempotent')$s58$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(60, $s59$select is((select count(*)::int from public.bookmarks), 1, 'one bookmark stored')$s59$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(61, $s60$select is((select question from public.saved_explanations), 'What is a variable in Python?', 'saved explanations include the original question')$s60$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(62, $s61$select lives_ok($q$select public.set_feedback((select id from public.messages where role = 'assistant' limit 1), 'helpful')$q$, 'learner rates own answer')$s61$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(63, $s62$select is((select rating from public.feedback), 'helpful', 'feedback stored')$s62$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(64, $s63$select throws_ok($q$select public.set_feedback((select id from public.messages where role = 'assistant' limit 1), 'amazing')$q$, 'PT400', null, 'feedback ratings are validated')$s63$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(65, $s64$select throws_ok($q$select public.add_bookmark((select id from public.messages where role = 'user' limit 1))$q$, 'PT404', null, 'only assistant answers can be saved')$s64$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(66, $s65$select is((public.cancel_turn(current_setting('test.t1')::uuid) ->> 'status'), 'completed', 'cancelling a completed turn keeps it completed')$s65$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(67, $s66$select throws_ok($q$select public.rename_conversation((select id from public.conversations limit 1), '   ')$q$, 'PT400', null, 'blank titles are rejected')$s66$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(68, $s67$select is((public.rename_conversation((select id from public.conversations limit 1), '  Python   variables ') ->> 'title'), 'Python variables', 'learner renames own conversation (trimmed)')$s67$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(69, $s68$set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","is_anonymous":true}'$s68$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(70, $s69$select is((select count(*)::int from public.conversations where user_id = '11111111-1111-4111-8111-111111111111'), 0, 'other learners'' conversations are invisible')$s69$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(71, $s70$select is((select count(*)::int from public.messages where user_id = '11111111-1111-4111-8111-111111111111'), 0, 'other learners'' messages are invisible')$s70$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(72, $s71$select is((select count(*)::int from public.message_sources), 0, 'other learners'' sources are invisible')$s71$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(73, $s72$select is((select count(*)::int from public.bookmarks) + (select count(*)::int from public.feedback) + (select count(*)::int from public.saved_explanations), 0, 'other learners'' bookmarks and feedback are invisible')$s72$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(74, $s73$select is((select explanation_depth from public.profiles), 'concise', 'a learner cannot change someone else''s profile')$s73$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(75, $s74$select throws_ok($q$select public.rename_conversation((select conversation_id from public.generation_requests where id = current_setting('test.t1')::uuid), 'hijack')$q$, 'PT404', null, 'cannot rename another learner''s conversation')$s74$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(76, $s75$select throws_ok($q$select public.delete_conversation((select conversation_id from public.saved_explanations limit 1))$q$, 'PT404', null, 'cannot delete another learner''s conversation')$s75$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(77, $s76$select throws_ok($q$select public.cancel_turn(current_setting('test.t1')::uuid)$q$, 'PT404', null, 'cannot cancel another learner''s turn')$s76$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(78, $s77$reset role$s77$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(79, $s78$set local role anon$s78$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(80, $s79$set local request.jwt.claims = '{"role":"anon"}'$s79$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(81, $s80$select throws_ok($q$select count(*) from public.conversations$q$, '42501', null, 'anon cannot read conversations')$s80$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(82, $s81$select throws_ok($q$select count(*) from public.documents$q$, '42501', null, 'anon cannot read documents')$s81$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(83, $s82$select throws_ok($q$select public.complete_onboarding()$q$, '42501', null, 'anon cannot call learner RPCs')$s82$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(84, $s83$reset role$s83$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(85, $s84$update private.app_config set max_turns_per_ip_per_day = 2$s84$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(86, $s85$set local role service_role$s85$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(87, $s86$select is((public.finalize_turn(current_setting('test.t2')::uuid, 'completed', 'Loops repeat code.', null, 10, 10, 0, 'openai/gpt-oss-120b', 'req_2', null, 0) ->> 'status'), 'completed', 'second learner''s turn completes')$s86$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(88, $s87$select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000004', repeat('f', 64), 'Another question', 'explain', 'python', repeat('b', 64), 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'NETWORK_LIMIT_REACHED', 'per-IP quota blocks a second identity on the same network')$s87$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(89, $s88$select is((public.reserve_turn('11111111-1111-4111-8111-111111111111', null, 'a0000000-0000-4000-8000-000000000005', repeat('f', 64), 'Another question', 'debug', 'python', repeat('9', 64), 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'status'), 'reserved', 'a different network bucket is unaffected')$s88$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(90, $s89$select ok(set_config('test.t5', (select id::text from public.generation_requests where idempotency_key = 'a0000000-0000-4000-8000-000000000005'), true) is not null, 'captured turn 5')$s89$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(91, $s90$reset role$s90$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(92, $s91$update private.app_config set generation_enabled = false$s91$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(93, $s92$set local role service_role$s92$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(94, $s93$select is((public.reserve_turn('22222222-2222-4222-8222-222222222222', null, 'b0000000-0000-4000-8000-000000000002', repeat('e', 64), 'Explain functions', 'explain', 'python', null, 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'GENERATION_PAUSED', 'the kill switch pauses new turns')$s93$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(95, $s94$reset role$s94$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(96, $s95$update private.app_config set generation_enabled = true, max_turns_per_minute = 1$s95$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(97, $s96$set local role service_role$s96$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(98, $s97$select is((public.reserve_turn('22222222-2222-4222-8222-222222222222', null, 'b0000000-0000-4000-8000-000000000003', repeat('e', 64), 'Explain functions', 'explain', 'python', null, 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'RATE_LIMITED', 'per-minute limit applies per learner')$s97$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(99, $s98$reset role$s98$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(100, $s99$update private.app_config set max_turns_per_minute = 10$s99$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(101, $s100$set local role authenticated$s100$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(102, $s101$set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":true}'$s101$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(103, $s102$select lives_ok($q$select public.delete_conversation((select conversation_id from public.generation_requests where id = current_setting('test.t5')::uuid))$q$, 'learner deletes a conversation while its answer is being written')$s102$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(104, $s103$reset role$s103$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(105, $s104$set local role service_role$s104$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(106, $s105$select is((public.finalize_turn(current_setting('test.t5')::uuid, 'completed', 'late answer', null, 1, 1, 0, null, null, null, 0) ->> 'code'), 'NOT_FOUND', 'a late completion cannot resurrect a deleted conversation')$s105$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(107, $s106$select is((public.turn_heartbeat(current_setting('test.t5')::uuid) ->> 'cancel'), 'true', 'heartbeat tells the stream to stop after deletion')$s106$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(108, $s107$select is((public.reserve_turn('22222222-2222-4222-8222-222222222222', null, 'b0000000-0000-4000-8000-000000000004', repeat('e', 64), 'Explain functions', 'explain', 'python', null, 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'status'), 'reserved', 'learner 2 reserves another turn')$s107$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(109, $s108$reset role$s108$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(110, $s109$update public.generation_requests set lease_expires_at = now() - interval '1 minute' where idempotency_key = 'b0000000-0000-4000-8000-000000000004'$s109$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(111, $s110$select is(private.reconcile_expired_turns(), 1, 'expired leases are reconciled')$s110$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(112, $s111$select is((select m.status from public.messages m join public.generation_requests g on g.id = m.generation_request_id where g.idempotency_key = 'b0000000-0000-4000-8000-000000000004' and m.role = 'assistant'), 'incomplete', 'abandoned answers are marked incomplete')$s111$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(113, $s112$set local role authenticated$s112$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(114, $s113$set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":true}'$s113$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(115, $s114$select throws_ok($q$select public.delete_all_conversations('yes')$q$, 'PT400', null, 'delete-all requires the confirmation string')$s114$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(116, $s115$select is((public.delete_all_conversations('DELETE_ALL_CONVERSATIONS') ->> 'deleted')::int, 1, 'delete-all removes every conversation of the caller')$s115$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(117, $s116$select is((select count(*)::int from public.bookmarks) + (select count(*)::int from public.feedback) + (select count(*)::int from public.messages), 0, 'messages, bookmarks and feedback cascade away')$s116$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(118, $s117$select is((select preferred_language from public.profiles), 'javascript', 'delete-all keeps preferences')$s117$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(119, $s118$reset role$s118$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(120, $s119$set local role service_role$s119$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(121, $s120$select ok(public.begin_data_deletion('22222222-2222-4222-8222-222222222222') is not null, 'data deletion job starts')$s120$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(122, $s121$select is((public.reserve_turn('22222222-2222-4222-8222-222222222222', null, 'b0000000-0000-4000-8000-000000000005', repeat('e', 64), 'Explain functions', 'explain', 'python', null, 'codebloom-tutor-v1', 'openai/gpt-oss-120b', 'groq') ->> 'code'), 'SESSION_REQUIRED', 'generation is blocked while data is deleted')$s121$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(123, $s122$reset role$s122$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(124, $s123$select is((select count(*)::int from public.conversations where user_id = '22222222-2222-4222-8222-222222222222'), 0, 'deletion removes the learner''s conversations')$s123$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(125, $s124$update public.profiles set last_active_at = now() - interval '200 days' where id = '33333333-3333-4333-8333-333333333333'$s124$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(126, $s125$select is(private.purge_inactive_anonymous_users(), 1, 'inactive anonymous learners are purged after the retention period')$s125$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(127, $s126$select is((select count(*)::int from public.profiles where id = '33333333-3333-4333-8333-333333333333'), 0, 'purge cascades to app data')$s126$) || chr(10), '');
_o := _o || coalesce(pg_temp.tap(128, $s127$select * from finish()$s127$) || chr(10), '');
raise exception using message = 'TAP-OUTPUT' || chr(10) || _o;
end
$runner$;
