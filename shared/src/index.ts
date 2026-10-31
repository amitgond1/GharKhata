import { z } from 'zod';

export const categories = [
  'Cement',
  'Steel',
  'Bricks and blocks',
  'Sand',
  'Aggregate',
  'Concrete',
  'Labour',
  'Contractor charges',
  'Plumbing',
  'Electrical',
  'Tiles and flooring',
  'Doors and windows',
  'Paint',
  'Waterproofing',
  'Woodwork',
  'Equipment rental',
  'Transport',
  'Professional fees',
  'Permits',
  'Miscellaneous',
] as const;
export const stages = [
  'Site preparation',
  'Foundation',
  'Plinth',
  'Ground-floor structure',
  'Upper-floor structure',
  'Masonry',
  'Plumbing',
  'Electrical',
  'Plastering',
  'Flooring',
  'Painting',
  'Finishing',
  'External work',
] as const;
export const units = [
  'Bag',
  'Kilogram',
  'Tonne',
  'Piece',
  'Cubic foot',
  'Cubic metre',
  'Square foot',
  'Metre',
  'Litre',
  'Trip',
  'Day',
  'Fixed amount',
] as const;
export const roles = ['owner', 'manager', 'contributor', 'viewer'] as const;
export type Role = (typeof roles)[number];
export const money = z.number().int().nonnegative().max(1_000_000_000_00);
export const positiveMoney = money.refine((v) => v > 0, 'Enter an amount greater than zero');
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine(
    (s) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
    'Invalid date',
  );
const text = z.string().trim().max(2000);
const name = z.string().trim().min(1).max(160);
const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid reference');
const attachments = z.array(id).max(10).default([]);
export const projectSchema = z
  .object({
    name,
    type: z.enum(['construction', 'renovation']).default('construction'),
    location: text.default(''),
    startDate: dateOnly,
    endDate: dateOnly.optional(),
    floors: z.number().int().min(1).max(100).default(2),
    budget: money.default(0),
    area: z.number().positive().max(1e7).optional(),
    plotArea: z.number().positive().max(1e7).optional(),
    areaUnit: z.enum(['sq ft', 'sq m']).default('sq ft'),
    status: z.enum(['planned', 'active', 'paused', 'completed']).default('active'),
    timezone: z.literal('Asia/Kolkata').default('Asia/Kolkata'),
    cover: id.optional(),
    threshold: z.number().int().min(1).max(100).default(90),
    estimate: money.default(0),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    message: 'Completion date cannot precede the start date',
    path: ['endDate'],
  });
