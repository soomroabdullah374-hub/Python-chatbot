-- CodeBloom — row level security and least-privilege grants (DATABASE.md "Access matrix").
-- Browsers carry an anonymous-user JWT => role `authenticated`. Role `anon` (no session) gets nothing.
-- Ownership always comes from (select auth.uid()), never from the request body.

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.generation_requests enable row level security;
alter table public.messages enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.message_sources enable row level security;
alter table public.feedback enable row level security;
alter table public.bookmarks enable row level security;
alter table public.usage_daily enable row level security;

-- Start from zero, then grant back the minimum.
revoke all on
  public.profiles, public.conversations, public.generation_requests, public.messages,
  public.documents, public.document_chunks, public.message_sources, public.feedback,
  public.bookmarks, public.usage_daily
from public, anon, authenticated;

-- profiles: own SELECT + validated UPDATE of preference columns only.
grant select on public.profiles to authenticated;
grant update (
  preferred_language, explanation_language, experience_level,
  explanation_depth, enter_to_send, reduce_motion
) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- conversations / messages: own SELECT; all mutations go through checked RPCs or the chat function.
grant select on public.conversations to authenticated;
create policy conversations_select_own on public.conversations
  for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.messages to authenticated;
create policy messages_select_own on public.messages
  for select to authenticated
  using (user_id = (select auth.uid()));

-- generation_requests: own SELECT of non-sensitive columns only (no ip_bucket, no request hash).
grant select (
  id, conversation_id, status, mode, language, cancel_requested_at,
  error_code, created_at, completed_at
) on public.generation_requests to authenticated;
create policy generation_requests_select_own on public.generation_requests
  for select to authenticated
  using (user_id = (select auth.uid()));

-- message_sources inherit the privacy of their message.
grant select on public.message_sources to authenticated;
create policy message_sources_select_own on public.message_sources
  for select to authenticated
  using (exists (
    select 1 from public.messages m
    where m.id = message_sources.message_id
      and m.user_id = (select auth.uid())
  ));

grant select on public.feedback to authenticated;
create policy feedback_select_own on public.feedback
  for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.bookmarks to authenticated;
create policy bookmarks_select_own on public.bookmarks
  for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.usage_daily to authenticated;
create policy usage_daily_select_own on public.usage_daily
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Curated content: learners read published material only.
grant select on public.documents to authenticated;
create policy documents_select_published on public.documents
  for select to authenticated
  using (status = 'published');

grant select on public.document_chunks to authenticated;
create policy document_chunks_select_published on public.document_chunks
  for select to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = document_chunks.document_id
      and d.status = 'published'
  ));

-- Saved explanations page: one row per bookmark. security_invoker => the caller's RLS applies.
create view public.saved_explanations
with (security_invoker = true) as
select
  b.message_id,
  b.created_at as saved_at,
  m.conversation_id,
  m.mode,
  m.language,
  m.content,
  c.title as conversation_title,
  q.content as question
from public.bookmarks b
join public.messages m on m.id = b.message_id
join public.conversations c on c.id = m.conversation_id
left join public.messages q
  on q.generation_request_id = m.generation_request_id and q.role = 'user';

revoke all on public.saved_explanations from public, anon, authenticated;
grant select on public.saved_explanations to authenticated;
