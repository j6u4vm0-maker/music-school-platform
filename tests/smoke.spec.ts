import { test, expect } from '@playwright/test';

test.describe('Dashboard Smoke Test', () => {
  test('should display all core modules', async ({ page }) => {
    await page.goto('/');

    // Wait for loading to clear
    await page.waitForSelector('text=驗證身份安全環境中...', { state: 'hidden', timeout: 10000 }).catch(() => {});

    // Check main heading
    await expect(page.getByText('核心功能模組')).toBeVisible({ timeout: 10000 });

    // Check core modules
    const modules = ['課程排程', '財務與核銷', '每日對帳單', '進銷存與零售'];
    for (const moduleName of modules) {
      await expect(page.getByText(moduleName, { exact: false }).first()).toBeVisible();
    }
  });

  test('should navigate to schedule page', async ({ page }) => {
    await page.goto('/');
    
    // Click on schedule module card
    await page.getByText('課程排程').first().click();
    
    // Should be redirected to /schedule
    await page.waitForURL('**/schedule', { timeout: 10000 });
    
    // Verify specific elements in schedule page
    // Using a more flexible check for the view title
    const header = page.locator('h3').filter({ hasText: /日曆表|週課表/ });
    await expect(header.first()).toBeVisible({ timeout: 10000 });
  });
});
