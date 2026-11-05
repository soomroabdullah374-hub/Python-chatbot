-- CodeBloom — core learner data (DATABASE.md). Every row is owned by an anonymous auth user.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  preferred_language text not null default 'python'
    check (preferred_language in ('python', 'javascript', 'typescript', 'sql', 'html_css')),
  explanation_language text not null default 'en'
    check (explanation_language in ('en', 'roman_ur')),
  experience_level text not null default 'new'
    check (experience_level in ('new', 'basics', 'comfortable')),
  explanation_depth text not null default 'concise'
    check (explanation_depth in ('concise', 'detailed')),
  enter_to_send boolean not null default true,
  reduce_motion boolean not null default false,
  onboarded_at timestamptz,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_last_active_at_idx on public.profiles (last_active_at);
create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function private.touch_updated_at();

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  language text not null check (language in ('python', 'javascript', 'typescript', 'sql', 'html_css')),
  mode text not null check (mode in ('explain', 'debug', 'practice')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index conversations_user_updated_idx on public.conversations (user_id, updated_at desc, id);

create table public.generation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null,
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  status text not null
    check (status in ('accepted', 'retrieving', 'streaming', 'completed', 'failed', 'interrupted', 'incomplete')),
  mode text not null check (mode in ('explain', 'debug', 'practice')),
  language text not null check (language in ('python', 'javascript', 'typescript', 'sql', 'html_css')),
  lease_expires_at timestamptz not null,
  cancel_requested_at timestamptz,
  provider text,
  provider_request_id text,
  prompt_version text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  reasoning_tokens integer,
  cost_amount numeric(12, 6),
  cost_currency text not null default 'USD',
  retrieval_count integer,
  error_code text,
  ip_bucket text check (ip_bucket is null or ip_bucket ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, idempotency_key),
  foreign key (conversation_id, user_id) references public.conversations (id, user_id) on delete cascade
);
create unique index generation_requests_one_active_per_user
  on public.generation_requests (user_id) where status in ('accepted', 'retrieving', 'streaming');
create unique index generation_requests_one_active_per_conversation
  on public.generation_requests (conversation_id) where status in ('accepted', 'retrieving', 'streaming');
create index generation_requests_user_created_idx on public.generation_requests (user_id, created_at desc);
create index generation_requests_status_lease_idx on public.generation_requests (status, lease_expires_at);
create index generation_requests_conversation_idx on public.generation_requests (conversation_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null,
  generation_request_id uuid not null references public.generation_requests (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '' check (char_length(content) <= 40000),
  status text not null check (status in ('streaming', 'completed', 'failed', 'interrupted', 'incomplete')),
  mode text not null check (mode in ('explain', 'debug', 'practice')),
  language text not null check (language in ('python', 'javascript', 'typescript', 'sql', 'html_css')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now(),
  unique (generation_request_id, role),
  unique (id, user_id),
  foreign key (conversation_id, user_id) references public.conversations (id, user_id) on delete cascade
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at, id);
create index messages_user_idx on public.messages (user_id);

-- Approved learning material (RAG.md). Learners can read published rows only.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  title text not null check (char_length(title) between 1 and 200),
  source_url text check (source_url is null or source_url ~ '^https://'),
  source_version text not null,
  programming_language text not null
    check (programming_language in ('python', 'javascript', 'typescript', 'sql', 'html_css', 'general')),
  section text not null,
  license_note text not null,
  content_hash text not null,
  status text not null default 'draft'
    check (status in ('draft', 'indexing', 'published', 'archived', 'failed')),
  embedding_model text,
  embedding_version text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_status_language_idx on public.documents (status, programming_language);
create trigger documents_touch_updated_at before update on public.documents
  for each row execute function private.touch_updated_at();

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  heading text,
  content text not null check (char_length(content) between 1 and 4000),
  token_count integer not null check (token_count > 0),
  embedding extensions.vector(384),
  embedding_version text,
  metadata jsonb not null default '{}'::jsonb,
  unique (document_id, chunk_index)
);
create index document_chunks_document_idx on public.document_chunks (document_id);
create index document_chunks_embedding_idx on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

create table public.message_sources (
  message_id uuid not null references public.messages (id) on delete cascade,
  citation_label text not null check (citation_label ~ '^S[1-9][0-9]?$'),
  chunk_id uuid references public.document_chunks (id) on delete set null,
  document_title text not null,
  source_url text check (source_url is null or source_url ~ '^https://'),
  section text,
  document_version text,
  created_at timestamptz not null default now(),
  primary key (message_id, citation_label)
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message_id uuid not null,
  rating text not null check (rating in ('helpful', 'not_helpful')),
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, message_id),
  foreign key (message_id, user_id) references public.messages (id, user_id) on delete cascade
);
create index feedback_user_idx on public.feedback (user_id);
create index feedback_message_idx on public.feedback (message_id);

create table public.bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade,
  message_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id),
  foreign key (message_id, user_id) references public.messages (id, user_id) on delete cascade
);
create index bookmarks_user_created_idx on public.bookmarks (user_id, created_at desc);
create index bookmarks_message_idx on public.bookmarks (message_id);

create table public.usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  accepted_turns integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  reasoning_tokens bigint not null default 0,
  unknown_usage_turns integer not null default 0,
  primary key (user_id, usage_date)
);

-- Service-only tables (never reachable through the Data API).
create table private.usage_ip_daily (
  ip_bucket text not null check (ip_bucket ~ '^[0-9a-f]{64}$'),
  usage_date date not null,
  accepted_turns integer not null default 0,
  primary key (ip_bucket, usage_date)
);

create table private.usage_global_daily (
  usage_date date primary key,
  accepted_turns integer not null default 0,
  estimated_cost numeric(12, 6) not null default 0
);

create table private.data_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, -- intentionally not a foreign key: the job outlives the user
  status text not null check (status in ('requested', 'running', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text
);
create index data_deletion_jobs_user_idx on private.data_deletion_jobs (user_id, status);

alter table private.usage_ip_daily enable row level security;
alter table private.usage_global_daily enable row level security;
alter table private.data_deletion_jobs enable row level security;
revoke all on private.usage_ip_daily, private.usage_global_daily, private.data_deletion_jobs
  from public, anon, authenticated;
