/**
 * Gemini E2E Smoke Test  @real-site
 * Requires: active Google session
 * Run: RUN_REAL_SITE_TESTS=1 npx playwright test tests/e2e/gemini-smoke.spec.ts
 *
 * Starter selectors (adjust if selfTest fails at runtime):
 *   input:    rich-textarea .ql-editor  (or shadowRoot)
 *   submit:   button.send-button | button[aria-label*="Send"]
 *   response: message-content
 */
import { test, expect } from '@playwright/test';

test.describe('Gemini adapter smoke @real-site', () => {
  test.skip(!process.env['RUN_REAL_SITE_TESTS'], 'Set RUN_REAL_SITE_TESTS=1');

  test('rich-textarea custom element present', async ({ page }) => {
    await page.goto('https://gemini.google.com/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('rich-textarea')).toBeAttached({ timeout: 15000 });
  });

  test('Quill editor found in light or shadow DOM', async ({ page }) => {
    await page.goto('https://gemini.google.com/');
    await page.waitForLoadState('networkidle');
    const editor = page.locator('rich-textarea .ql-editor');
    const count = await editor.count();
    if (count > 0) {
      await expect(editor).toBeVisible({ timeout: 5000 });
    } else {
      const found = await page.evaluate(() => {
        const rt = document.querySelector('rich-textarea');
        return !!(rt?.shadowRoot?.querySelector?.('.ql-editor'));
      });
      expect(found, '.ql-editor must exist in light or shadow DOM').toBe(true);
    }
  });

  test('send button attached', async ({ page }) => {
    await page.goto('https://gemini.google.com/');
    await page.waitForLoadState('networkidle');
    const btn = page.locator('button.send-button, button[aria-label*="Send"]').first();
    await expect(btn).toBeAttached({ timeout: 10000 });
  });
});
