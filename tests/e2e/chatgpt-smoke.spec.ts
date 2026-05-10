/**
 * ChatGPT E2E Smoke Test  @real-site
 * Requires: active ChatGPT session in Chrome profile
 * Run: RUN_REAL_SITE_TESTS=1 npx playwright test tests/e2e/chatgpt-smoke.spec.ts
 *
 * Starter selectors (adjust if selfTest fails at runtime):
 *   input:    div#prompt-textarea[contenteditable="true"]
 *   submit:   button[data-testid="send-button"]
 *   response: div[data-message-author-role="assistant"]
 */
import { test, expect } from '@playwright/test';

test.describe('ChatGPT adapter smoke @real-site', () => {
  test.skip(!process.env['RUN_REAL_SITE_TESTS'], 'Set RUN_REAL_SITE_TESTS=1');

  test('input element found by adapter selector', async ({ page }) => {
    await page.goto('https://chatgpt.com/');
    const input = page.locator('div#prompt-textarea[contenteditable="true"]');
    await expect(input).toBeVisible({ timeout: 15000 });
  });

  test('send button attached in DOM', async ({ page }) => {
    await page.goto('https://chatgpt.com/');
    await page.waitForLoadState('networkidle');
    const btn = page.locator('button[data-testid="send-button"]');
    await expect(btn).toBeAttached({ timeout: 10000 });
  });

  test('input accepts text without errors', async ({ page }) => {
    await page.goto('https://chatgpt.com/');
    const input = page.locator('div#prompt-textarea[contenteditable="true"]');
    await input.waitFor({ state: 'visible', timeout: 15000 });
    await input.click();
    await input.type('900101-1234567');
    const value = await input.innerText();
    expect(value).toBeTruthy();
  });
});
