// Deno-only server helpers shared by the Edge Functions: environment, service client and a short
// cache of runtime config. Secrets come from Edge Function env first (GROQ_API_KEY, XAI_API_KEY,
// IP_HASH_SALT), falling back to Supabase Vault via the service-only get_runtime_config() RPC.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ProviderRuntime } from './chat-handler.ts';
import { openProviderStream, type ProviderName, type ProviderSettings } from './providers.ts';

export interface ServerEnv {
  url: string;
  anonKey: string;
  serviceKey: string;
}

function firstKey(json: string | undefined): string | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json) as Record<string, string>;
    return parsed.default ?? Object.values(parsed)[0];
  } catch {
    return undefined;
  }
}

export function serverEnv(): ServerEnv {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? firstKey(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'));
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? firstKey(Deno.env.get('SUPABASE_SECRET_KEYS'));
  if (!url || !anonKey || !serviceKey) throw new Error('Supabase environment is incomplete');
  return { url, anonKey, serviceKey };
}

export function adminClient(env: ServerEnv): SupabaseClient {
  return createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** A client that acts as the learner, so RLS applies (used for retrieval). */
export function userClient(env: ServerEnv, token: string): SupabaseClient {
  return createClient(env.url, env.anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export interface Runtime {
  allowedOrigins: string[];
  generationEnabled: boolean;
  groqKey: string | null;
  xaiKey: string | null;
  ipHashSalt: string | null;
}

let cache: { at: number; value: Runtime } | null = null;
const CACHE_MS = 60_000;

export async function loadRuntime(admin: SupabaseClient): Promise<Runtime> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const { data, error } = await admin.rpc('get_runtime_config');
  if (error || !data) {
    if (cache) return cache.value;
    throw new Error('runtime config unavailable');
  }
  const envOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const secrets = (data.secrets ?? {}) as Record<string, string | null>;
  const value: Runtime = {
    allowedOrigins: Array.from(new Set([...envOrigins, ...((data.allowed_origins ?? []) as string[])])),
    generationEnabled: data.generation_enabled !== false,
    groqKey: Deno.env.get('GROQ_API_KEY') ?? secrets.groq_api_key ?? null,
    xaiKey: Deno.env.get('XAI_API_KEY') ?? secrets.xai_api_key ?? null,
    ipHashSalt: Deno.env.get('IP_HASH_SALT') ?? secrets.ip_hash_salt ?? null,
  };
  cache = { at: Date.now(), value };
  return value;
}

/** Provider choice: LLM_PROVIDER if set, otherwise whichever key is configured (xAI first). */
export function providerRuntime(rt: Runtime): ProviderRuntime | null {
  const requested = (Deno.env.get('LLM_PROVIDER') ?? '').toLowerCase() as ProviderName | '';
  let name: ProviderName | null = null;
  if (requested === 'groq' || requested === 'xai') name = requested;
  else if (rt.xaiKey) name = 'xai';
  else if (rt.groqKey) name = 'groq';
  if (!name) return null;
  const apiKey = name === 'groq' ? rt.groqKey : rt.xaiKey;
  if (!apiKey) return null;
  const model = name === 'groq'
    ? Deno.env.get('LLM_MODEL') ?? 'openai/gpt-oss-120b'
    : Deno.env.get('XAI_MODEL') ?? Deno.env.get('LLM_MODEL') ?? 'grok-4-fast-non-reasoning';
  const fallback = name === 'groq'
    ? Deno.env.get('LLM_FALLBACK_MODEL') ?? 'openai/gpt-oss-20b'
    : Deno.env.get('XAI_FALLBACK_MODEL') ?? null;
  const settings: ProviderSettings = {
    name,
    apiKey,
    maxOutputTokens: Number(Deno.env.get('MAX_OUTPUT_TOKENS') ?? '1800'),
    reasoningEffort: (Deno.env.get('LLM_REASONING_EFFORT') as ProviderSettings['reasoningEffort']) ?? 'low',
  };
  return {
    name,
    model,
    fallbackModel: fallback && fallback !== model ? fallback : null,
    stream: (m, messages, signal) => openProviderStream(settings, m, messages, signal),
  };
}

export function jsonLog(entry: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }));
}
