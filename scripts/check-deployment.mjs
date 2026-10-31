import assert from 'node:assert/strict';

const base = new URL(process.argv[2] || 'http://127.0.0.1:4180');
async function get(route) {
  return fetch(new URL(route, base), { signal: AbortSignal.timeout(15000) });
}
try {
  const health = await get('/api/health');
  assert.equal(health.status, 200, 'Database health check failed');
  assert.equal((await health.json()).status, 'ok');
  const home = await get('/');
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('cache-control'), 'no-cache');
  const html = await home.text();
  assert.match(html, /GharKhata/);
  const asset = html.match(/src="(\/assets\/[^"\s]+\.js)"/);
  assert.ok(asset, 'Built JavaScript bundle was not found');
  const bundle = await get(asset[1]);
  assert.equal(bundle.status, 200);
  assert.match(bundle.headers.get('cache-control'), /immutable/);
  for (const route of ['/app/expenses', '/login', '/reset-password']) {
    const page = await get(route);
    assert.equal(page.status, 200, `Direct navigation failed: ${route}`);
    assert.match(await page.text(), /GharKhata/);
  }
  const worker = await get('/sw.js');
  assert.equal(worker.status, 200);
  assert.equal(worker.headers.get('cache-control'), 'no-cache');
  for (const route of ['/assets/not-a-real-bundle.js', '/.env'])
    assert.equal((await get(route)).status, 404, `Unexpected public file: ${route}`);
  const session = await get('/api/auth/me');
  assert.equal(session.status, 401);
  assert.equal(session.headers.get('cache-control'), 'private, no-store');
  assert.match(session.headers.get('content-type'), /application\/json/);
  assert.equal((await session.json()).error, 'Please sign in');
  console.log(
    'Deployment checks passed: database, built app, direct links, asset caching, service worker and private configuration.',
  );
} catch (error) {
  console.error(`Deployment check failed: ${error.message}`);
  process.exitCode = 1;
}
