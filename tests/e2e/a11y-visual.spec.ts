import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Accessibility (axe, WCAG 2.1 A/AA) and screenshots at 1440 and 390 for each screen in
// design/screens.json. Screenshots land in test-results/screens/ for side-by-side review with
// design/screenshots (TESTING.md "Visual": reviewed by eye, not a pixel contract).

const SHOTS = 'test-results/screens';

async function audit(page: Page, name: string) {
  // Let entrance animations settle so colour-contrast checks see final colours.
  await page.waitForTimeout(900);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const blocking = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  for (const v of result.violations) {
    console.log(`[axe] ${name}: ${v.impact} ${v.id} (${v.nodes.length}) — ${v.help}`);
  }
  expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`), `${name} serious/critical axe violations`).toEqual([]);
}

async function shoot(page: Page, name: string) {
  // Sticky header/sidebar render at the current scroll offset in a full-page capture.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function openChat(page: Page) {
  const onboarded = page.waitForResponse((r) => r.url().includes('/rpc/complete_onboarding') && r.ok());
  await page.goto('/chat?setup=skip');
  await onboarded;
  await expect(page.getByRole('heading', { name: 'Programming, explained simply.' })).toBeVisible();
}

async function askAndWait(page: Page, text: string, n: number, box = 'Message CodeBloom') {
  await page.getByRole('textbox', { name: box }).fill(text);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('article', { name: 'CodeBloom answer' }).nth(n - 1).getByRole('button', { name: 'Copy answer' })).toBeVisible({ timeout: 20_000 });
}

for (const width of [1440, 390] as const) {
  test.describe(`screens at ${width}px`, () => {
    test.use({ viewport: { width, height: width === 390 ? 844 : 900 } });

    test(`landing · onboarding · 404 (${width})`, async ({ page }) => {
      await page.goto('/');
      await audit(page, `landing-${width}`);
      await shoot(page, `landing-${width}`);

      await page.goto('/onboarding');
      await expect(page.getByRole('heading', { name: 'How should CodeBloom explain things?' })).toBeVisible();
      await audit(page, `onboarding-${width}`);
      await shoot(page, `onboarding-${width}`);

      await page.goto('/this-page-does-not-exist');
      await expect(page.getByRole('heading', { name: /This page doesn.t exist/ })).toBeVisible();
      await audit(page, `not-found-${width}`);
    });

    test(`chat: new · explain · debug · practice (${width})`, async ({ page }) => {
      await openChat(page);
      await audit(page, `chat-new-${width}`);
      await shoot(page, `chat-new-${width}`);

      await askAndWait(page, 'When should I use let instead of const?', 1);
      await audit(page, `chat-explain-${width}`);
      await shoot(page, `chat-explain-${width}`);

      await page.goto('/chat');
      await expect(page.getByRole('heading', { name: 'Programming, explained simply.' })).toBeVisible();
      const modeGroup = page.getByRole('group', { name: 'Mode' }).first();
      await modeGroup.getByRole('button', { name: /Debug/ }).click();
      await askAndWait(page, 'Why do I get an IndexError?\n```python\ndef average(scores):\n    total = 0\n    for i in range(len(scores)):\n        total += scores[i + 1]\n    return total / len(scores)\n```', 1);
      await audit(page, `chat-debug-${width}`);
      await shoot(page, `chat-debug-${width}`);

      await page.goto('/chat');
      await expect(page.getByRole('heading', { name: 'Programming, explained simply.' })).toBeVisible();
      await page.getByRole('button', { name: /Give me a small loop exercise/ }).click();
      await page.getByRole('button', { name: 'Send message' }).click();
      await expect(page.getByRole('article', { name: 'Exercise' })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('article', { name: 'CodeBloom answer' }).first().getByRole('button', { name: 'Copy answer' })).toBeVisible({ timeout: 20_000 });
      await askAndWait(page, 'My answer:\n```python\ndef count_vowels(word):\n    count = 0\n    for letter in word:\n        if letter == "aeiou":\n            count += 1\n    return count\n```', 2, 'Send your next attempt');
      await audit(page, `chat-practice-${width}`);
      await shoot(page, `chat-practice-${width}`);
    });

    test(`saved · settings (${width})`, async ({ page }) => {
      await openChat(page);
      await askAndWait(page, 'What is a variable in Python?', 1);
      await page.getByRole('article', { name: 'CodeBloom answer' }).first().getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByText('Saved to your explanations')).toBeVisible();

      await page.goto('/saved');
      await expect(page.getByRole('article').filter({ hasText: 'What is a variable in Python?' })).toBeVisible();
      await audit(page, `saved-${width}`);
      await shoot(page, `saved-${width}`);

      await page.goto('/settings');
      await expect(page.getByRole('heading', { name: 'Learning preferences' })).toBeVisible();
      await audit(page, `settings-${width}`);
      await shoot(page, `settings-${width}`);

      if (width === 390) {
        await page.getByRole('button', { name: 'Open menu' }).click();
        await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeVisible();
        await audit(page, `mobile-drawer-${width}`);
        await shoot(page, `mobile-drawer-${width}`);
      }
    });
  });
}
