#!/usr/bin/env node
// Live smoke test (TESTING.md "Live smoke", DEPLOYMENT.md "Production smoke") against a deployed site.
// Makes ONE short real model request. Run only against an environment you are allowed to test:
//   LIVE_URL=https://codebloom-lac.vercel.app node tests/live/smoke.mjs
// Steps: fresh browser → Start learning → onboarding (defaults) → ask → streamed answer → reload keeps
// history → a second browser can't open it → Delete all my data → fresh workspace. Exit code 1 on failure.
import { chromium } from 'playwright';

const BASE = (process.env.LIVE_URL ?? 'https://codebloom-lac.vercel.app').replace(/\/$/, '');
const QUESTION = 'What is a variable in Python? Please keep it short.';
const results = [];
const step = async (name, fn) => {
  const t = Date.now();
  try {
    const note = await fn();
    results.push({ name, ok: true, ms: Date.now() - t, note: note ?? '' });
  } catch (err) {
    results.push({ name, ok: false, ms: Date.now() - t, note: String(err?.message ?? err).split('\n')[0].slice(0, 200) });
    throw err;
  }
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const paths = [];
page.on('framenavigated', (f) => f === page.mainFrame() && paths.push(new URL(f.url()).pathname));
let signupStatus = null;
page.on('response', (r) => {
  if (r.url().includes('/auth/v1/signup')) signupStatus = r.status();
});
let conversationUrl = '';

try {
  await step('landing → Start learning → onboarding (no login screen)', async () => {
    await page.goto(`${BASE}/`);
    await page.getByRole('link', { name: 'Start learning' }).first().click();
    await page.waitForURL(/\/onboarding$/, { timeout: 30_000 });
    const ready = page.getByRole('heading', { name: 'How should CodeBloom explain things?' });
    const noSession = page.getByText("We couldn't restore your private session");
    await ready.or(noSession).first().waitFor({ timeout: 30_000 });
    if (await noSession.isVisible()) {
      throw new Error(`no anonymous session: POST /auth/v1/signup → ${signupStatus ?? 'no response'} (turn on Anonymous Sign-ins in Supabase Auth)`);
    }
    await page.getByRole('button', { name: 'Use defaults' }).click();
    await page.waitForURL(/\/chat$/, { timeout: 30_000 });
    if (paths.some((p) => /log-?in|sign-?(up|in)|auth/i.test(p))) throw new Error(`auth route visited: ${paths.join(', ')}`);
    return paths.join(' → ');
  });

  await step('ask a question → streamed, saved answer', async () => {
    await page.getByRole('textbox', { name: 'Message CodeBloom' }).fill(QUESTION);
    await page.getByRole('button', { name: 'Send message' }).click();
    await page.waitForURL(/\/chat\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    conversationUrl = page.url();
    const answer = page.getByRole('article', { name: 'CodeBloom answer' }).first();
    await answer.getByRole('button', { name: 'Copy answer' }).waitFor({ timeout: 90_000 });
    const text = (await answer.innerText()).replace(/\s+/g, ' ');
    if (text.length < 40) throw new Error(`answer too short: ${text}`);
    return `${text.length} chars: “${text.slice(0, 120)}…”`;
  });

  await step('reload keeps the conversation', async () => {
    await page.reload();
    await page.getByRole('article', { name: 'CodeBloom answer' }).first().getByRole('button', { name: 'Copy answer' }).waitFor({ timeout: 30_000 });
    await page.getByText(QUESTION).first().waitFor({ timeout: 10_000 });
  });

  await step('a second browser cannot open it', async () => {
    const other = await browser.newContext();
    const p2 = await other.newPage();
    await p2.goto(`${BASE}/chat?setup=skip`);
    await p2.getByRole('heading', { name: 'Programming, explained simply.' }).waitFor({ timeout: 30_000 });
    await p2.goto(conversationUrl);
    await p2.getByRole('heading', { name: /couldn.t find that conversation/ }).waitFor({ timeout: 30_000 });
    await other.close();
  });

  await step('Delete all my data → fresh workspace', async () => {
    await page.goto(`${BASE}/settings`);
    await page.getByRole('button', { name: 'Delete my data…' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete my data', exact: true }).click();
    await page.waitForURL(/\/onboarding$/, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Use defaults' }).click();
    await page.getByText('Your conversations will appear here.').waitFor({ timeout: 30_000 });
  });
} catch {
  // reported below
} finally {
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name} (${r.ms} ms)${r.note ? ` — ${r.note}` : ''}`);
const failed = results.some((r) => !r.ok) || results.length < 5;
console.log(failed ? `\nLive smoke FAILED against ${BASE}` : `\nLive smoke passed against ${BASE}`);
process.exit(failed ? 1 : 0);
