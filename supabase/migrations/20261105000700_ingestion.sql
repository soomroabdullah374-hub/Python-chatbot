-- CodeBloom — content ingestion support (RAG.md "Ingestion lifecycle"). Service role only.
create or replace function public.publish_ready_documents(p_embedding_model text, p_embedding_version text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.documents d
     set status = 'published',
         published_at = now(),
         embedding_model = p_embedding_model,
         embedding_version = p_embedding_version
   where d.status in ('draft', 'indexing')
     and exists (select 1 from public.document_chunks c where c.document_id = d.id)
     and not exists (
       select 1 from public.document_chunks c
       where c.document_id = d.id
         and (c.embedding is null or c.embedding_version is distinct from p_embedding_version));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.publish_ready_documents(text, text) from public, anon, authenticated;
grant execute on function public.publish_ready_documents(text, text) to service_role;
