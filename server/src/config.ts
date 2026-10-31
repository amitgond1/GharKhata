import { config as loadEnvironment } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
loadEnvironment({ path: path.join(root, '.env'), quiet: true });
export const config = {
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
  mongo: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/gharkhata?replicaSet=rs0',
  origin: process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://127.0.0.1:5173',
  production: process.env.NODE_ENV === 'production',
  uploadDir: path.resolve(root, process.env.UPLOAD_DIR || 'uploads'),
  bucket: process.env.S3_BUCKET,
  endpoint: process.env.S3_ENDPOINT,
  frontendDir: path.join(root, 'client/dist'),
};
if (config.production) {
  if (!process.env.MONGODB_URI || /<[^>]+>/.test(config.mongo))
    throw new Error('Set MONGODB_URI to your real database connection string before deploying.');
  if (!/^mongodb(?:\+srv)?:\/\//.test(config.mongo))
    throw new Error('MONGODB_URI must be a MongoDB connection string.');
  const origin = new URL(config.origin);
  if (origin.protocol !== 'https:' || origin.origin !== config.origin)
    throw new Error('APP_ORIGIN must be an exact HTTPS origin without a trailing slash or path.');
  if (!config.bucket && !process.env.UPLOAD_DIR)
    throw new Error('Set UPLOAD_DIR to a persistent disk path, or configure S3_BUCKET.');
}
