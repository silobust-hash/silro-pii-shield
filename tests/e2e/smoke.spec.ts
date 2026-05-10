import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '../../dist');

test('확장 프로그램이 정상 로드되고 service worker가 동작한다', async () => {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });

  const sw = await context.waitForEvent('serviceworker', { timeout: 5000 });
  expect(sw).toBeDefined();
  expect(sw.url()).toContain('service-worker');

  await context.close();
});
