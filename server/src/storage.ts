import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { config } from './config.ts';
import { fail } from './service.ts';
const s3 = config.bucket
  ? new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: config.endpoint,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    })
  : undefined;
export async function prepare(file: Express.Multer.File) {
  const b = file.buffer;
  let mime = '';
  let content = b;
  if (
    (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255)
  ) {
    content = await sharp(b, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    mime = 'image/jpeg';
  } else if (b.subarray(0, 5).toString() === '%PDF-' && file.mimetype === 'application/pdf') {
    if (/\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia)\b/i.test(b.toString('latin1')))
      fail('PDF contains active content. Upload a photo or flattened PDF.');
    mime = 'application/pdf';
  } else fail('Upload a JPEG, PNG, or PDF file');
  const name =
    path
      .basename(file.originalname)
      .replace(/[^\p{L}\p{N} ._-]/gu, '_')
      .slice(0, 120) || 'attachment';
  return { content, mime, name };
}
export async function storeFile(content: Buffer, mime: string) {
  const key = randomUUID();
  if (s3)
    await s3.send(
      new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: content, ContentType: mime }),
    );
  else {
    await fs.mkdir(config.uploadDir, { recursive: true });
    await fs.writeFile(path.join(config.uploadDir, key), content, { flag: 'wx' });
  }
  return key;
}
export async function readFile(key: string) {
  if (!/^[a-f0-9-]{36}$/.test(key)) fail('Invalid storage key');
  if (s3) {
    const r = await s3.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }
  return fs.readFile(path.join(config.uploadDir, key));
}
export async function removeFile(key: string) {
  if (s3) await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
  else await fs.unlink(path.join(config.uploadDir, key));
}
