import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'client/dist');
const files = (await fs.readdir(path.join(dist, 'assets'))).map((f) => '/assets/' + f);
const version = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 12);
let sw = await fs.readFile(path.join(root, 'client/public/sw.js'), 'utf8');
if (!/const PRECACHE = \[[\s\S]*?\];/.test(sw)) throw new Error('PWA precache marker is missing');
sw = sw
  .replace('gharkhata-shell-v1', 'gharkhata-shell-' + version)
  .replace(
    /const PRECACHE = \[[\s\S]*?\];/,
    'const PRECACHE = ' +
      JSON.stringify([
        '/',
        '/icon.svg',
        '/icon-192.png',
        '/icon-512.png',
        '/manifest.webmanifest',
        ...files,
      ]) +
      ';',
  );
await fs.writeFile(path.join(dist, 'sw.js'), sw);
console.log(
  `PWA shell ${version}: ${files.length} bundled assets precached; API responses stay private and uncached.`,
);
