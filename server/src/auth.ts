import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { User, Session, Token } from './models.ts';
import { config } from './config.ts';
import { fail } from './service.ts';
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export const random = () => randomBytes(32).toString('hex');
declare global {
  namespace Express {
    interface Request {
      user: any;
      auth: any;
    }
  }
}
const cookieName = config.production ? '__Host-gharkhata' : 'gharkhata';
const cookieOptions = {
  httpOnly: true,
  secure: config.production,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 86400000,
};
export async function loginSession(res: Response, user: string) {
  const token = random();
  const csrf = random();
  await Session.create({
    hash: hash(token),
    user,
    csrf,
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  res.cookie(cookieName, token, cookieOptions);
  return csrf;
}
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies[cookieName];
  if (!token) return res.status(401).json({ error: 'Please sign in' });
  const session = await Session.findOne({
    hash: hash(token),
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!session) return res.status(401).json({ error: 'Session expired. Please sign in' });
  const user = await User.findById(session.user).lean();
  if (!user) return res.status(401).json({ error: 'Please sign in' });
  req.user = user;
  req.auth = session;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const csrf = req.get('x-csrf-token') || '';
    if (
      csrf.length !== session.csrf!.length ||
      !timingSafeEqual(Buffer.from(csrf), Buffer.from(session.csrf!))
    )
      return res.status(403).json({ error: 'Invalid security token. Reload and retry.' });
  }
  next();
}
export const auth = Router();
auth.use(
  ['/login', '/register', '/forgot-password', '/reset-password'],
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 80,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
);
const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(10)
    .max(72)
    .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes'),
});
const profile = (u: any) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  language: u.language,
  demo: u.demo,
});
auth.post('/register', async (req, res) => {
  const d = credentials
    .extend({
      name: z.string().trim().min(1).max(100),
      language: z.enum(['en', 'hi']).default('en'),
    })
    .parse(req.body);
  if (await User.exists({ email: d.email })) fail('An account with this email already exists', 409);
  const u = await User.create({ ...d, password: await bcrypt.hash(d.password, 12) });
  const csrf = await loginSession(res, String(u._id));
  res.status(201).json({ user: profile(u), csrf });
});
auth.post('/login', async (req, res) => {
  const d = credentials.parse(req.body);
  const u = await User.findOne({ email: d.email }).select('+password');
  const valid = await bcrypt.compare(
    d.password,
    u?.password || '$2b$12$0n4JbGaSz3Y6NzhZvvQ8bOBmVVkY4Uw6IixYeAqN3pOjpeNLbToMO',
  );
  if (!u || !valid) fail('Email or password is incorrect', 401);
  const csrf = await loginSession(res, String(u._id));
  res.json({ user: profile(u), csrf });
});
auth.get('/me', authenticate, (req, res) =>
  res.json({ user: profile(req.user), csrf: req.auth.csrf }),
);
auth.post('/logout', authenticate, async (req, res) => {
  await Session.deleteOne({ _id: req.auth._id });
  res.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});
auth.patch('/profile', authenticate, async (req, res) => {
  const d = z
    .object({ name: z.string().trim().min(1).max(100), language: z.enum(['en', 'hi']) })
    .parse(req.body);
  await User.updateOne({ _id: req.user._id }, d);
  res.json({ ok: true });
});
export async function sendEmail(to: string, subject: string, url: string) {
  if (process.env.SMTP_URL) {
    await nodemailer.createTransport(process.env.SMTP_URL).sendMail({
      from: process.env.EMAIL_FROM || 'GharKhata <hello@example.com>',
      to,
      subject,
      text: `${subject}\n\n${url}\n\nIf you did not request this, ignore this email.`,
    });
    return {};
  }
  if (!config.production)
    return {
      developmentPreview: {
        subject,
        url,
        note: 'Development only: email provider is not configured. No email was sent.',
      },
    };
  return fail('Email service is not configured', 503);
}

auth.post('/forgot-password', async (req, res) => {
  const { email } = z
    .object({ email: z.email().transform((v) => v.toLowerCase()) })
    .parse(req.body);
  const u = await User.findOne({ email });
  let preview = {};
  if (u) {
    const token = random();
    await Token.create({
      hash: hash(token),
      user: u._id,
      type: 'reset',
      expiresAt: new Date(Date.now() + 30 * 60000),
    });
    preview = await sendEmail(
      email,
      'Reset your GharKhata password',
      `${config.origin}/reset-password?token=${token}`,
    );
  }
  res.json({
    message: 'If the account exists and email is configured, a reset link will be sent.',
    ...preview,
  });
});
auth.post('/reset-password', async (req, res) => {
  const d = z
    .object({
      token: z.string().length(64),
      password: z
        .string()
        .min(10)
        .max(72)
        .refine(
          (v) => Buffer.byteLength(v, 'utf8') <= 72,
          'Password must be at most 72 UTF-8 bytes',
        ),
    })
    .parse(req.body);
  const password = await bcrypt.hash(d.password, 12);
  const mongoose = (await import('mongoose')).default;
  await mongoose.connection.transaction(async (session) => {
    const t = await Token.findOneAndDelete(
      { hash: hash(d.token), type: 'reset', expiresAt: { $gt: new Date() } },
      { session },
    );
    if (!t) fail('Reset link has expired or was already used');
    await User.updateOne({ _id: t!.user }, { password }, { session });
    await Session.deleteMany({ user: t!.user }, { session });
    await Token.deleteMany({ user: t!.user, type: 'reset' }, { session });
  });
  res.json({ ok: true });
});
