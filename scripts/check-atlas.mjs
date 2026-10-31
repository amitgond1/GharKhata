import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || '';
if (!uri.startsWith('mongodb+srv://') || /<[^>]+>/.test(uri)) {
  console.error('Atlas is not configured. Set the real MONGODB_URI in the root .env file.');
  process.exit(1);
}
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  await client.db().command({ ping: 1 });
  const hello = await client.db('admin').command({ hello: 1 });
  if ((!hello.setName && hello.msg !== 'isdbgrid') || !hello.logicalSessionTimeoutMinutes)
    throw new Error('TRANSACTIONS_UNAVAILABLE');
  console.log('Atlas connected. Database ping and replica-set/session support verified.');
} catch (error) {
  const reason =
    error.message === 'TRANSACTIONS_UNAVAILABLE'
      ? 'The database must support replica-set transactions.'
      : 'Check the Atlas database user, password, connection string and IP access list.';
  console.error(`Atlas connection failed. ${reason}`);
  process.exitCode = 1;
} finally {
  await client.close();
}
