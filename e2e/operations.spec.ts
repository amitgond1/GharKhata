import { test, expect } from '@playwright/test';
test.use({ actionTimeout: 15000 });

test('switching workers during wage approval bills only the selected worker attendance', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the live demo' }).click();
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  const session = await (await page.request.get('/api/auth/me')).json();
  const projects = await (await page.request.get('/api/projects')).json();
  const project = projects[0]._id;
  const snapshotURL = `/api/projects/${project}/snapshot`;
  const before = await (await page.request.get(snapshotURL)).json();
  async function add(kind: string, data: object) {
    const response = await page.request.post(`/api/projects/${project}/records/${kind}`, {
      headers: { 'x-csrf-token': session.csrf, 'Idempotency-Key': crypto.randomUUID() },
      data,
    });
    expect(response.status(), await response.text()).toBe(201);
    return response.json();
  }
  const workerA = await add('worker', {
    name: 'Audit Mason',
    trade: 'Mason',
    rate: 80000,
    vendor: before.vendors[0]._id,
  });
  const workerB = await add('worker', {
    name: 'Audit Helper',
    trade: 'Helper',
    rate: 60000,
    vendor: before.vendors[0]._id,
  });
  await add('attendance', { worker: workerA._id, date: '2026-10-31', units: '1' });
  const attendanceB = await add('attendance', {
    worker: workerB._id,
    date: '2026-10-31',
    units: '1',
  });
  await page.goto('/app/labour');
  await page.getByRole('button', { name: 'Approve wage statement', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Name', exact: true }).selectOption(workerA._id);
  await dialog.locator('.wage-preview input[type="checkbox"]').check();
  await dialog.getByRole('combobox', { name: 'Name', exact: true }).selectOption(workerB._id);
  await expect(dialog.locator('.wage-preview input[type="checkbox"]')).not.toBeChecked();
  await dialog.locator('.wage-preview input[type="checkbox"]').check();
  await dialog.getByLabel('Date', { exact: true }).fill('2026-10-31');
  await dialog.getByLabel('Description', { exact: true }).fill('Helper wage after worker switch');
  await expect(dialog.locator('.calculation')).toContainText('₹600');
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/records/wage') && response.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Save record', exact: true }).click();
  const response = await saved;
  expect(response.status(), await response.text()).toBe(201);
  await expect(dialog).not.toBeVisible();
  const after = await (await page.request.get(snapshotURL)).json();
  const wage = after.records.find(
    (record: any) => record.kind === 'wage' && record.data.worker === workerB._id,
  );
  expect(wage.data.attendance).toEqual([attendanceB._id]);
  expect(wage.data.total).toBe(60000);
  expect(after.summary.cost).toBe(before.summary.cost + 60000);
  expect(after.summary.cash).toBe(before.summary.cash);
  expect(
    after.records.some(
      (record: any) => record.kind === 'wage' && record.data.worker === workerA._id,
    ),
  ).toBeFalsy();
});