export const vendorSchema = z.object({
  name,
  phone: text.max(30).default(''),
  business: text.default(''),
  address: text.default(''),
  type: z.enum(['supplier', 'contractor', 'labour', 'other']).default('supplier'),
  tax: text.default(''),
  notes: text.default(''),
});
const line = z.object({
  description: name,
  category: name,
  quantity: z
    .string()
    .regex(/^\d{1,9}(\.\d{1,3})?$/)
    .refine((v) => Number(v) > 0),
  unit: z.enum(units).default('Fixed amount'),
  rate: money,
  discount: money.default(0),
  tax: money.default(0),
  transport: money.default(0),
  other: money.default(0),
});
const common = { date: dateOnly, notes: text.default(''), attachments };
export const billSchema = z.object({
  ...common,
  description: name,
  vendor: id.optional(),
  invoice: text.max(100).default(''),
  dueDate: dateOnly.optional(),
  floor: text.max(80).default(''),
  room: text.max(80).default(''),
  stage: text.max(100).default(''),
  lines: z.array(line).min(1).max(100),
  paid: money.default(0),
  method: z.enum(['cash', 'UPI', 'bank transfer', 'cheque', 'other']).default('UPI'),
  historical: z.boolean().default(false),
});
export const paymentSchema = z.object({
  ...common,
  amount: positiveMoney,
  vendor: id,
  payee: name,
  method: z.enum(['cash', 'UPI', 'bank transfer', 'cheque', 'other']),
  reference: text.max(150).default(''),
  paidBy: text.max(160).default(''),
  allocations: z
    .array(z.object({ bill: id, amount: positiveMoney }))
    .max(100)
    .default([]),
});
export const allocationSchema = z.object({
  date: dateOnly,
  payment: id,
  bill: id,
  amount: positiveMoney,
});
export const creditSchema = z.object({ ...common, bill: id, amount: positiveMoney, reason: name });
export const refundSchema = z.object({
  ...common,
  payment: id,
  amount: positiveMoney,
  reason: name,
});
export const workerSchema = z.object({
  name,
  trade: name,
  phone: text.max(30).default(''),
  rate: positiveMoney,
  vendor: id,
});
export const attendanceSchema = z.object({
  date: dateOnly,
  worker: id,
  units: z
    .string()
    .regex(/^\d{1,2}(\.\d{1,3})?$/, 'Use up to three decimal places')
    .refine((v) => Number(v) <= 24, 'Approved units must be at most 24'),
  notes: text.default(''),
});
export const wageSchema = z.object({
  date: dateOnly,
  worker: id,
  attendance: z.array(id).min(1).max(100),
  description: name,
});
export const taskSchema = z.object({
  title: name,
  dueDate: dateOnly,
  assignee: text.max(160).default(''),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  stage: text.default(''),
  status: z.enum(['pending', 'in progress', 'done']).default('pending'),
  checklist: z
    .array(z.object({ title: name, done: z.boolean() }))
    .max(30)
    .default([]),
  attachments,
});
export const logSchema = z.object({
  ...common,
  title: name,
  stage: text.default(''),
  floor: text.default(''),
  problems: text.default(''),
  labourCount: z.number().int().min(0).max(10000).optional(),
  captions: z.array(text).max(10).default([]),
});
export const budgetSchema = z.object({
  dimension: z.enum(['category', 'stage']),
  label: name,
  amount: money,
});
export const contractSchema = z.object({
  vendor: id,
  title: name,
  scope: text.min(1),
  amount: positiveMoney,
  startDate: dateOnly,
  endDate: dateOnly,
  milestones: z
    .array(z.object({ title: name, amount: money, date: dateOnly }))
    .max(30)
    .default([]),
  changes: text.default(''),
  attachments,
});
export const stockSchema = z.object({
  date: dateOnly,
  material: name,
  unit: z.enum(units),
  type: z.enum(['received', 'used', 'wastage', 'returned', 'adjustment']),
  quantity: z.string().regex(/^-?\d{1,9}(\.\d{1,3})?$/),
  threshold: z
    .string()
    .regex(/^\d{1,9}(\.\d{1,3})?$/)
    .optional(),
  bill: id.optional(),
  line: z.number().int().nonnegative().optional(),
  notes: text.default(''),
});
export const schemas = {
  bill: billSchema,
  payment: paymentSchema,
  allocation: allocationSchema,
  credit: creditSchema,
  refund: refundSchema,
  worker: workerSchema,
  attendance: attendanceSchema,
  wage: wageSchema,
  task: taskSchema,
  log: logSchema,
  budget: budgetSchema,
  contract: contractSchema,
  stock: stockSchema,
};
export type Kind = keyof typeof schemas;
export interface LedgerRecord {
  _id: string;
  kind: Kind;
  data: any;
  voided: boolean;
  createdAt: string;
  createdBy: string;
}
export function paise(value: string): number {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value.trim()))
    throw new Error('Enter rupees with up to two decimal places');
  const [whole, fraction = ''] = value.trim().split('.');
  return Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')));
}
export function scaledQuantity(value: string): bigint {
  const [a, b = ''] = value.split('.');
  return BigInt(a) * 1000n + BigInt((a.startsWith('-') ? '-' : '') + b.padEnd(3, '0'));
}
export function wageAmount(rate: number, units: string): number {
  return Number((BigInt(rate) * scaledQuantity(units) + 500n) / 1000n);
}
export function lineTotal(item: z.infer<typeof line>): number {
  const base = (scaledQuantity(item.quantity) * BigInt(item.rate) + 500n) / 1000n;
  const total =
    base - BigInt(item.discount) + BigInt(item.tax) + BigInt(item.transport) + BigInt(item.other);
  if (total < 0n || total > 100_000_000_000n) throw new Error('Invalid line total');
  return Number(total);
}
export function billTotal(lines: z.infer<typeof line>[]): number {
  const n = lines.reduce((s, l) => s + BigInt(lineTotal(l)), 0n);
  if (n > 100_000_000_000n) throw new Error('Bill exceeds limit');
  return Number(n);
}
/** Proportional credit allocation using largest remainders; no line can go negative. */
export function creditShares(lines: { total: number }[], credit: number): number[] {
  const total = lines.reduce((s, l) => s + BigInt(l.total), 0n);
  if (total === 0n) return lines.map(() => 0);
  const parts = lines.map((l, i) => ({
    i,
    n: (BigInt(l.total) * BigInt(credit)) / total,
    remainder: (BigInt(l.total) * BigInt(credit)) % total,
  }));
  let remaining = BigInt(credit) - parts.reduce((s, p) => s + p.n, 0n);
  const order = [...parts].sort((a, b) =>
    a.remainder === b.remainder ? a.i - b.i : a.remainder > b.remainder ? -1 : 1,
  );
  for (const p of order) {
    if (remaining === 0n) break;
    p.n++;
    remaining--;
  }
  return parts.map((p) => Number(p.n));
}
export function formatMoney(n: number, compact = false): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(n / 100);
}
export function today(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
