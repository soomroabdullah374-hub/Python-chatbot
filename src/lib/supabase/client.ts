'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

let client: SupabaseClient | null = null;

/** Browser client. The anonymous session lives in cookies managed by @supabase/ssr (IDENTITY.md). */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(env.supabaseUrl, env.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return client;
}
