import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import mongoose from 'mongoose';
import { z, ZodError } from 'zod';
import {
  projectSchema,
  vendorSchema,
  taskSchema,
  schemas,
  creditShares,
  type Kind,
  type LedgerRecord,
} from '@gharkhata/shared';
import { config } from './config.ts';
import { auth, authenticate, loginSession, random, hash, sendEmail } from './auth.ts';
import { Project, Membership, Record, Vendor, Attachment, Audit, Token, User } from './models.ts';
import { fail, plain, projectAccess, createRecord, voidRecord, mutate } from './service.ts';
import { summarize, summarizeSelection, matchesBill } from './finance.ts';
import { makeDemo } from './demo.ts';
import { prepare, storeFile, readFile, removeFile } from './storage.ts';
import { mountFrontend } from './frontend.ts';
export const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
    contentSecurityPolicy: { directives: { imgSrc: ["'self'", 'data:', 'blob:'] } },
  }),
);
app.use(cors({ origin: config.origin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});
app.use(
  '/api',
  rateLimit({ windowMs: 60000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }),
);
app.use((req, res, next) => {
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    req.get('origin') &&
    req.get('origin') !== config.origin
  )
    return res.status(403).json({ error: 'Untrusted request origin' });
  next();
});
app.get('/api/health', (_req, res) =>
  res
    .status(mongoose.connection.readyState === 1 ? 200 : 503)
    .json({ status: mongoose.connection.readyState === 1 ? 'ok' : 'database unavailable' }),
);
app.use('/api/auth', auth);
app.post('/api/demo', rateLimit({ windowMs: 3600000, limit: 15 }), async (_req, res) => {
  const { user } = await makeDemo();
  const csrf = await loginSession(res, String(user._id));
  res.status(201).json({
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      language: user.language,
      demo: true,
    },
    csrf,
  });
});
app.use('/api', authenticate);
const dashboardFilters = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  vendor: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
  category: z.string().max(160).optional(),
  floor: z.string().max(80).optional(),
  stage: z.string().max(100).optional(),
  status: z.enum(['paid', 'partial', 'unpaid', 'credited']).optional(),
});
app.get('/api/projects', async (req, res) => {
  const ms = await Membership.find({ user: req.user._id }).lean();
  const projects = await Project.find({ _id: { $in: ms.map((m) => m.project) } }).lean();
  res.json(
    projects.map((p) => ({
      ...p,
      _id: String(p._id),
      role: ms.find((m) => String(m.project) === String(p._id))!.role,
    })),
  );
});
app.post('/api/projects', async (req, res) => {
  if (req.user.demo)
    fail('Demo accounts use isolated demo projects. Sign up to create your own.', 403);
  const data = projectSchema.parse(req.body);
  if (data.cover) fail('Upload a cover after creating the project');
  const project = await mongoose.connection.transaction(async (session) => {
    const [p] = await Project.create([{ owner: req.user._id, name: data.name, data }], { session });
    await Membership.create([{ project: p._id, user: req.user._id, role: 'owner' }], { session });
    await Audit.create(
      [
        {
          project: p._id,
          user: req.user._id,
          action: 'project.create',
          target: String(p._id),
          after: data,
        },
      ],
      { session },
    );
    return p;
  });
  res.status(201).json(project);
});
app.use('/api/projects/:project', async (req, res, next) => {
  await projectAccess(String(req.params.project), String(req.user._id));
  next();
});
const p = (req: express.Request) => String(req.params.project);
const u = (req: express.Request) => String(req.user._id);
const key = (req: express.Request) => req.get('idempotency-key') || '';
app.get('/api/projects/:project/snapshot', async (req, res) => {
  const project = p(req);
  const result = await mongoose.connection.transaction(
    async (session) => {
      const row = await Project.findById(project).session(session).lean();
      const records = (await Record.find({ project }).session(session).lean()).map(plain);
      const vendors = await Vendor.find({ project }).session(session).lean();
      const attachments = await Attachment.find({ project }).select('-key').session(session).lean();
      return {
        project: row,
        records,
        vendors,
        attachments,
        summary: summarize(records as LedgerRecord[], row!.data.budget),
      };
    },
    { readConcern: { level: 'snapshot' } },
  );
  res.json(result);
});
app.get('/api/projects/:project/dashboard', async (req, res) => {
  const filters = dashboardFilters.parse(req.query);
  const summary = await mongoose.connection.transaction(
    async (session) => {
      const project = await Project.findById(p(req)).session(session);
      const records = (
        await Record.find({ project: p(req) })
          .session(session)
          .lean()
      ).map(plain) as LedgerRecord[];
      return summarizeSelection(records, project!.data.budget, filters);
    },
    { readConcern: { level: 'snapshot' } },
  );
  res.json({
    summary,
    basis:
      'Whole matching bills with all settlements to date. Cash card is allocated payments for this selection. Project budget/advances remain all-time.',
  });
});
app.get('/api/projects/:project/records', async (req, res) => {
  const query = z
    .object({
      kind: z
        .enum([
          'bill',
          'payment',
          'allocation',
          'credit',
          'refund',
          'worker',
          'attendance',
          'wage',
          'task',
          'log',
          'budget',
          'contract',
          'stock',
        ])
        .optional(),
      q: z.string().max(200).default(''),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      sort: z.enum(['newest', 'oldest', 'amount']).default('newest'),
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
      vendor: z
        .string()
        .regex(/^[a-f\d]{24}$/i)
        .optional(),
      category: z.string().max(160).optional(),
      floor: z.string().max(80).optional(),
      stage: z.string().max(100).optional(),
      status: z.enum(['paid', 'partial', 'unpaid', 'credited']).optional(),
      min: z.coerce.number().int().nonnegative().optional(),
      max: z.coerce.number().int().nonnegative().optional(),
    })
    .parse(req.query);
  const all = (await Record.find({ project: p(req), voided: false }).lean()).map(
    plain,
  ) as LedgerRecord[];
  const state = summarize(all);
  const vendors = await Vendor.find({ project: p(req) }).lean();
  const rows = all
    .filter((r) => {
      const b = r.kind === 'bill' ? state.bills.find((b) => b._id === r._id) : undefined;
      const text =
        JSON.stringify(r.data) +
        ' ' +
        vendors.find((v) => String(v._id) === r.data.vendor)?.data.name;
      const amount = r.data.total ?? r.data.amount ?? 0;
      return (
        (!query.kind || r.kind === query.kind) &&
        (!query.q || text.toLowerCase().includes(query.q.toLowerCase())) &&
        (!query.from || r.data.date >= query.from) &&
        (!query.to || r.data.date <= query.to) &&
        (!query.vendor || r.data.vendor === query.vendor) &&
        (!query.category || r.data.lines?.some((l: any) => l.category === query.category)) &&
        (!query.floor || r.data.floor === query.floor) &&
        (!query.stage || r.data.stage === query.stage) &&
        (!query.status || b?.status === query.status) &&
        (query.min === undefined || amount >= query.min) &&
        (query.max === undefined || amount <= query.max)
      );
    })
    .map((r) =>
      r.kind === 'bill'
        ? state.bills.find((b) => b._id === r._id)!
        : r.kind === 'payment'
          ? state.payments.find((p) => p._id === r._id)!
          : r,
    )
    .sort((a, b) =>
      query.sort === 'amount'
        ? (b.data.total ?? b.data.amount ?? 0) - (a.data.total ?? a.data.amount ?? 0)
        : query.sort === 'oldest'
          ? String(a.data.date || '').localeCompare(String(b.data.date || ''))
          : String(b.data.date || '').localeCompare(String(a.data.date || '')),
    );
  res.json({
    records: rows.slice((query.page - 1) * query.limit, query.page * query.limit),
    total: rows.length,
    page: query.page,
    limit: query.limit,
  });
});
app.patch('/api/projects/:project', async (req, res) => {
  const data = projectSchema.parse(req.body);
  const result = await mutate(
    p(req),
    u(req),
    key(req),
    { action: 'project.update', data },
    async (session) => {
      if (
        data.cover &&
        !(await Attachment.exists({ _id: data.cover, project: p(req), mime: /^image\// }).session(
          session,
        ))
      )
        fail('Cover must be an image from this project');
      const before = await Project.findById(p(req)).session(session);
      await Project.updateOne({ _id: p(req) }, { name: data.name, data }, { session });
      await Audit.create(
        [
          {
            project: p(req),
            user: u(req),
            action: 'project.update',
            target: p(req),
            before: before!.data,
            after: data,
          },
        ],
        { session },
      );
      return { ok: true };
    },
    true,
  );
  res.json(result);
});
app.post('/api/projects/:project/vendors', async (req, res) => {
  const data = vendorSchema.parse(req.body);
  res.status(201).json(
    await mutate(p(req), u(req), key(req), { action: 'vendor.create', data }, async (session) => {
      const [v] = await Vendor.create([{ project: p(req), data }], { session });
      await Audit.create(
        [
          {
            project: p(req),
            user: u(req),
            action: 'vendor.create',
            target: String(v._id),
            after: data,
          },
        ],
        { session },
      );
      return v.toObject();
    }),
  );
});
app.patch('/api/projects/:project/vendors/:id', async (req, res) => {
  const data = vendorSchema.parse(req.body);
  res.json(
    await mutate(
      p(req),
      u(req),
      key(req),
      { action: 'vendor.update', id: req.params.id, data },
      async (session) => {
        const before = await Vendor.findOneAndUpdate(
          { _id: req.params.id, project: p(req) },
          { $set: { data } },
          { session },
        );
        if (!before) fail('Vendor not found', 404);
        await Audit.create(
          [
            {
              project: p(req),
              user: u(req),
              action: 'vendor.update',
              target: req.params.id,
              before: before!.data,
              after: data,
            },
          ],
          { session },
        );
        return { ok: true };
      },
      true,
    ),
  );
});
app.post('/api/projects/:project/records/:kind', async (req, res) =>
  res
    .status(201)
    .json(await createRecord(p(req), u(req), String(req.params.kind) as Kind, req.body, key(req))),
);
app.patch('/api/projects/:project/records/:id', async (req, res) => {
  const current = await Record.findOne({
    _id: req.params.id,
    project: p(req),
    voided: false,
  }).lean();
  if (!current) fail('Record not found', 404);
  const kind = current.kind as Kind;
  if (!['worker', 'budget', 'contract', 'log'].includes(kind))
    fail('Financial and stock history must be corrected with reversal or compensating records');
  const data: any = schemas[kind].parse(req.body);
  res.json(
    await mutate(
      p(req),
      u(req),
      key(req),
      { action: `${kind}.update`, id: req.params.id, data },
      async (session) => {
        if (
          data.vendor &&
          !(await Vendor.exists({ _id: data.vendor, project: p(req) }).session(session))
        )
          fail('Vendor is not in this project');
        if (
          data.attachments?.length &&
          (await Attachment.countDocuments({
            _id: { $in: data.attachments },
            project: p(req),
          }).session(session)) !== new Set(data.attachments).size
        )
          fail('Attachment is not in this project');
        if (
          kind === 'budget' &&
          (await Record.exists({
            _id: { $ne: req.params.id },
            project: p(req),
            kind,
            voided: false,
            'data.dimension': data.dimension,
            'data.label': data.label,
          }).session(session))
        )
          fail('A budget already exists for this category or stage');
        const before = await Record.findOneAndUpdate(
          { _id: req.params.id, project: p(req), voided: false, kind },
          { $set: { data } },
          { session },
        );
        if (!before) fail('Record is no longer available', 409);
        await Audit.create(
          [
            {
              project: p(req),
              user: u(req),
              action: `${kind}.update`,
              target: req.params.id,
              before: before!.data,
              after: data,
            },
          ],
          { session },
        );
        return { ok: true };
      },
      true,
    ),
  );
});
app.post('/api/projects/:project/records/:id/void', async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
  res.json(await voidRecord(p(req), u(req), String(req.params.id), reason, key(req)));
});
app.patch('/api/projects/:project/tasks/:id', async (req, res) => {
  const data = taskSchema.parse(req.body);
  res.json(
    await mutate(
      p(req),
      u(req),
      key(req),
      { action: 'task.update', id: req.params.id, data },
      async (session) => {
        if (
          data.attachments.length &&
          (await Attachment.countDocuments({
            _id: { $in: data.attachments },
            project: p(req),
          }).session(session)) !== new Set(data.attachments).size
        )
          fail('Attachment is not in this project');
        const r = await Record.findOneAndUpdate(
          { _id: req.params.id, project: p(req), kind: 'task', voided: false },
          { $set: { data } },
          { session },
        );
        if (!r) fail('Task not found', 404);
        await Audit.create(
          [
            {
              project: p(req),
              user: u(req),
              action: 'task.update',
              target: req.params.id,
              before: r!.data,
              after: data,
            },
          ],
          { session },
        );
        return { ok: true };
      },
    ),
  );
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});
app.post(
  '/api/projects/:project/attachments',
  rateLimit({ windowMs: 60000, limit: 30 }),
  async (req, res, next) => {
    await projectAccess(p(req), u(req), true);
    next();
  },
  upload.single('file'),
  async (req, res) => {
    if (!req.file) fail('Select a file');
    const { content, mime, name } = await prepare(req.file!);
    const storageKey = await storeFile(content, mime);
    try {
      const a = await Attachment.create({
        project: p(req),
        createdBy: u(req),
        name,
        key: storageKey,
        mime,
        size: content.length,
      });
      res.status(201).json({ _id: String(a._id), name, mime, size: content.length });
    } catch (e) {
      await removeFile(storageKey);
      throw e;
    }
  },
);
app.get('/api/projects/:project/attachments/:id', async (req, res) => {
  const a = await Attachment.findOne({ _id: req.params.id, project: p(req) }).lean();
  if (!a) fail('Attachment not found', 404);
  res.set({
    'Content-Type': a!.mime!,
    'Content-Disposition': `inline; filename="${encodeURIComponent(a!.name!)}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  });
  res.send(await readFile(a!.key!));
});
app.get('/api/projects/:project/audit', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  res.json(
    await Audit.find({ project: p(req) })
      .sort({ createdAt: -1 })
      .skip((page - 1) * 50)
      .limit(50)
      .lean(),
  );
});
app.get('/api/projects/:project/members', async (req, res) => {
  const ms = await Membership.find({ project: p(req) }).lean();
  const users = await User.find({ _id: { $in: ms.map((m) => m.user) } }).lean();
  res.json(
    ms.map((m) => ({
      ...m,
      name: users.find((x) => String(x._id) === String(m.user))?.name,
      email: users.find((x) => String(x._id) === String(m.user))?.email,
    })),
  );
});
app.get('/api/projects/:project/invitations', async (req, res) => {
  const m = await projectAccess(p(req), u(req));
  if (m.role !== 'owner') fail('Only the owner can view pending invitations', 403);
  res.json(
    await Token.find({ project: p(req), type: 'invite', expiresAt: { $gt: new Date() } })
      .select('email role expiresAt createdAt')
      .lean(),
  );
});
app.delete('/api/projects/:project/invitations/:id', async (req, res) => {
  const m = await projectAccess(p(req), u(req));
  if (m.role !== 'owner') fail('Only the owner can revoke invitations', 403);
  await mongoose.connection.transaction(async (session) => {
    await Project.updateOne({ _id: p(req) }, { $inc: { revision: 1 } }, { session });
    const token = await Token.findOneAndDelete(
      { _id: req.params.id, project: p(req), type: 'invite' },
      { session },
    );
    if (!token) fail('Invitation not found', 404);
    await Audit.create(
      [{ project: p(req), user: u(req), action: 'invitation.revoke', target: token!.email }],
      { session },
    );
  });
  res.json({ ok: true });
});
app.post('/api/projects/:project/invitations', async (req, res) => {
  const m = await projectAccess(p(req), u(req), true, true);
  if (m.role !== 'owner') fail('Only the owner can invite people', 403);
  if (req.user.demo) fail('Invitations are unavailable in the isolated demo', 403);
  const d = z
    .object({
      email: z.email().transform((v) => v.toLowerCase()),
      role: z.enum(['manager', 'contributor', 'viewer']),
    })
    .parse(req.body);
  const token = random();
  await Token.create({
    hash: hash(token),
    email: d.email,
    project: p(req),
    role: d.role,
    type: 'invite',
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  const result = await sendEmail(
    d.email,
    'Join a GharKhata project',
    `${config.origin}/invite?token=${token}`,
  );
  await Audit.create({
    project: p(req),
    user: u(req),
    action: 'invitation.create',
    target: d.email,
    after: { role: d.role },
  });
  res.json({ message: 'Invitation created', ...result });
});
app.post('/api/invitations/accept', async (req, res) => {
  const { token } = z.object({ token: z.string().length(64) }).parse(req.body);
  await mongoose.connection.transaction(async (session) => {
    const t = await Token.findOneAndDelete(
      { hash: hash(token), email: req.user.email, type: 'invite', expiresAt: { $gt: new Date() } },
      { session },
    );
    if (!t) fail('Invitation expired, already accepted, or belongs to another email');
    const existing = await Membership.findOne({ project: t!.project, user: req.user._id }).session(
      session,
    );
    if (!existing)
      await Membership.create(
        [
          {
            project: t!.project!,
            user: req.user._id,
            role: t!.role as 'manager' | 'contributor' | 'viewer',
          },
        ],
        { session },
      );
    await Audit.create(
      [
        {
          project: t!.project,
          user: u(req),
          action: 'invitation.accept',
          target: u(req),
          after: { role: existing?.role || t!.role },
        },
      ],
      { session },
    );
  });
  res.json({ ok: true });
});
app.delete('/api/projects/:project/members/:id', async (req, res) => {
  const m = await projectAccess(p(req), u(req));
  if (m.role !== 'owner') fail('Only the owner can revoke access', 403);
  await mongoose.connection.transaction(async (session) => {
    await Project.updateOne({ _id: p(req) }, { $inc: { revision: 1 } }, { session });
    const removed = await Membership.findOneAndDelete(
      { _id: req.params.id, project: p(req), role: { $ne: 'owner' } },
      { session },
    );
    if (!removed) fail('Member not found or owner cannot be removed', 404);
    const person = await User.findById(removed!.user).session(session);
    await Token.deleteMany({ project: p(req), email: person?.email, type: 'invite' }, { session });
    await Audit.create(
      [
        {
          project: p(req),
          user: u(req),
          action: 'membership.revoke',
          target: String(removed!.user),
        },
      ],
      { session },
    );
  });
  res.json({ ok: true });
});
function csvCell(v: unknown) {
  let s = String(v ?? '');
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
app.get('/api/projects/:project/export', async (req, res) => {
  const records = (await Record.find({ project: p(req) }).lean()).map(plain) as LedgerRecord[];
  const project = await Project.findById(p(req));
  const s = summarize(records, project!.data.budget);
  const type = String(req.query.type || 'bills');
  const from = req.query.from ? z.iso.date().parse(req.query.from) : '';
  const to = req.query.to ? z.iso.date().parse(req.query.to) : '';
  const within = (r: any) => (!from || r.data.date >= from) && (!to || r.data.date <= to);
  const vendor = String(req.query.vendor || '');
  const filters = dashboardFilters.parse(req.query);
  const bills = s.bills.filter((b) => matchesBill(b, filters));
  let rows: unknown[][] = [];
  if (['bills', 'outstanding', 'final'].includes(type)) {
    rows = [
      [
        'Description',
        'Date',
        'Invoice',
        'Recorded cost (INR)',
        'Credits (INR)',
        'Allocated payments (INR)',
        'Outstanding (INR)',
        'Status',
      ],
      ...bills
        .filter((b) => type !== 'outstanding' || b.outstanding > 0)
        .map((b) => [
          b.data.description,
          b.data.date,
          b.data.invoice,
          b.total / 100,
          b.credit / 100,
          b.paid / 100,
          b.outstanding / 100,
          b.status,
        ]),
    ];
  } else if (['payments', 'vendor'].includes(type)) {
    const live = records.filter(
      (r) =>
        !r.voided &&
        ['payment', 'refund', 'allocation', 'credit', 'bill'].includes(r.kind) &&
        within(r),
    );
    rows = [
      ['Type', 'Date', 'Description / reference', 'Amount (INR)', 'Bill / payment'],
      ...live
        .filter(
          (r) =>
            !vendor ||
            r.data.vendor === vendor ||
            s.bills.find((b) => b._id === r.data.bill)?.data.vendor === vendor ||
            s.payments.find((p) => p._id === r.data.payment)?.data.vendor === vendor,
        )
        .filter((r) => type !== 'payments' || ['payment', 'refund'].includes(r.kind))
        .map((r) => [
          r.kind,
          r.data.date,
          r.data.description || r.data.reference || r.data.reason || '',
          (r.data.total ?? r.data.amount) / 100,
          r.data.bill || r.data.payment || '',
        ]),
    ];
  } else if (['category', 'stage', 'floor', 'budget'].includes(type)) {
    const dimension = type === 'budget' ? 'category' : type;
    const grouping: { [k: string]: number } = {};
    for (const b of bills) {
      if (dimension === 'category') {
        for (const l of b.data.lines) grouping[l.category] = (grouping[l.category] || 0) + l.total;
        const shares = creditShares(b.data.lines, b.credit);
        b.data.lines.forEach((l: any, i: number) => {
          grouping[l.category] -= shares[i];
        });
      } else
        grouping[b.data[dimension] || 'Unspecified'] =
          (grouping[b.data[dimension] || 'Unspecified'] || 0) + b.total - b.credit;
    }
    rows = [
      ['Group', 'Recorded cost after credits (INR)', 'Budget (INR)'],
      ...Object.entries(grouping).map(([k, n]) => [
        k,
        n / 100,
        records.find(
          (r) =>
            r.kind === 'budget' &&
            !r.voided &&
            r.data.label === k &&
            r.data.dimension === dimension,
        )?.data.amount / 100 || '',
      ]),
    ];
  } else if (type === 'monthly') {
    rows = [
      ['Month', 'Incurred cost after credits (INR)', 'Net cash (INR)'],
      ...s.monthly
        .filter((m) => (!from || m.month >= from.slice(0, 7)) && (!to || m.month <= to.slice(0, 7)))
        .map((m) => [m.month, m.cost / 100, m.cash / 100]),
    ];
  } else if (['labour', 'progress', 'data'].includes(type)) {
    rows = [
      ['Type', 'Date', 'Description', 'Data'],
      ...records
        .filter(
          (r) =>
            !r.voided &&
            within(r) &&
            (type === 'data' ||
              (type === 'progress'
                ? r.kind === 'log'
                : ['worker', 'attendance', 'wage'].includes(r.kind))),
        )
        .map((r) => [
          r.kind,
          r.data.date,
          r.data.title || r.data.description || r.data.name,
          JSON.stringify(r.data),
        ]),
    ];
  } else fail('Unknown report type');
  if (type === 'final')
    rows.push(
      [],
      ['All-time project totals'],
      ['Project', project!.name],
      ['Recorded cost after credits (INR)', s.cost / 100],
      ['Net cash after refunds (INR)', s.cash / 100],
      ['Outstanding liabilities (INR)', s.outstanding / 100],
      ['Unallocated advances (INR)', s.advances / 100],
      [
        'Note',
        'Project completion does not settle unpaid bills. Remaining budget is not a cost-to-finish estimate.',
      ],
    );
  res
    .set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gharkhata-${type}.csv"`,
      'Cache-Control': 'no-store',
    })
    .send('\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n'));
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));
if (config.production) mountFrontend(app, config.frontendDir);
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError)
    return res
      .status(400)
      .json({ error: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
  if (err.code === 11000)
    return res.status(409).json({ error: 'This record already exists. Refresh and try again.' });
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid reference' });
  if (err instanceof multer.MulterError)
    return res
      .status(400)
      .json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Files must be under 10 MB' : err.message });
  const status = err.status || 500;
  if (status === 500)
    console.error(JSON.stringify({ level: 'error', type: err.name, code: err.code || 'INTERNAL' }));
  res
    .status(status)
    .json({ error: status === 500 ? 'Something went wrong. Please retry.' : err.message });
});
