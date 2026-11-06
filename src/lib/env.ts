// Public, browser-safe configuration only. Provider keys never appear here (SECURITY.md).
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '',
  providerName: process.env.NEXT_PUBLIC_AI_PROVIDER_NAME || 'Groq',
  retentionDays: Number(process.env.NEXT_PUBLIC_RETENTION_DAYS || '90'),
};

export const functionsUrl = `${env.supabaseUrl.replace(/\/$/, '')}/functions/v1`;
