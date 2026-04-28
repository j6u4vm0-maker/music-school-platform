import { test, expect } from '@playwright/test';

test('Reproduction: Create Booking Flow', async ({ page }) => {
  // 1. Go to schedule page
  await page.goto('/schedule');
  
  // Wait for loading to clear
  await page.waitForSelector('text=驗證身份安全環境中...', { state: 'hidden', timeout: 15000 });
  
  // 2. Click a cell to open booking modal (e.g., first room at 10:00)
  // Cells have 'cursor-pointer hover:bg-[#c4a484]/20' classes
  const cell = page.locator('.group\\/cell').first();
  await cell.click();
  
  // 3. Verify modal is open
  await expect(page.getByText('新增預約資訊 +')).toBeVisible();
  
  // 4. Fill form (Selecting student via combobox)
  // Fill the combobox input
  const studentInput = page.getByPlaceholder('輸入姓名或電話搜尋...');
  await studentInput.fill('admin'); // Assuming there's a student named admin or something similar
  await page.waitForTimeout(1000);
  
  // Select the first option from combobox
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  // Fill other fields if needed (though they have defaults)
  await page.locator('input[name="courseName"]').fill('測試鋼琴課');
  
  // 5. Click the submit button
  const submitBtn = page.getByRole('button', { name: '確認並建立預約紀錄' });
  await expect(submitBtn).toBeEnabled();
  
  console.log('Clicking the confirm button...');
  await submitBtn.click();
  
  // 6. Wait for modal to close
  // If it doesn't close, it means there's a bug
  try {
    await expect(page.getByText('新增預約資訊 +')).toBeHidden({ timeout: 10000 });
    console.log('SUCCESS: Modal closed after clicking.');
  } catch (e) {
    console.error('FAILURE: Modal did not close after 10s. The button might be broken or an error occurred.');
    
    // Check if there are any console errors
    const errors = await page.evaluate(() => window.performance.getEntriesByType('resource').filter(r => (r as any).responseStatus >= 400).map(r => r.name));
    console.log('Failed resources:', errors);
    
    throw e;
  }
});
