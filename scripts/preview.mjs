import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
await fs.mkdir('docs/screenshots', { recursive: true });
await page.goto('http://127.0.0.1:5173');
await page.getByRole('button', { name: 'Explore the live demo' }).click();
await page.getByRole('heading', { name: /Welcome back/ }).waitFor();
async function settleCharts() {
  // Offscreen chart animations can pause after a resize in Chromium.
  for (const selector of ['.area-chart', '.donut-wrap']) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}
await page.locator('.area-chart svg').waitFor();
await settleCharts();
await page.screenshot({ path: 'docs/screenshots/dashboard-desktop.png', fullPage: true });
for (const width of [390, 360, 320]) {
  await page.setViewportSize({ width, height: 844 });
  await settleCharts();
  await page.screenshot({ path: `docs/screenshots/dashboard-${width}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) problems.push(`Dashboard overflows at ${width}px`);
}
await page.goto('http://127.0.0.1:5173/app/expenses');
await page.locator('.mobile-record').first().waitFor();
await page.screenshot({ path: 'docs/screenshots/expenses-mobile.png', fullPage: true });
await browser.close();
console.log(JSON.stringify({ screenshots: 'docs/screenshots', problems }));
if (problems.length) process.exitCode = 1;
