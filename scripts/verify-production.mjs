import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const baseURL = new URL(process.argv[2] || 'http://127.0.0.1:5173');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});
const context = await browser.newContext();
const page = await context.newPage();
try {
  await page.goto(baseURL.href);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const keys = (
      await Promise.all(
        names.map(async (name) =>
          (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname),
        ),
      )
    ).flat();
    return { names, keys };
  });
  if (cached.keys.some((key) => key.startsWith('/api')))
    throw new Error('Private API data was cached');
  if (cached.keys.filter((key) => key.startsWith('/assets/')).length < 5)
    throw new Error('App bundles were not precached');
  await page.getByRole('button', { name: 'Explore the live demo' }).click();
  await page.getByRole('heading', { name: /Welcome back/ }).waitFor();
  await page.goto(new URL('/app/reports', baseURL).href);
  await page.getByRole('heading', { name: 'Final construction cost' }).waitFor();
  await page.emulateMedia({ media: 'print' });
  await fs.mkdir('.runtime', { recursive: true });
  await page.pdf({ path: '.runtime/verified-report.pdf', format: 'A4', printBackground: true });
  const pdf = await fs.readFile('.runtime/verified-report.pdf');
  if (pdf.subarray(0, 5).toString() !== '%PDF-' || pdf.length < 5000)
    throw new Error('PDF output is invalid');
  await context.setOffline(true);
  await page.goto(new URL('/app', baseURL).href);
  if (!(await page.title()).includes('GharKhata')) throw new Error('Offline app shell unavailable');
  console.log(
    JSON.stringify({
      pwa: 'pass',
      cache: cached.names,
      precacheAssets: cached.keys.filter((k) => k.startsWith('/assets/')).length,
      privateApiCached: false,
      pdfBytes: pdf.length,
      offlineShell: 'pass',
    }),
  );
} finally {
  await browser.close();
}
