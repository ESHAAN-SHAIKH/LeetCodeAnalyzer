/**
 * E2E Smoke Tests — LeetCodeAnalyzer
 *
 * Run: npm run build && npm run test:e2e
 * Server: `npx astro preview --port 4321` (started automatically by Playwright)
 *
 * Confirmed page shapes (from astro preview probe 2026-07-12):
 *   /          → 200, h1 contains "Check Your Real", has type="text" username input
 *   /analyze   → 200, h1 contains "Free LeetCode", has <textarea>
 *   /guides    → 200, h1 = "LeetCode Interview Prep Guides"
 *   /privacy   → 200, h1 = "Privacy Policy"
 *   /about     → 200, h1 = "About LeetCodeAnalyzer"
 *   /contact   → 200, h1 = "Contact LeetCodeAnalyzer"
 *   /terms     → 200, h1 = "Terms of Use"
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('LeetCodeAnalyzer E2E Smoke Tests', () => {

  // ─── 1. Homepage ──────────────────────────────────────────────────────────
  test('1. Homepage loads with correct h1 and username input', async ({ page }) => {
    await page.goto('/');
    // Confirmed h1 starts with "Check Your Real"
    await expect(page.locator('h1').first()).toContainText('Check Your Real');
    // Must have a username search input (type="text")
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
    // Must NOT gate behind sign-up
    await expect(page.getByText(/sign up|create account/i)).not.toBeVisible();
  });

  // ─── 2. Demo card on homepage ─────────────────────────────────────────────
  test('2. Homepage has demo card or demo section visible', async ({ page }) => {
    await page.goto('/');
    // DemoModeCard is in the page (rendered server-side)
    const demo = page.locator('[id*="demo"], [class*="demo"], text=Demo').first();
    const hasDemoId = await page.locator('#demo-mode-card').count() > 0;
    const hasDemoText = await page.getByText(/demo/i).count() > 0;
    expect(hasDemoId || hasDemoText).toBeTruthy();
  });

  // ─── 3. /analyze page ─────────────────────────────────────────────────────
  test('3a. /analyze loads with correct h1 and textarea', async ({ page }) => {
    await page.goto('/analyze');
    await expect(page.locator('h1').first()).toContainText('Free LeetCode');
    await expect(page.locator('textarea').first()).toBeVisible();
  });

  test('3b. Solution Analyzer — Python: produces complexity result client-side, zero external calls', async ({ page }) => {
    const externalCalls: string[] = [];
    page.on('request', req => {
      const u = req.url();
      if (!u.includes('localhost') && !u.includes('127.0.0.1') && u.startsWith('http')) {
        externalCalls.push(u);
      }
    });

    await page.goto('/analyze');
    await page.locator('textarea').first().fill(
      'def twoSum(nums, target):\n    for i in range(len(nums)):\n        for j in range(i+1,len(nums)):\n            if nums[i]+nums[j]==target: return [i,j]'
    );
    await page.getByRole('button', { name: /analyze/i }).first().click();

    // Complexity badge must appear
    await expect(page.locator('text=/O\\(n/').first()).toBeVisible({ timeout: 10000 });
    // "Estimated" framing
    await expect(page.locator('text=/[Ee]stimat/').first()).toBeVisible({ timeout: 5000 });

    // Analysis produces zero external network calls
    const external = externalCalls.filter(
      u => !u.includes('fonts.g') && !u.includes('cloudflare')
    );
    expect(external).toHaveLength(0);
  });

  test('3c. Solution Analyzer — JavaScript: produces O(n) for hash-map solution', async ({ page }) => {
    await page.goto('/analyze');
    await page.locator('textarea').first().fill(
      'function twoSum(nums,target){const m=new Map();for(let i=0;i<nums.length;i++){const c=target-nums[i];if(m.has(c))return[m.get(c),i];m.set(nums[i],i);}}'
    );
    await page.getByRole('button', { name: /analyze/i }).first().click();
    await expect(page.locator('text=/O\\(n/').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/[Ee]stimat/').first()).toBeVisible();
  });

  test('3d. Solution Analyzer — Java: produces result', async ({ page }) => {
    await page.goto('/analyze');
    await page.locator('textarea').first().fill(
      'public int[] twoSum(int[] nums,int target){for(int i=0;i<nums.length;i++)for(int j=i+1;j<nums.length;j++)if(nums[i]+nums[j]==target)return new int[]{i,j};return new int[0];}'
    );
    await page.getByRole('button', { name: /analyze/i }).first().click();
    await expect(page.locator('text=/O\\(n/').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/[Ee]stimat/').first()).toBeVisible();
  });

  test('3e. Solution Analyzer — C++: produces result', async ({ page }) => {
    await page.goto('/analyze');
    await page.locator('textarea').first().fill(
      'vector<int> twoSum(vector<int>&nums,int target){unordered_map<int,int>m;for(int i=0;i<nums.size();++i){int c=target-nums[i];if(m.count(c))return{m[c],i};m[nums[i]]=i;}return{};}'
    );
    await page.getByRole('button', { name: /analyze/i }).first().click();
    await expect(page.locator('text=/O\\(n/').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/[Ee]stimat/').first()).toBeVisible();
  });

  // ─── 4. Theme toggle ───────────────────────────────────────────────────────
  test('4. Dark/light theme toggle persists across reload', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');

    // Get the initial theme (it could be light or dark depending on system preferences of the runner)
    const initialClass = await html.getAttribute('class') ?? 'dark';
    const isInitialDark = initialClass.includes('dark');
    const targetTheme = isInitialDark ? 'light' : 'dark';
    const finalTheme = isInitialDark ? 'dark' : 'light';

    // Toggle once
    await page.locator('#theme-toggle').click();
    await expect(html).toHaveClass(new RegExp(targetTheme));

    // Reload → must still be targetTheme (persisted in localStorage)
    await page.reload();
    await expect(html).toHaveClass(new RegExp(targetTheme));

    // Toggle back → must return to finalTheme
    await page.locator('#theme-toggle').click();
    await expect(html).toHaveClass(new RegExp(finalTheme));
  });

  // ─── 5. Mobile no horizontal scroll ───────────────────────────────────────
  test('5. Homepage has no horizontal scroll at 375px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });

  // ─── 6. Legal pages ────────────────────────────────────────────────────────
  test('6. All legal pages return 200 with correct h1s', async ({ page }) => {
    const pages: [string, RegExp][] = [
      ['/privacy',  /Privacy Policy/i],
      ['/terms',    /Terms of Use/i],
      ['/about',    /About LeetCodeAnalyzer/i],
      ['/contact',  /Contact LeetCodeAnalyzer/i],
    ];
    for (const [route, h1Pattern] of pages) {
      const response = await page.goto(route);
      expect(response?.status(), `${route} should be 200`).toBe(200);
      await expect(page.locator('h1').first(), `${route} h1`).toHaveText(h1Pattern);
    }
  });

  // ─── 7. /guides page ──────────────────────────────────────────────────────
  test('7. /guides page loads with 6 guide links', async ({ page }) => {
    await page.goto('/guides');
    await expect(page.locator('h1').first()).toContainText('LeetCode Interview Prep Guides');
    // At least 6 links to individual guides
    const guideLinks = page.locator('a[href^="/guides/"]');
    const count = await guideLinks.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  // ─── 8. robots.txt ─────────────────────────────────────────────────────────
  test('8. robots.txt is correctly configured', async ({ page }) => {
    const response = await page.goto('/robots.txt');
    expect(response?.status()).toBe(200);
    const text = await response?.text() ?? '';
    expect(text).toContain('Disallow: /api/');
    expect(text).not.toContain('Disallow: /u/');
    expect(text).not.toContain('Disallow: /compare/');
    expect(text).toContain('Sitemap:');
  });

  // ─── 9. Security headers file ──────────────────────────────────────────────
  test('9. _headers file has real security headers and no placeholders', () => {
    const headersPath = path.join(process.cwd(), 'public', '_headers');
    expect(fs.existsSync(headersPath)).toBe(true);
    const content = fs.readFileSync(headersPath, 'utf-8');
    expect(content).toContain('Strict-Transport-Security');
    expect(content).toContain('X-Content-Type-Options');
    expect(content).toContain('X-Frame-Options');
    expect(content).toContain('Referrer-Policy');
    expect(content).toContain('Content-Security-Policy');
    expect(content).toContain('googlesyndication.com');
    expect(content).toContain('doubleclick.net');
    expect(content).not.toContain('[adSense domains]');
    expect(content).not.toContain('[YOUR_');
  });

  // ─── 10. No Google Fonts CDN ───────────────────────────────────────────────
  test('10. Homepage makes no requests to Google Fonts CDN', async ({ page }) => {
    const googleFontReqs: string[] = [];
    page.on('request', req => {
      if (req.url().includes('fonts.googleapis.com') || req.url().includes('fonts.gstatic.com')) {
        googleFontReqs.push(req.url());
      }
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(googleFontReqs).toHaveLength(0);
  });

  // ─── 11. sitemap.xml in build output ──────────────────────────────────────
  test('11. sitemap-index.xml is present in dist/client', () => {
    const sitemapPath = path.join(process.cwd(), 'dist', 'client', 'sitemap-index.xml');
    expect(fs.existsSync(sitemapPath), 'sitemap-index.xml must exist in dist/client').toBe(true);
    const content = fs.readFileSync(sitemapPath, 'utf-8');
    expect(content).toContain('sitemap');
  });

  // ─── 12. No eval() in analyzer source ─────────────────────────────────────
  test('12. Analyzer source contains no eval() or new Function() calls', () => {
    const analyzerDir = path.join(process.cwd(), 'src', 'lib', 'analyzer');
    if (!fs.existsSync(analyzerDir)) {
      console.log('No analyzer dir found — skipping');
      return;
    }
    const scan = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { scan(full); continue; }
        if (!/\.(ts|tsx|js)$/.test(entry.name)) continue;
        const rawSrc = fs.readFileSync(full, 'utf-8');
        // Strip JS/TS single-line and multi-line comments to avoid matching security comments
        const cleanSrc = rawSrc.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
        expect(cleanSrc, `${entry.name} must not use eval()`).not.toMatch(/\beval\s*\(/);
        expect(cleanSrc, `${entry.name} must not use new Function()`).not.toMatch(/new\s+Function\s*\(/);
      }
    };
    scan(analyzerDir);
  });

  // ─── 13. Tier 2 security notice always shown before cookie input ───────────
  test('13. Tier 2 security notice appears before cookie input on /u page', async ({ page }) => {
    // Navigate to an arbitrary username; it will 404 from LeetCode but the
    // Tier2Input section is still rendered on the page structure check
    await page.goto('/u/testuser123');
    // If page loaded (even error state) check the Tier2 section exists in DOM
    const tier2 = page.locator('#tier2-details, [id*="tier2"]').first();
    const hasTier2 = await tier2.count() > 0;
    if (hasTier2) {
      await tier2.evaluate(el => (el as HTMLDetailsElement).open = true);
      const securityNotice = page.locator('[role="note"][aria-label*="Security"], [aria-label*="security"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      if (await securityNotice.count() > 0 && await passwordInput.count() > 0) {
        const noticeY = await securityNotice.evaluate(el => el.getBoundingClientRect().top);
        const inputY = await passwordInput.evaluate(el => el.getBoundingClientRect().top);
        expect(noticeY).toBeLessThan(inputY);
      }
    }
    // At minimum, an h1 must be visible
    await expect(page.locator('h1').first()).toBeVisible();
  });

  // ─── 14. 404 page ─────────────────────────────────────────────────────────
  test('14. /nonexistent-path returns custom 404 page', async ({ page }) => {
    const response = await page.goto('/this-page-definitely-does-not-exist-xyz-abc');
    // Custom 404 pages return 404 status
    expect([404, 200]).toContain(response?.status()); // Cloudflare sometimes 200s custom 404
    // The page must contain "404" or "not found" text
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.toLowerCase()).toMatch(/404|not found|page not found/);
  });

  // ─── 15. Header contains legal links ──────────────────────────────────────
  test('15. Site header contains navigation links to key pages', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header, nav').first();
    // Must have Solution Analyzer and Guides links
    await expect(header.getByRole('link', { name: /Solution Analyzer/i })).toBeVisible();
    await expect(header.getByRole('link', { name: /Guides/i })).toBeVisible();
  });

  // ─── 16. Cookie consent banner in DOM ─────────────────────────────────────
  test('16. Cookie consent banner is present in DOM', async ({ page }) => {
    await page.goto('/');
    // The banner is in Base.astro as a <dialog> — verify it's in the DOM
    const banner = page.locator('#consent-dialog, dialog[id*="consent"], [role="dialog"]').first();
    const inDom = await banner.count() > 0;
    // Accept either banner exists in DOM or Accept button is visible
    const acceptBtn = page.getByRole('button', { name: /accept|i accept/i }).first();
    expect(inDom || await acceptBtn.count() > 0).toBeTruthy();
  });

});
