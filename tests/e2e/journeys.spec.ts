import { expect, test, type Page } from '@playwright/test';

// TESTING.md "E2E journeys", run against the production build + tests/e2e/fake-supabase.mjs.

const emptyHeading = (page: Page) => page.getByRole('heading', { name: 'Programming, explained simply.' });
const composer = (page: Page) => page.getByRole('textbox', { name: 'Message CodeBloom' });
const answers = (page: Page) => page.getByRole('article', { name: 'CodeBloom answer' });

/** Open a ready workspace without the onboarding step. */
async function openChat(page: Page) {
  const onboarded = page.waitForResponse((r) => r.url().includes('/rpc/complete_onboarding') && r.ok());
  await page.goto('/chat?setup=skip');
  await onboarded;
  await expect(emptyHeading(page)).toBeVisible();
}

/** Wait until the newest answer has finished streaming and shows its action bar. */
async function waitForAnswer(page: Page, count: number) {
  await expect(answers(page)).toHaveCount(count, { timeout: 20_000 });
  await expect(answers(page).nth(count - 1).getByRole('button', { name: 'Copy answer' })).toBeVisible({ timeout: 20_000 });
}

async function ask(page: Page, text: string) {
  await composer(page).fill(text);
  await page.getByRole('button', { name: 'Send message' }).click();
}

test('1 · landing → start learning → onboarding → chat, with no login screen anywhere', async ({ page }) => {
  const paths: string[] = [];
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) paths.push(new URL(f.url()).pathname);
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Programming, explained');
  await expect(page.getByText('No sign-up, no password. Your chats stay private to this browser.')).toBeVisible();
  await page.getByRole('link', { name: 'Start learning' }).first().click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('heading', { name: 'How should CodeBloom explain things?' })).toBeVisible();
  await page.getByRole('button', { name: 'JavaScript', exact: true }).click();
  await page.getByRole('radio', { name: /Some basics/ }).click();
  await page.getByRole('button', { name: 'Detailed', exact: true }).click();
  await page.getByRole('button', { name: 'Roman Urdu · beta' }).click();
  await expect(page.getByRole('progressbar', { name: 'Setup progress' })).toHaveAttribute('aria-valuenow', '4');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/\/chat$/);
  await expect(emptyHeading(page)).toBeVisible();
  await expect(page.locator('#lang-select')).toHaveValue('javascript');

  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.locator('#set-lang')).toHaveValue('javascript');
  await expect(page.locator('#set-level')).toHaveValue('basics');
  await expect(page.locator('#set-expl')).toHaveValue('roman_ur');
  await expect(page.getByRole('group', { name: 'Answer length' }).getByRole('button', { name: 'Detailed' })).toHaveAttribute('aria-pressed', 'true');

  expect(paths.filter((p) => /log-?in|sign-?(up|in)|auth/i.test(p))).toEqual([]);
  await expect(page.getByText(/\b(sign in|log in|create an account)\b/i)).toHaveCount(0);
});

test('2 · skip setup → chat; onboarding is not shown again', async ({ page }) => {
  await page.goto('/');
  const onboarded = page.waitForResponse((r) => r.url().includes('/rpc/complete_onboarding') && r.ok());
  await page.getByRole('link', { name: 'Skip setup, open a chat' }).click();
  await onboarded;
  await expect(page).toHaveURL(/\/chat$/);
  await expect(emptyHeading(page)).toBeVisible();

  await page.reload();
  await expect(emptyHeading(page)).toBeVisible();
  await expect(page).toHaveURL(/\/chat$/);

  // "Start learning" takes a returning learner straight back to their chats.
  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/chat$/);
});

test('3 · starter → answer → copy code → follow-up → debug mode → feedback → save/undo → rename → delete', async ({ page }) => {
  await openChat(page);

  // Starter card fills the composer with its mode/language; sending streams a structured answer.
  await page.getByRole('button', { name: /What is a variable in Python\?/ }).click();
  await expect(composer(page)).toHaveValue('What is a variable in Python?');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/);
  await waitForAnswer(page, 1);
  const first = answers(page).first();
  await expect(first.getByText('A variable is a name that points to a value', { exact: false })).toBeVisible();
  await expect(first.getByText('Common mistake')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Conversations' }).getByText('What is a variable in Python?')).toBeVisible();

  // Copy code: button turns into "Copied" and a toast confirms it.
  await first.getByRole('button', { name: 'Copy code' }).first().click();
  await expect(first.getByRole('button', { name: 'Copied' })).toBeVisible();
  await expect(page.getByText('Code copied to clipboard')).toBeVisible();

  // Follow-up chip sends a second turn in the same conversation.
  await page.getByRole('button', { name: 'Explain it more simply' }).click();
  await waitForAnswer(page, 2);

  // Switch to Debug and ask about broken code: the answer is marked "Not executed".
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: /Debug/ }).click();
  await ask(page, 'Why do I get an IndexError?\n```python\ndef average(scores):\n    total = 0\n    for i in range(len(scores)):\n        total += scores[i + 1]\n    return total / len(scores)\n```');
  await waitForAnswer(page, 3);
  await expect(answers(page).nth(2).getByText('Not executed — based on reading your code')).toBeVisible();
  await expect(answers(page).nth(2).getByRole('button', { name: 'Copy fix code' })).toBeVisible();

  // Feedback.
  await answers(page).nth(2).getByRole('button', { name: 'Helpful', exact: true }).click();
  await expect(page.getByText('Thanks — that helps us improve.')).toBeVisible();

  // Save the first answer, find it on the Saved page, remove it and undo.
  await first.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved to your explanations')).toBeVisible();
  await expect(first.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true');
  const conversationUrl = page.url();
  await page.getByRole('link', { name: /Saved explanations/ }).click();
  await expect(page).toHaveURL(/\/saved$/);
  const card = page.getByRole('article').filter({ hasText: 'What is a variable in Python?' });
  await expect(card).toBeVisible();
  await expect(page.getByText('1 explanation', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: /Remove .* from saved/ }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('article').filter({ hasText: 'What is a variable in Python?' })).toBeVisible();

  // Rename from the conversation header.
  await page.goto(conversationUrl);
  await waitForAnswer(page, 3);
  await page.getByRole('button', { name: 'Rename conversation' }).click();
  const titleBox = page.getByRole('textbox', { name: 'Conversation title', exact: true });
  await titleBox.fill('Variables, explained');
  await titleBox.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Variables, explained' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Conversations' }).getByText('Variables, explained')).toBeVisible();

  // Delete it.
  await page.getByRole('button', { name: 'Conversation actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete conversation' }).click();
  await expect(page.getByRole('dialog', { name: 'Delete “Variables, explained”?' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole('navigation', { name: 'Conversations' }).getByText('Variables, explained')).toHaveCount(0);
});

