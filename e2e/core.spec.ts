import { test, expect } from '@playwright/test';
test('homeowner creates a project, bill, partial payment and matching report on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/register');
  await page.getByLabel('Name', { exact: true }).fill('Mobile Homeowner');
  await page.getByLabel('Email address').fill(`e2e-${Date.now()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('A-secure-password-2026');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('button', { name: 'Create project' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Project name').fill('My family home');
  await dialog.getByLabel('Planned budget').fill('100000');
  await dialog.getByRole('button', { name: 'Save record' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Add expense', exact: true }).last().click();
  const billDialog = page.getByRole('dialog');
  await billDialog.getByLabel('Description', { exact: true }).fill('Cement · 100 bags');
  await billDialog.getByLabel('Amount (₹)', { exact: true }).fill('40000');
  await billDialog.getByLabel('Payment status').selectOption('partial');
  await billDialog.getByLabel('Paid now (₹)').fill('15000');
  await billDialog.getByRole('button', { name: 'Add expense', exact: true }).click();
  await expect(billDialog).not.toBeVisible();
  await page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('link', { name: 'Expenses' })
    .click();
  await page.locator('.mobile-record').filter({ hasText: 'Cement · 100 bags' }).click();
  await expect(page.getByRole('dialog').getByText('₹25,000', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Record payment' }).click();
  const pd = page.getByRole('dialog');
  await pd.getByLabel('Amount (₹)', { exact: true }).fill('10000');
  await pd.getByLabel('Allocation amount').fill('10000');
  await pd.getByRole('button', { name: 'Save record' }).click();
  await expect(pd).not.toBeVisible();
  await page.goto('/app/reports');
  await expect(page.getByRole('heading', { name: 'Final construction cost' })).toBeVisible();
  const totals = page.locator('.report-totals');
  await expect(totals).toContainText('₹40,000');
  await expect(totals).toContainText('₹25,000');
  await expect(totals).toContainText('₹15,000');
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download CSV' }).click();
  await expect((await download).suggestedFilename()).toBe('gharkhata-final.csv');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test('isolated demo renders all modules and supports a progress update', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the live demo' }).click();
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await expect(page.locator('.demo-banner')).toContainText('Fictional demo');
  for (const [route, heading] of [
    ['expenses', 'Expenses'],
    ['payments', 'Payments'],
    ['vendors', 'Vendors & contractors'],
    ['labour', 'Labour'],
    ['materials', 'Materials & stock'],
    ['progress', 'Daily progress'],
    ['budget', 'Budget planner'],
    ['tasks', 'Tasks & reminders'],
    ['reports', 'Reports'],
    ['settings', 'Settings & team'],
  ]) {
    await page.goto('/app/' + route);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await page.goto('/app');
  await page.getByRole('button', { name: 'All time', exact: true }).click();
  await page.getByLabel('Category in invoice').selectOption('Cement');
  await expect(page.locator('.stat-card').nth(1)).toContainText('₹40,000');
  await expect(page.locator('.stat-card').nth(2)).toContainText('₹25,000');
  await expect(page.locator('.stat-card').nth(3)).toContainText('₹15,000');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByText('Recorded construction cost', { exact: true })).toBeVisible();
  await page.goto('/app/progress');
  await page.getByRole('button', { name: 'Add progress update' }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Work completed').fill('First-floor shutters ready');
  await d.getByRole('button', { name: 'Save record' }).click();
  await expect(d).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'First-floor shutters ready' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('draft retry survives an uncertain response; private photo, Hindi and dark mode work', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the live demo' }).click();
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('link', { name: 'Expenses' })
    .click();
  await page.getByRole('button', { name: 'Add expense', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Description', { exact: true }).fill('Uncertain-response draft');
  await dialog.getByLabel('Amount (₹)', { exact: true }).fill('123.45');
  await page.route('**/api/projects/*/records/bill', async (route) => {
    await route.fetch();
    await route.abort('connectionfailed');
  });
  await dialog.getByRole('button', { name: 'Add expense', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('unconfirmed');
  await page.unroute('**/api/projects/*/records/bill');
  await page.reload();
  await page.getByRole('button', { name: 'Add expense', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Description', { exact: true })).toHaveValue(
    'Uncertain-response draft',
  );
  await expect(dialog.getByText('Unsynced draft on this device')).toBeVisible();
  await dialog.getByRole('button', { name: 'Add expense', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.locator('.mobile-record').filter({ hasText: 'Uncertain-response draft' }),
  ).toHaveCount(1);
  await page.goto('/app/progress');
  await page.getByRole('button', { name: 'Add progress update' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Work completed').fill('Private photo upload');
  await dialog.locator('input[type=file]').setInputFiles('client/public/icon-192.png');
  await expect(dialog.getByRole('link', { name: 'icon-192.png' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Save record' }).click();
  await expect(dialog).not.toBeVisible();
  const diary = page.locator('.timeline-card').filter({ hasText: 'Private photo upload' });
  await expect(diary.locator('img')).toBeVisible();
  await expect(diary.locator('img')).toHaveJSProperty('naturalWidth', 192);
  await page.goto('/app/settings');
  await page.getByRole('button', { name: 'Profile & appearance' }).click();
  await page.getByLabel('Language').selectOption('hi');
  await page.getByRole('button', { name: 'गहरा', exact: true }).click();
  await page.getByRole('button', { name: 'रिकॉर्ड सहेजें', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(
    page
      .getByRole('navigation', { name: 'Mobile navigation' })
      .getByRole('link', { name: 'खर्चे' }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 760 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});
