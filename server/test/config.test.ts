import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const configUrl = new URL('../src/config.ts', import.meta.url).href;
function load(overrides: NodeJS.ProcessEnv = {}) {
  return spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--input-type=module',
      '-e',
      `const { config } = await import(${JSON.stringify(configUrl)}); console.log(config.origin);`,
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb+srv://fixture:PRIVATE_SENTINEL@cluster.example/gharkhata',
        APP_ORIGIN: '',
        RENDER_EXTERNAL_URL: 'https://gharkhata.onrender.com',
        UPLOAD_DIR: '/var/data/uploads',
        S3_BUCKET: '',
        ...overrides,
      },
    },
  );
}

test('production uses Render HTTPS origin or the configured custom domain', () => {
  for (const origin of ['', 'https://ledger.example']) {
    const result = load({ APP_ORIGIN: origin });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), origin || 'https://gharkhata.onrender.com');
  }
});

test('production rejects incomplete database, origin and storage settings without exposing credentials', () => {
  for (const overrides of [
    { MONGODB_URI: '' },
    { MONGODB_URI: 'mongodb+srv://<username>:<password>@<cluster>/gharkhata' },
    { APP_ORIGIN: 'http://localhost:5173' },
    { APP_ORIGIN: 'https://ledger.example/app' },
    { UPLOAD_DIR: '' },
  ]) {
    const result = load(overrides);
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE_SENTINEL/);
  }
});
