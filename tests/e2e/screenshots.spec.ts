import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Capture design review screenshots', () => {
  test.beforeAll(() => {
    const dir = path.join(process.cwd(), 'screenshots');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  test('Capture all screenshots', async ({ page }) => {
    // 1. Homepage
    await page.goto('/');
    await page.waitForTimeout(1500); // Let Big-O curve draw animation finish
    await page.screenshot({ path: 'screenshots/homepage.png', fullPage: true });

    // 2. Solution Analyzer
    await page.goto('/analyze');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/analyze.png', fullPage: true });

    // 3. Guide page
    await page.goto('/guides/blind75-vs-neetcode150-vs-grind75');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/guide.png', fullPage: true });
  });
});
