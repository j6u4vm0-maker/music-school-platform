import { test, expect } from '@playwright/test';

const TARGET_PAGES = [
  '/',
  '/schedule',
  '/database',
  '/finance',
  '/inventory',
  '/ledger',
  '/teacher-salary',
  '/holidays',
  '/settings',
];

test.describe('UI Interaction Crawler', () => {
  
  for (const url of TARGET_PAGES) {
    test(`Crawler: Audit interactions on ${url}`, async ({ page }) => {
      const runtimeErrors: string[] = [];

      page.on('pageerror', (exception) => {
        // Ignore permission errors as they are data-level, not UI crashes
        if (exception.message.includes('Missing or insufficient permissions')) return;
        runtimeErrors.push(exception.message);
      });

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (text.includes('Missing or insufficient permissions')) return;
          if (text.includes('firestore.googleapis.com')) return;
          runtimeErrors.push(`[Console Error] ${text}`);
        }
      });

      await page.goto(url, { waitUntil: 'domcontentloaded' });
      
      // Wait for Auth loading
      await page.waitForSelector('text=驗證身份安全環境中...', { state: 'hidden', timeout: 10000 }).catch(() => {});
      
      // Wait for content
      await page.waitForTimeout(1000); 

      // Get buttons
      const buttons = page.locator('button').filter({ visible: true });
      const count = await buttons.count();
      
      console.log(`Auditing ${count} buttons on ${url}`);

      // Click up to 2 buttons to keep it fast
      for (let i = 0; i < Math.min(count, 2); i++) {
        try {
          const btn = buttons.nth(i);
          const text = await btn.innerText().catch(() => '');
          // Destructive check
          if (text.match(/刪除|Delete|確認|確定/)) continue;

          await btn.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(300);
          
          // Close modals
          const closeBtn = page.locator('button:has-text("✕"), button:has-text("取消")').first();
          if (await closeBtn.isVisible()) {
            await closeBtn.click().catch(() => {});
          }
        } catch (e) {}
      }

      expect(runtimeErrors, `頁面 ${url} 發生關鍵錯誤: \n${runtimeErrors.join('\n')}`).toHaveLength(0);
    });
  }
});
