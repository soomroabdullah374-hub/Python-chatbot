-- CodeBloom — scheduled maintenance and server-side secrets.

-- Server secrets live in Supabase Vault (encrypted at rest), readable only by the service role
-- through public.get_runtime_config(). Values are generated here, never committed.
-- The model provider key (groq_api_key / xai_api_key) is added by an operator, see DEPLOYMENT notes.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'ip_hash_salt',
                           'HMAC salt for per-IP quota buckets (raw IPs are never stored)')
where not exists (select 1 from vault.secrets where name = 'ip_hash_salt');

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'operator_token',
                           'Bearer token for operator-only Edge Functions (content ingestion)')
where not exists (select 1 from vault.secrets where name = 'operator_token');

-- Lease reconciliation every minute; inactivity purge and usage cleanup daily (UTC).
select cron.schedule('codebloom-reconcile-turns', '* * * * *', $$select private.reconcile_expired_turns()$$);
select cron.schedule('codebloom-purge-inactive', '17 3 * * *', $$select private.purge_inactive_anonymous_users()$$);
select cron.schedule('codebloom-purge-usage', '29 3 * * *', $$select private.purge_old_usage()$$);
