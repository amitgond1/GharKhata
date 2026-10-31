import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import {
  schemas,
  billTotal,
  lineTotal,
  scaledQuantity,
  wageAmount,
  type Kind,
  type LedgerRecord,
} from '@gharkhata/shared';
import { Project, Record, Vendor, Audit, Idempotency, Attachment, Membership } from './models.ts';
import { summarize, assertMember } from './finance.ts';
export function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
export const plain = (r: any) => ({
  ...r,
  _id: String(r._id),
  project: String(r.project),
  createdBy: String(r.createdBy),
});
export async function projectAccess(project: string, user: string, write = false, manager = false) {
  if (!mongoose.isValidObjectId(project)) fail('Project not found', 404);
  const m = await Membership.findOne({ project, user }).lean();
  assertMember(m?.role, write, manager);
  return m!;
}
export async function mutate(
  project: string,
  user: string,
  key: string,
  payload: any,
  work: (session: mongoose.ClientSession) => Promise<any>,
  manager = false,
) {
  if (!key || key.length > 100) fail('An idempotency key is required');
  const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return mongoose.connection.transaction(async (session) => {
    const membership = await Membership.findOne({ project, user }).session(session);
    assertMember(membership?.role, true, manager);
    await Project.updateOne({ _id: project }, { $inc: { revision: 1 } }, { session });
    const previous = await Idempotency.findOne({ project, key }).session(session);
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        fail('This request key was already used for different data', 409);
      return previous.result;
    }
    const result = await work(session);
    await Idempotency.create([{ project, key, fingerprint, result }], { session });
    return result;
  });
}
export async function createRecord(
  project: string,
  user: string,
  kind: Kind,
  input: any,
  key: string,
) {
  if (!schemas[kind]) fail('Unknown record type');
  const parsedData: any = schemas[kind].parse(input);
  const managed = [
    'allocation',
    'credit',
    'refund',
    'wage',
    'budget',
    'contract',
    'stock',
  ].includes(kind);
  return mutate(
    project,
    user,
    key,
    { kind, data: parsedData },
    async (session) => {
      const data: any = structuredClone(parsedData);
      const all = (await Record.find({ project }).session(session).lean()).map(
        plain,
      ) as LedgerRecord[];
      const state = summarize(all);
      const find = (ref: string, type: string) => {
        const r = all.find((r) => r._id === ref && r.kind === type && !r.voided);
        if (!r) fail(`Referenced ${type} is not available in this project`);
        return r!;
      };
      const vendor = async (ref: string) => {
        if (!(await Vendor.exists({ _id: ref, project }).session(session)))
          fail('Vendor is not in this project');
      };
      if (data.vendor) await vendor(data.vendor);
      if (
        data.attachments?.length &&
        (await Attachment.countDocuments({ _id: { $in: data.attachments }, project }).session(
          session,
        )) !== new Set(data.attachments).size
      )
        fail('Attachment is not in this project');
      const add = async (k: string, d: any) => {
        if (k === 'bill' || k === 'payment') {
          const field = k === 'bill' ? 'total' : 'amount';
          const sum =
            all
              .filter((r) => !r.voided && r.kind === k)
              .reduce((s, r) => s + BigInt(r.data[field]), 0n) + BigInt(d[field]);
          if (sum > BigInt(Number.MAX_SAFE_INTEGER))
            fail('Project total exceeds the supported monetary range');
        }
        const [r] = await Record.create([{ project, kind: k, data: d, createdBy: user }], {
          session,
        });
        await Audit.create(
          [{ project, user, action: `${k}.create`, target: String(r._id), after: d }],
          { session },
        );
        return plain(r.toObject());
      };
      const audit = async (action: string, target: string, after: any) => {
        await Audit.create([{ project, user, action, target, after }], { session });
      };
      const canAllocate = (payment: string, bill: string, amount: number) => {
        const p = state.payments.find((p) => p._id === payment);
        const b = state.bills.find((b) => b._id === bill);
        if (!p || !b) fail('Bill or payment not available');
        if (p!.data.vendor !== b!.data.vendor) fail('Bill and payment must have the same vendor');
        if (amount > p!.available || amount > b!.outstanding)
          fail('Allocation exceeds the available advance or outstanding bill');
        return { p: p!, b: b! };
      };
      if (kind === 'bill') {
        data.lines = data.lines.map((l: any) => ({ ...l, total: lineTotal(l) }));
        data.total = billTotal(data.lines);
        if (data.total <= 0) fail('Bill total must be greater than zero');
        if (data.paid > data.total) fail('Payment exceeds bill total');
        if (!data.vendor) {
          let v = await Vendor.findOne({ project, 'data.name': 'Cash purchase' }).session(session);
          if (!v) {
            [v] = await Vendor.create(
              [{ project, data: { name: 'Cash purchase', type: 'other' } }],
              { session },
            );
          }
          data.vendor = String(v._id);
        }
        const paid = data.paid;
        delete data.paid;
        const r = await add(kind, data);
        if (paid) {
          const p = await add('payment', {
            amount: paid,
            vendor: data.vendor,
            payee: (await Vendor.findById(data.vendor).session(session))!.data.name,
            date: data.date,
            method: data.method,
            reference: '',
            paidBy: user,
            notes: 'Recorded with bill',
            attachments: [],
          });
          await add('allocation', { payment: p._id, bill: r._id, amount: paid, date: data.date });
        }
        return r;
      }
      if (kind === 'payment') {
        let remaining = data.amount;
        const seen = new Set<string>();
        for (const a of data.allocations) {
          if (seen.has(a.bill)) fail('Combine allocations for the same bill');
          seen.add(a.bill);
          const b = state.bills.find((b) => b._id === a.bill);
          if (
            !b ||
            b.data.vendor !== data.vendor ||
            a.amount > b.outstanding ||
            a.amount > remaining
          )
            fail('Invalid allocation or amount exceeds outstanding');
          if (data.date < b.data.date)
            fail(
              'Payment date cannot precede a bill it is allocated to. Record it as an advance first.',
            );
          remaining -= a.amount;
        }
        const allocations = data.allocations;
        delete data.allocations;
        const p = await add(kind, data);
        for (const a of allocations)
          await add('allocation', {
            payment: p._id,
            bill: a.bill,
            amount: a.amount,
            date: data.date,
          });
        return p;
      }
      if (kind === 'allocation') {
        const { p, b } = canAllocate(data.payment, data.bill, data.amount);
        if (data.date < p.data.date || data.date < b.data.date)
          fail('Allocation date cannot precede the bill or payment');
      }
      if (kind === 'credit') {
        const b = state.bills.find((b) => b._id === data.bill);
        if (!b || data.amount > b.outstanding)
          fail('Credit exceeds outstanding. Reverse allocations first if a paid bill is returned.');
        if (data.date < b!.data.date) fail('Credit cannot precede bill');
      }
      if (kind === 'refund') {
        const p = state.payments.find((p) => p._id === data.payment);
        if (!p || data.amount > p.available)
          fail('Refund exceeds unallocated cash. Reverse allocations before refunding.');
        if (data.date < p!.data.date) fail('Refund cannot precede payment');
      }
      if (kind === 'attendance') {
        const worker = find(data.worker, 'worker');
        if (
          all.some(
            (r) =>
              r.kind === 'attendance' &&
              !r.voided &&
              r.data.worker === data.worker &&
              r.data.date === data.date,
          )
        )
          fail('Attendance is already recorded for this worker and date', 409);
        data.rate = worker.data.rate;
      }
      if (kind === 'wage') {
        const worker = find(data.worker, 'worker');
        const ids = new Set(data.attendance);
        if (ids.size !== data.attendance.length) fail('Duplicate attendance');
        let total = 0;
        for (const id of ids) {
          const a = find(String(id), 'attendance');
          if (a.data.worker !== data.worker) fail('Attendance belongs to another worker');
          if (a.data.date > data.date) fail('Wage approval date cannot precede attendance');
          if (all.some((r) => r.kind === 'wage' && !r.voided && r.data.attendance.includes(id)))
            fail('This attendance has already been billed', 409);
          total += wageAmount(a.data.rate, a.data.units);
        }
        if (total <= 0) fail('No payable attendance selected');
        data.total = total;
        const b = await add('bill', {
          description: data.description,
          vendor: worker.data.vendor,
          date: data.date,
          lines: [
            {
              description: data.description,
              category: 'Labour',
              quantity: '1',
              unit: 'Fixed amount',
              rate: total,
              total,
              discount: 0,
              tax: 0,
              transport: 0,
              other: 0,
            },
          ],
          total,
          notes: 'Approved attendance wage statement',
          stage: '',
          floor: '',
          attachments: [],
          historical: false,
        });
        data.bill = b._id;
      }
      if (
        kind === 'budget' &&
        all.some(
          (r) =>
            r.kind === 'budget' &&
            !r.voided &&
            r.data.dimension === data.dimension &&
            r.data.label === data.label,
        )
      )
        fail('A budget already exists for this category or stage. Archive it before replacing.');
      if (kind === 'stock') {
        const q = scaledQuantity(data.quantity);
        if (q === 0n || (data.type !== 'adjustment' && q < 0n)) fail('Enter a positive quantity');
        if (data.bill) {
          const b = find(data.bill, 'bill');
          const l = b.data.lines[data.line ?? 0];
          if (!l || l.unit !== data.unit) fail('Stock unit must match the purchase line');
          if (data.type !== 'received') fail('Only stock receipts may link a purchase line');
          const received = all
            .filter(
              (r) =>
                r.kind === 'stock' &&
                !r.voided &&
                r.data.bill === data.bill &&
                (r.data.line ?? 0) === (data.line ?? 0),
            )
            .reduce((s, r) => s + scaledQuantity(r.data.quantity), 0n);
          if (q + received > scaledQuantity(l.quantity))
            fail('Receipts exceed the purchased quantity');
        }
        const balance = all
          .filter(
            (r) =>
              r.kind === 'stock' &&
              !r.voided &&
              r.data.material === data.material &&
              r.data.unit === data.unit,
          )
          .reduce(
            (s, r) =>
              s +
              scaledQuantity(r.data.quantity) *
                (['used', 'wastage', 'returned'].includes(r.data.type) ? -1n : 1n),
            0n,
          );
        if (balance + q * (['used', 'wastage', 'returned'].includes(data.type) ? -1n : 1n) < 0n)
          fail('Stock movement would make available quantity negative');
      }
      return add(kind, data);
    },
    managed,
  );
}
export async function voidRecord(
  project: string,
  user: string,
  id: string,
  reason: string,
  key: string,
) {
  return mutate(
    project,
    user,
    key,
    { id, reason, action: 'void' },
    async (session) => {
      const r = await Record.findOne({ _id: id, project, voided: false }).session(session);
      if (!r) fail('Record not found', 404);
      const all = await Record.find({ project, voided: false }).session(session).lean();
      if (
        (r.kind === 'bill' &&
          all.some(
            (x) =>
              (x.kind === 'allocation' ||
                x.kind === 'credit' ||
                x.kind === 'stock' ||
                x.kind === 'wage') &&
              x.data.bill === id,
          )) ||
        (r.kind === 'payment' &&
          all.some(
            (x) => (x.kind === 'allocation' || x.kind === 'refund') && x.data.payment === id,
          )) ||
        (r.kind === 'attendance' &&
          all.some((x) => x.kind === 'wage' && x.data.attendance.includes(id))) ||
        r.kind === 'wage' ||
        (r.kind === 'worker' && all.some((x) => x.kind === 'attendance' && x.data.worker === id)) ||
        r.kind === 'stock'
      )
        fail(
          'This record has dependent history. Reverse dependent entries first; wage statements and stock movements require compensating records.',
        );
      if (r.kind === 'credit') {
        const s = summarize(all.map(plain) as LedgerRecord[]);
        if (s.bills.find((b) => b._id === r.data.bill)!.outstanding < 0)
          fail('Inconsistent credit');
      }
      r.voided = true;
      r.voidReason = reason;
      await r.save({ session });
      await Audit.create(
        [
          {
            project,
            user,
            action: `${r.kind}.void`,
            target: id,
            before: r.data,
            after: { reason },
          },
        ],
        { session },
      );
      return { ok: true };
    },
    true,
  );
}
