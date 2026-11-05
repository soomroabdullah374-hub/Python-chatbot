-- CodeBloom — covering indexes for composite ownership foreign keys (performance advisor 0001).
drop index if exists public.bookmarks_message_idx;
create index bookmarks_message_user_idx on public.bookmarks (message_id, user_id);

drop index if exists public.feedback_message_idx;
create index feedback_message_user_idx on public.feedback (message_id, user_id);

drop index if exists public.generation_requests_conversation_idx;
create index generation_requests_conversation_user_idx on public.generation_requests (conversation_id, user_id);

create index message_sources_chunk_idx on public.message_sources (chunk_id);
create index messages_conversation_user_idx on public.messages (conversation_id, user_id);