test('3b · stop keeps the partial answer as interrupted; retry answers again', async ({ page }) => {
  await openChat(page);
  await ask(page, 'What is a variable? [slow]');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await expect(answers(page).first().getByText('Short answer')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByText('Answer interrupted')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop' })).toHaveCount(0);

  // The saved state agrees after a reload.
  await page.reload();
  await expect(page.getByText('Answer interrupted')).toBeVisible();

  await page.getByRole('button', { name: /Retry/ }).first().click();
  await expect(answers(page).last().getByRole('button', { name: 'Copy answer' })).toBeVisible({ timeout: 20_000 });
});

test('3c · refreshing during generation picks the saved answer back up', async ({ page }) => {
  await openChat(page);
  await ask(page, 'Explain variables [slow]');
  await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/);
  await expect(answers(page).first().getByText('Short answer')).toBeVisible({ timeout: 15_000 });
  await page.reload();
  // The server keeps writing; the page polls until the answer is saved.
  await expect(answers(page).first().getByRole('button', { name: 'Copy answer' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /What is the difference between a variable and a constant/ })).toBeVisible();
});

test('4 · a second browser is a second learner and cannot open the first one’s chat', async ({ page, browser }) => {
  await openChat(page);
  await ask(page, 'What is a variable in Python?');
  await waitForAnswer(page, 1);
  const url = page.url();

  const other = await browser.newContext();
  const page2 = await other.newPage();
  await openChat(page2);
  await expect(page2.getByRole('navigation', { name: 'Conversations' }).getByText('What is a variable in Python?')).toHaveCount(0);
  await page2.goto(url);
  await expect(page2.getByRole('heading', { name: /couldn.t find that conversation/ })).toBeVisible();
  await other.close();
});

test('5 · clearing cookies starts a fresh, empty workspace', async ({ page, context }) => {
  await openChat(page);
  await ask(page, 'What is a variable in Python?');
  await waitForAnswer(page, 1);

  await context.clearCookies();
  await page.goto('/chat');
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole('button', { name: 'Use defaults' }).click();
  await expect(emptyHeading(page)).toBeVisible();
  await expect(page.getByText('Your conversations will appear here.')).toBeVisible();
});

test('6 · settings: delete all conversations, then delete all my data', async ({ page }) => {
  await openChat(page);
  await ask(page, 'What is a variable in Python?');
  await waitForAnswer(page, 1);
  await answers(page).first().getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved to your explanations')).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  // A preference change saves on its own.
  await page.locator('#set-lang').selectOption('sql');
  await expect(page.getByText('All changes saved')).toBeVisible();

  await page.getByRole('button', { name: 'Delete all…' }).click();
  await expect(page.getByRole('dialog', { name: 'Delete all conversations?' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete all', exact: true }).click();
  await expect(page.getByText('All conversations deleted')).toBeVisible();
  await expect(page.getByText('Your conversations will appear here.')).toBeVisible();

  await page.getByRole('button', { name: 'Delete my data…' }).click();
  await expect(page.getByRole('dialog', { name: 'Delete all your data?' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete my data', exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Use defaults' }).click();
  await expect(emptyHeading(page)).toBeVisible();
  await expect(page.locator('#lang-select')).toHaveValue('python'); // preferences were reset
  await page.getByRole('link', { name: /Saved explanations/ }).click();
  await expect(page.getByText('Nothing saved yet')).toBeVisible();
});

test('7 · route audit: there are no login, sign-up or auth callback pages', async ({ request }) => {
  for (const path of ['/login', '/signup', '/sign-in', '/auth/callback', '/auth/login']) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(404);
  }
});

test('8 · with anonymous sign-ins switched off, the server-side fallback still opens a private workspace', async ({ page, request }) => {
  const control = (anonymousDisabled: boolean) => request.post('http://localhost:54399/__control', { data: { anonymousDisabled } });
  await control(true);
  try {
    const refused = page.waitForResponse((r) => r.url().endsWith('/auth/v1/signup') && r.status() === 422);
    const fallback = page.waitForResponse((r) => r.url().endsWith('/functions/v1/session') && r.request().method() === 'POST');
    await openChat(page);
    await refused;
    expect((await fallback).status()).toBe(200);
    await ask(page, 'What is a variable in Python?');
    await waitForAnswer(page, 1);
    await page.reload();
    await waitForAnswer(page, 1); // the adopted session persists across reloads
  } finally {
    await control(false);
  }
});
