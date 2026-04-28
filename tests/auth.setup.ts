import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Go to login page
  await page.goto('/login', { timeout: 30000 });

  // Fill credentials
  await page.getByPlaceholder('example@7th-art.com').fill('admin@7th.com');
  await page.getByPlaceholder('••••••••').fill('admin777');

  // Click login button
  await page.getByRole('button', { name: '確認登入系統' }).click();

  // Wait for navigation to dashboard
  await page.waitForURL('/');

  // Verify we are on the dashboard (Navbar should be visible)
  await expect(page.getByText('核心功能模組')).toBeVisible();

  // Save storage state
  await page.context().storageState({ path: authFile });
});
