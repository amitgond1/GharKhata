import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.ts';

test('health checks reject traffic while the database is disconnected', async () => {
  const response = await request(app).get('/api/health').expect(503);
  assert.equal(response.body.status, 'database unavailable');
  assert.equal(response.headers['cache-control'], 'private, no-store');
});
