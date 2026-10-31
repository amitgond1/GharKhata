import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MongoClient } from 'mongodb';
const root = path.resolve('.runtime/mongo');
await fs.mkdir(root, { recursive: true });
const executable =
  process.env.MONGOD_PATH ||
  (process.platform === 'win32'
    ? 'C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe'
    : 'mongod');
const child = spawn(
  executable,
  [
    '--dbpath',
    root,
    '--port',
    '27018',
    '--bind_ip',
    '127.0.0.1',
    '--replSet',
    'rs0',
    '--logpath',
    path.join(root, 'mongod.log'),
    '--logappend',
  ],
  { stdio: 'inherit', windowsHide: true },
);
child.on('error', (e) => {
  console.error(e.message);
  process.exitCode = 1;
});
const uri = 'mongodb://127.0.0.1:27018/?directConnection=true';
let initialized = false;
for (let n = 0; n < 40; n++) {
  try {
    const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 500 });
    try {
      await client.db('admin').command({ replSetGetStatus: 1 });
    } catch (e) {
      if (e.code === 94)
        await client
          .db('admin')
          .command({
            replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27018' }] },
          });
      else throw e;
    }
    await client.close();
    initialized = true;
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (initialized)
  console.log('Local MongoDB replica set ready on 127.0.0.1:27018. Keep this terminal open.');
else console.error('MongoDB did not become ready. Check .runtime/mongo/mongod.log.');
process.on('SIGINT', () => child.kill());
process.on('SIGTERM', () => child.kill());
