import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

// E2E tests run against the static build served by a lightweight HTTP server.
// `astro dev` uses the Cloudflare workerd runtime which exits immediately on
// Windows environments without a configured Cloudflare account (ASSETS binding
// conflict). Running against the static build is the correct approach for
// CI/CD anyway, as it tests the actual production artifact.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx astro preview --port 4321',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
