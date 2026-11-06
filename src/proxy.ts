// Refreshes the anonymous Supabase session cookies on workspace routes. It never redirects to a
// login page — there is none (IDENTITY.md). Identity for data access is enforced by RLS.
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;
  if (!request.cookies.getAll().some((c) => c.name.startsWith('sb-'))) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });
  try {
    await supabase.auth.getClaims();
  } catch {
    // A refresh failure is handled client-side by the SessionGate (silent reconnect).
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: ['/onboarding', '/chat', '/chat/:path*', '/saved', '/settings'],
};
