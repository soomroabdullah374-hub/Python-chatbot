-- CodeBloom — operator content sync (RAG.md "Ingestion lifecycle": draft → chunked → embedded → published).
-- A changed document goes back to `draft` (hidden from learners) until ingest-content re-embeds it.
create or replace function public.upsert_document(p_document jsonb, p_chunks jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_hash text := p_document ->> 'content_hash';
  v_existing public.documents;
begin
  if v_hash is null or jsonb_typeof(p_chunks) <> 'array' or jsonb_array_length(p_chunks) = 0 then
    raise exception 'invalid document payload';
  end if;
  select * into v_existing from public.documents where slug = p_document ->> 'slug';
  if found and v_existing.content_hash = v_hash and v_existing.status <> 'archived' then
    return 'unchanged';
  end if;

  insert into public.documents (slug, title, source_url, source_version, programming_language, section,
                                license_note, content_hash, status)
  values (p_document ->> 'slug', p_document ->> 'title', nullif(p_document ->> 'source_url', ''),
          p_document ->> 'version', p_document ->> 'language', p_document ->> 'section',
          p_document ->> 'license_note', v_hash, 'draft')
  on conflict (slug) do update
    set title = excluded.title,
        source_url = excluded.source_url,
        source_version = excluded.source_version,
        programming_language = excluded.programming_language,
        section = excluded.section,
        license_note = excluded.license_note,
        content_hash = excluded.content_hash,
        status = 'draft',
        published_at = null
  returning id into v_id;

  delete from public.document_chunks where document_id = v_id;
  insert into public.document_chunks (document_id, chunk_index, heading, content, token_count, metadata)
  select v_id, (c ->> 'index')::integer, c ->> 'heading', c ->> 'content', (c ->> 'token_count')::integer,
         coalesce(c -> 'metadata', '{}'::jsonb)
  from jsonb_array_elements(p_chunks) as c;

  return case when v_existing.id is null then 'created' else 'updated' end;
end;
$$;

-- Documents removed from the manifest stop being searchable.
create or replace function public.archive_documents_not_in(p_slugs text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.documents set status = 'archived'
   where status <> 'archived' and not (slug = any (p_slugs));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.upsert_document(jsonb, jsonb), public.archive_documents_not_in(text[])
  from public, anon, authenticated;
grant execute on function public.upsert_document(jsonb, jsonb), public.archive_documents_not_in(text[])
  to service_role;
