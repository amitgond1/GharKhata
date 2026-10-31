import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mountFrontend } from '../src/frontend.ts';

let directory: string;
const app = express();
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'gharkhata-static-'));
  await mkdir(path.join(directory, 'assets'));
  await writeFile(path.join(directory, 'index.html'), '<html><title>GharKhata</title></html>');
  await writeFile(path.join(directory, 'assets/app-123.js'), 'console.log("app")');
  await writeFile(path.join(directory, 'sw.js'), '// service worker');
  await writeFile(path.join(directory, '.env'), 'PRIVATE_SENTINEL=secret');
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));
  mountFrontend(app, directory);
});
after(async () => {
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
  assert.ok(path.basename(directory).startsWith('gharkhata-static-'));
  await rm(directory, { recursive: true, force: true });
});

test('production serves the app and direct SPA links without caching stale HTML', async () => {
  for (const route of ['/', '/app/expenses', '/login', '/invite?token=test', '/reset-password']) {
    const result = await request(app).get(route).accept('html').expect(200);
    assert.match(result.text, /GharKhata/);
    assert.equal(result.headers['cache-control'], 'no-cache');
  }
});

test('production caches hashed assets but revalidates the service worker', async () => {
  const asset = await request(app).get('/assets/app-123.js').expect(200);
  assert.match(asset.headers['cache-control'], /max-age=31536000, immutable/);
  const worker = await request(app).get('/sw.js').expect(200);
  assert.equal(worker.headers['cache-control'], 'no-cache');
});

test('missing assets, private dotfiles and API paths never fall back to the app', async () => {
  for (const route of [
    '/assets/missing.js',
    '/missing.png',
    '/.env',
    '/assets/../.env',
    '/api/missing',
  ]) {
    const result = await request(app).get(route).expect(404);
    assert.doesNotMatch(result.text, /PRIVATE_SENTINEL|<title>GharKhata/);
  }
  await request(app).get('/not-a-page').accept('application/json').expect(404);
});
