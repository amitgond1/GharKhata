import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import sharp from 'sharp';
import { app } from '../src/app.ts';
import { connect, Membership, Token, Attachment } from '../src/models.ts';
import { config } from '../src/config.ts';
const db = `gharkhata_test_${randomUUID().replaceAll('-', '')}`;
let owner: any, other: any, viewer: any;
let project: string, foreign: string, vendor: string, bill: string;
let snapshot: any;
const path = (suffix = '') => `/api/projects/${project}${suffix}`;
async function account(name: string) {
  const agent = request.agent(app);
  const result = await agent
    .post('/api/auth/register')
    .send({
      name,
      email: `${randomUUID()}@example.com`,
      password: 'Test-password-2026',
      language: 'en',
    })
    .expect(201);
  return { agent, csrf: result.body.csrf, user: result.body.user };
}
const write = (account: any, url: string, data: any, key: string = randomUUID()) =>
  account.agent.post(url).set('x-csrf-token', account.csrf).set('Idempotency-Key', key).send(data);
const add = (kind: string, data: any, key?: string) =>
  write(owner, path(`/records/${kind}`), data, key);
const expense = (amount: number, paid = 0, description = 'Cement · 100 bags') => ({
  description,
  date: '2026-11-01',
  vendor,
  paid,
  lines: [
    { description: 'Cement', category: 'Cement', quantity: '100', unit: 'Bag', rate: amount / 100 },
  ],
  method: 'cash',
});
const payment = (amount: number, allocations: any[] = []) => ({
  date: '2026-11-10',
  amount,
  vendor,
  payee: 'Test supplier',
  method: 'UPI',
  allocations,
});
const get = async () => {
  const r = await owner.agent.get(path('/snapshot')).expect(200);
  snapshot = r.body;
  return r.body.summary;
};
before(async () => {
  const uri = new URL(config.mongo);
  uri.pathname = '/' + db;
  await connect(uri.toString());
  owner = await account('Owner');
  other = await account('Other owner');
  viewer = await account('Viewer');
  const p = await write(owner, '/api/projects', {
    name: 'Financial acceptance project',
    startDate: '2026-11-01',
    budget: 10000000,
  }).expect(201);
  project = p.body._id;
  const f = await write(other, '/api/projects', {
    name: 'Other private home',
    startDate: '2026-11-01',
  }).expect(201);
  foreign = f.body._id;
  const v = await write(owner, path('/vendors'), { name: 'Test supplier' }).expect(201);
  vendor = v.body._id;
  await Membership.create({ project, user: viewer.user.id, role: 'viewer' });
});
after(async () => {
  if (!mongoose.connection.name.startsWith('gharkhata_test_'))
    throw new Error('Refusing to clean a non-test database');
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
test('creates a bill and immediate payment atomically; partial payment preserves cost', async () => {
  const r = await add('bill', expense(4000000, 1500000)).expect(201);
  bill = r.body._id;
  await add('payment', payment(1000000, [{ bill, amount: 1000000 }])).expect(201);
  const s = await get();
  assert.equal(s.cost, 4000000);
  assert.equal(s.cash, 2500000);
  assert.equal(s.outstanding, 1500000);
  assert.equal(s.advances, 0);
  assert.equal(s.bills[0].data.date, '2026-11-01');
});
test('vendor advance and later allocation do not duplicate costs or cash', async () => {
  const p = await add('payment', payment(500000)).expect(201);
  let s = await get();
  assert.equal(s.cost, 4000000);
  assert.equal(s.cash, 3000000);
  assert.equal(s.advances, 500000);
  await add('allocation', { payment: p.body._id, bill, amount: 200000, date: '2026-11-11' }).expect(
    201,
  );
  s = await get();
  assert.equal(s.cash, 3000000);
  assert.equal(s.cost, 4000000);
  assert.equal(s.advances, 300000);
  assert.equal(s.outstanding, 1300000);
});
test('credits reduce cost; refunds reduce cash without double subtraction', async () => {
  await add('credit', { bill, amount: 500000, date: '2026-11-11', reason: 'Returned bags' }).expect(
    201,
  );
  const s1 = await get();
  const advance = s1.payments.find((p: any) => p.available === 300000);
  await add('refund', {
    payment: advance._id,
    amount: 100000,
    date: '2026-11-12',
    reason: 'Unused deposit',
  }).expect(201);
  const s = await get();
  assert.equal(s.cost, 3500000);
  assert.equal(s.cash, 2900000);
  assert.equal(s.outstanding, 800000);
  assert.equal(s.advances, 200000);
  assert.equal(s.category.Cement, 3500000);
  assert.equal(s.cost - s.cash, s.outstanding - s.advances);
});
test('duplicate payment submissions return the original record; key reuse with changed content conflicts', async () => {
  const key = randomUUID();
  const data = payment(10000);
  const a = await add('payment', data, key).expect(201);
  const b = await add('payment', data, key).expect(201);
  assert.equal(a.body._id, b.body._id);
  await add('payment', payment(20000), key).expect(409);
  const s = await get();
  assert.equal(s.cash, 2910000);
});
test('overallocations roll back the complete write', async () => {
  await add('payment', payment(900000, [{ bill, amount: 900000 }])).expect(400);
  await add('bill', expense(4000000, 5000000)).expect(400);
  await add('credit', { bill, amount: 900000, date: '2026-11-12', reason: 'Too much' }).expect(400);
  const s = await get();
  assert.equal(s.cash, 2910000);
  assert.equal(s.bills.length, 1);
});
test('concurrent payments cannot overallocate a bill', async () => {
  const r = await add('bill', expense(10000, 0, 'Concurrency test')).expect(201);
  const id = r.body._id;
  const results = await Promise.all([
    add('payment', payment(7000, [{ bill: id, amount: 7000 }])),
    add('payment', payment(7000, [{ bill: id, amount: 7000 }])),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
  const s = await get();
  assert.equal(s.bills.find((b: any) => b._id === id).outstanding, 3000);
});
test('concurrent immediate payments retain payment data on transaction retry', async () => {
  const results = await Promise.all([
    add('bill', expense(10000, 5000, 'Concurrent atomic A')),
    add('bill', expense(10000, 5000, 'Concurrent atomic B')),
  ]);
  assert.deepEqual(
    results.map((r) => r.status),
    [201, 201],
  );
  const s = await get();
  for (const r of results) assert.equal(s.bills.find((b: any) => b._id === r.body._id).paid, 5000);
});
test('members cannot read another project; cross-project references are rejected', async () => {
  await owner.agent.get(`/api/projects/${foreign}/snapshot`).expect(404);
  await other.agent.get(path('/snapshot')).expect(404);
  const fv = await write(other, `/api/projects/${foreign}/vendors`, {
    name: 'Foreign supplier',
  }).expect(201);
  await add('payment', { ...payment(10000), vendor: fv.body._id }).expect(400);
});
test('viewer writes and missing CSRF tokens are denied', async () => {
  await viewer.agent.get(path('/snapshot')).expect(200);
  await write(viewer, path('/records/bill'), expense(10000)).expect(403);
  await owner.agent.post(path('/records/bill')).send(expense(10000)).expect(403);
  await write(owner, path('/records/bill'), expense(10000))
    .set('Origin', 'https://evil.example')
    .expect(403);
  await owner.agent.get(path('/audit')).expect(200);
});
test('worker attendance can only be billed once', async () => {
  const w = await add('worker', {
    name: 'Masonry team',
    trade: 'Masonry',
    rate: 150000,
    vendor,
  }).expect(201);
  const a = await add('attendance', {
    worker: w.body._id,
    date: '2026-11-10',
    units: '0.5',
  }).expect(201);
  await add('attendance', { worker: w.body._id, date: '2026-11-10', units: '1' }).expect(409);
  const wage = {
    worker: w.body._id,
    date: '2026-11-11',
    attendance: [a.body._id],
    description: 'Approved half-day wages',
  };
  const result = await add('wage', wage).expect(201);
  assert.equal(result.body.data.total, 75000);
  await add('wage', wage).expect(409);
  const s = await get();
  assert.equal(s.bills.find((b: any) => b._id === result.body.data.bill).total, 75000);
});
test('stock receipt links do not add cost; duplicates and incompatible units are rejected', async () => {
  const before = await get();
  await add('stock', {
    date: '2026-11-10',
    material: 'Cement',
    unit: 'Bag',
    type: 'received',
    quantity: '100',
    bill,
    line: 0,
  }).expect(201);
  await add('stock', {
    date: '2026-11-10',
    material: 'Cement',
    unit: 'Bag',
    type: 'received',
    quantity: '1',
    bill,
    line: 0,
  }).expect(400);
  await add('stock', {
    date: '2026-11-10',
    material: 'Cement',
    unit: 'Tonne',
    type: 'received',
    quantity: '1',
    bill,
    line: 0,
  }).expect(400);
  await add('stock', {
    date: '2026-11-10',
    material: 'Cement',
    unit: 'Bag',
    type: 'used',
    quantity: '101',
  }).expect(400);
  const s = await get();
  assert.equal(s.cost, before.cost);
});
test('private uploads validate signatures and project membership', async () => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#449977' } })
    .png()
    .toBuffer();
  const result = await owner.agent
    .post(path('/attachments'))
    .set('x-csrf-token', owner.csrf)
    .attach('file', png, { filename: 'receipt.png', contentType: 'image/png' })
    .expect(201);
  const url = path(`/attachments/${result.body._id}`);
  await owner.agent
    .get(url)
    .expect(200)
    .expect('Content-Type', /image\/jpeg/);
  await other.agent.get(url).expect(404);
  await viewer.agent
    .post(path('/attachments'))
    .set('x-csrf-token', viewer.csrf)
    .attach('file', png, { filename: 'receipt.png', contentType: 'image/png' })
    .expect(403);
  await owner.agent
    .post(path('/attachments'))
    .set('x-csrf-token', owner.csrf)
    .attach('file', Buffer.from('MZ executable'), {
      filename: 'fake.png',
      contentType: 'image/png',
    })
    .expect(400);
  const foreignAttach = await Attachment.create({
    project: foreign,
    name: 'foreign',
    key: randomUUID(),
    mime: 'image/jpeg',
  });
  await add('bill', { ...expense(10000), attachments: [String(foreignAttach._id)] }).expect(400);
});
test('CSV export totals match dashboard and neutralize spreadsheet formulas', async () => {
  await add('bill', expense(10000, 0, '=HYPERLINK("bad")')).expect(201);
  const s = await get();
  const result = await owner.agent.get(path('/export?type=final')).expect(200);
  assert.ok(result.text.includes(`"Recorded cost after credits (INR)","${s.cost / 100}"`));
  assert.ok(result.text.includes(`"Net cash after refunds (INR)","${s.cash / 100}"`));
  assert.ok(result.text.includes("'" + '=HYPERLINK'));
  const categories = await owner.agent.get(path('/export?type=category')).expect(200);
  assert.ok(categories.text.includes('"Cement"'));
});
test('financial history cannot be deleted while linked records exist', async () => {
  await write(owner, path(`/records/${bill}/void`), { reason: 'Correction test' }).expect(400);
  const s = await get();
  assert.ok(s.bills.some((b: any) => b._id === bill));
});
test('paginated records have derived balances and honor filters', async () => {
  const result = await owner.agent
    .get(path('/records?kind=bill&limit=1&page=1&sort=amount'))
    .expect(200);
  assert.equal(result.body.records.length, 1);
  assert.ok(result.body.total > 1);
  assert.equal(result.body.records[0].outstanding, 800000);
  const empty = await owner.agent.get(path('/records?kind=bill&q=no-such-invoice')).expect(200);
  assert.equal(empty.body.total, 0);
  await other.agent.get(path('/records')).expect(404);
});
test('project covers and task updates reject foreign attachment references', async () => {
  const a = await Attachment.findOne({ project: foreign });
  await owner.agent
    .patch(path())
    .set('x-csrf-token', owner.csrf)
    .set('Idempotency-Key', randomUUID())
    .send({ name: 'Financial acceptance project', startDate: '2026-11-01', cover: String(a!._id) })
    .expect(400);
  const task = await add('task', { title: 'Review receipt', dueDate: '2026-11-20' }).expect(201);
  await owner.agent
    .patch(path(`/tasks/${task.body._id}`))
    .set('x-csrf-token', owner.csrf)
    .set('Idempotency-Key', randomUUID())
    .send({ ...task.body.data, attachments: [String(a!._id)] })
    .expect(400);
});
test('operational edits preserve historical wage rates and deny financial edits', async () => {
  await get();
  const worker = snapshot.records.find((r: any) => r.kind === 'worker');
  await owner.agent
    .patch(path(`/records/${worker._id}`))
    .set('x-csrf-token', owner.csrf)
    .set('Idempotency-Key', randomUUID())
    .send({ ...worker.data, rate: 180000 })
    .expect(200);
  await viewer.agent
    .patch(path(`/records/${worker._id}`))
    .set('x-csrf-token', viewer.csrf)
    .set('Idempotency-Key', randomUUID())
    .send({ ...worker.data, rate: 190000 })
    .expect(403);
  await owner.agent
    .patch(path(`/records/${bill}`))
    .set('x-csrf-token', owner.csrf)
    .set('Idempotency-Key', randomUUID())
    .send(expense(10000))
    .expect(400);
  const s = await get();
  assert.equal(snapshot.records.find((r: any) => r.kind === 'attendance').data.rate, 150000);
  assert.equal(
    s.bills.find((b: any) => b.data.description === 'Approved half-day wages').total,
    75000,
  );
});
test('dashboard filters and matching bill exports agree', async () => {
  const result = await owner.agent.get(path('/dashboard?category=Labour')).expect(200);
  assert.equal(result.body.summary.cost, 75000);
  assert.equal(result.body.summary.cash, 0);
  assert.equal(result.body.summary.outstanding, 75000);
  assert.equal(result.body.summary.bills.length, 1);
  const exported = await owner.agent.get(path('/export?type=bills&category=Labour')).expect(200);
  assert.ok(exported.text.includes('Approved half-day wages'));
  assert.ok(!exported.text.includes('Concurrency test'));
  await other.agent.get(path('/dashboard?category=Labour')).expect(404);
});
test('email-bound invitations, role restrictions and revocation work end to end', async () => {
  const invited = await account('Invited contributor');
  const result = await write(owner, path('/invitations'), {
    email: invited.user.email,
    role: 'contributor',
  }).expect(200);
  const token = new URL(result.body.developmentPreview.url).searchParams.get('token');
  await write(viewer, '/api/invitations/accept', { token }).expect(400);
  await write(invited, '/api/invitations/accept', { token }).expect(200);
  await invited.agent.get(path('/snapshot')).expect(200);
  await write(invited, path('/records/budget'), {
    dimension: 'category',
    label: 'Cement',
    amount: 10000,
  }).expect(403);
  const pending = await write(owner, path('/invitations'), {
    email: invited.user.email,
    role: 'manager',
  }).expect(200);
  const pendingToken = new URL(pending.body.developmentPreview.url).searchParams.get('token');
  const member = await Membership.findOne({ project, user: invited.user.id });
  await owner.agent
    .delete(path(`/members/${member!._id}`))
    .set('x-csrf-token', owner.csrf)
    .expect(200);
  await invited.agent.get(path('/snapshot')).expect(404);
  await write(invited, '/api/invitations/accept', { token: pendingToken }).expect(400);
  const otherInvite = await write(owner, path('/invitations'), {
    email: 'unused@example.com',
    role: 'viewer',
  }).expect(200);
  const list = await owner.agent.get(path('/invitations')).expect(200);
  assert.ok(list.body.length > 0);
  await owner.agent
    .delete(path(`/invitations/${list.body[0]._id}`))
    .set('x-csrf-token', owner.csrf)
    .expect(200);
});
test('expired reset links are rejected independently of TTL cleanup', async () => {
  const person = await account('Expired reset');
  const r = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: person.user.email })
    .expect(200);
  const token = new URL(r.body.developmentPreview.url).searchParams.get('token');
  await Token.updateMany(
    { user: person.user.id, type: 'reset' },
    { expiresAt: new Date(Date.now() - 1000) },
  );
  await request(app)
    .post('/api/auth/reset-password')
    .send({ token, password: 'New-password-2026' })
    .expect(400);
});
test('normal session checks do not consume the password-attempt rate limit', async () => {
  for (let i = 0; i < 81; i++) await owner.agent.get('/api/auth/me').expect(200);
  const fresh = await account('Phone session regression');
  await fresh.agent.get('/api/auth/me').expect(200);
});
test('password reset is expiring and single-use, and revokes sessions', async () => {
  const r = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: other.user.email })
    .expect(200);
  assert.ok(r.body.developmentPreview);
  const token = new URL(r.body.developmentPreview.url).searchParams.get('token');
  await request(app)
    .post('/api/auth/reset-password')
    .send({ token, password: 'New-password-2026' })
    .expect(200);
  await request(app)
    .post('/api/auth/reset-password')
    .send({ token, password: 'Another-password-2026' })
    .expect(400);
  await other.agent.get('/api/auth/me').expect(401);
  await request(app)
    .post('/api/auth/login')
    .send({ email: other.user.email, password: 'New-password-2026' })
    .expect(200);
});
