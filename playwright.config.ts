import { defineConfig, devices } from '@playwright/test';

// Learner journeys (TESTING.md "E2E journeys") against a production build of the app that talks to
// tests/e2e/fake-supabase.mjs — no live project, no paid model calls. The build goes to .next-e2e.
const FAKE_PORT = 54399;
const APP_PORT = 3100;
const appEnv = {
  NEXT_DIST_DIR: '.next-e2e',
  NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${FAKE_PORT}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e_fake',
  NEXT_PUBLIC_AI_PROVIDER_NAME: 'Groq',
  NEXT_PUBLIC_RETENTION_DAYS: '90',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
};

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'off',
    viewport: { width: 1440, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command: 'node tests/e2e/fake-supabase.mjs',
      url: `http://localhost:${FAKE_PORT}/health`,
      env: { FAKE_SUPABASE_PORT: String(FAKE_PORT) },
      reuseExistingServer: false,
      timeout: 20_000,
    },
    {
      command: `npx next build && npx next start -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}`,
      env: appEnv,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
