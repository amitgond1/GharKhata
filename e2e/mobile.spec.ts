import { test, expect } from '@playwright/test';
test.use({ actionTimeout: 15000, navigationTimeout: 20000 });

async function demo(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the live demo' }).click();
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
}

test('landing and account forms fit narrow phones', async ({ page }) => {
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['/', '/login', '/register', '/forgot-password']) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${route} at ${width}px`,
      ).toBeTruthy();
      for (const input of await page.locator('input:visible').all())
        expect(
          await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
        ).toBeGreaterThanOrEqual(16);
    }
  }
});

test('all modules and report types fit phone and tablet widths', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await demo(page);
  const routes = [
    ['', /Welcome back/],
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
  ] as const;
  for (const width of [320, 360, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [route, heading] of routes) {
      await page.goto('/app' + (route ? '/' + route : ''));
      await expect(
        page.getByRole('heading', { name: heading, exact: typeof heading === 'string' }),
      ).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      expect(overflow, `${route || 'dashboard'} overflow at ${width}px`).toBeFalsy();
      const smallControls = await page
        .locator('input:visible:not([type=checkbox]), select:visible, textarea:visible')
        .evaluateAll((elements) =>
          elements
            .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
            .map((el) => el.outerHTML.slice(0, 150)),
        );
      expect(smallControls, `Small/zoom-prone inputs on ${route} at ${width}px`).toEqual([]);
    }
  }
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/app/reports');
  const report = page.getByRole('combobox', { name: 'Report type', exact: true });
  for (const type of [
    'final',
    'bills',
    'payments',
    'outstanding',
    'vendor',
    'labour',
    'category',
    'stage',
    'floor',
    'monthly',
    'budget',
    'progress',
    'data',
  ]) {
    await report.selectOption(type);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `Report ${type}`,
    ).toBeTruthy();
    for (const table of await page.locator('.stacked-table').all()) {
      expect(
        await table.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        `Clipped cells in report ${type}`,
      ).toBeTruthy();
    }
  }
  await page.screenshot({ path: 'docs/screenshots/phone-report-320.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('phone touch navigation, entry sheet and short keyboard viewport work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page);
  await expect(page.getByRole('button', { name: 'Search project', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Search project', exact: true }).click();
  await page.getByLabel('Search all project records').fill('Cement');
  await expect(page.locator('.search-result').first()).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Mobile navigation' });
  await nav.getByRole('button', { name: 'More', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Project navigation' });
  await expect(menu).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await menu.getByRole('link', { name: 'Labour', exact: true }).click();
  await expect(menu).not.toBeVisible();
  await page.getByRole('button', { name: 'Attendance', exact: true }).click();
  await expect(page.locator('.stacked-table tbody tr').first()).toBeVisible();
  await expect(page.getByText('Not billed', { exact: true })).toBeVisible();
  expect(
    await page
      .locator('.stacked-table tbody tr')
      .first()
      .evaluate((el) => getComputedStyle(el).display),
  ).toBe('block');
  await page.screenshot({ path: 'docs/screenshots/phone-attendance.png', fullPage: true });
  await nav.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add expense', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Description', { exact: true }).fill('Phone entry check');
  await dialog.getByLabel('Amount (₹)', { exact: true }).fill('8000');
  await dialog.getByLabel('Payment status').selectOption('partial');
  await dialog.getByLabel('Paid now (₹)').fill('5000');
  for (const control of [
    dialog.getByRole('button', { name: 'Close dialog' }),
    dialog.getByRole('button', { name: 'Add expense', exact: true }),
  ]) {
    const bounds = await control.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
  }
  await page.setViewportSize({ width: 390, height: 460 });
  await expect.poll(async () => (await dialog.boundingBox())!.height).toBeLessThanOrEqual(444);
  await dialog.getByRole('button', { name: 'Add expense', exact: true }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole('button', { name: 'Add expense', exact: true })).toBeInViewport();
  await page.screenshot({ path: 'docs/screenshots/phone-expense-short-viewport.png' });
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await page.setViewportSize({ width: 740, height: 360 });
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});
