/**
 * Perplexity E2E Smoke Test  @real-site
 * No auth required for basic page load
 * Run: RUN_REAL_SITE_TESTS=1 npx playwright test tests/e2e/perplexity-smoke.spec.ts
 *
 * Starter selectors (adjust if selfTest fails at runtime):
 *   input:    textarea[placeholder*="Ask"]
 *   submit:   button[aria-label*="Submit"]
 *   response: .prose
 */
import { test, expect } from '@playwright/test';

test.describe('Perplexity adapter smoke @real-site', () => {
  test.skip(!process.env['RUN_REAL_SITE_TESTS'], 'Set RUN_REAL_SITE_TESTS=1');

  test('textarea found', async ({ page }) => {
    await page.goto('https://www.perplexity.ai/');
    const textarea = page.locator('textarea[placeholder*="Ask"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });
  });

  test('submit button attached', async ({ page }) => {
    await page.goto('https://www.perplexity.ai/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('button[aria-label*="Submit"]')).toBeAttached({ timeout: 10000 });
  });

  test('textarea accepts input', async ({ page }) => {
    await page.goto('https://www.perplexity.ai/');
    const textarea = page.locator('textarea[placeholder*="Ask"]');
    await textarea.waitFor({ state: 'visible', timeout: 15000 });
    await textarea.fill('900101-1234567');
    expect(await textarea.inputValue()).toBeTruthy();
  });
});
