import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  billTotal,
  lineTotal,
  paise,
  dateOnly,
  scaledQuantity,
  creditShares,
  wageAmount,
} from '@gharkhata/shared';
import { summarize, summarizeSelection, assertMember } from '../src/finance.ts';
const record = (kind: any, data: any, id: string) => ({
  _id: id,
  kind,
  data,
  voided: false,
  createdAt: '',
  createdBy: 'test',
});
test('integer paise and quantity rounding are exact', () => {
  assert.equal(paise('400.25'), 40025);
  assert.equal(paise('0.01'), 1);
  assert.throws(() => paise('2.001'));
  const line = {
    description: 'Cement',
    category: 'Cement',
    quantity: '100',
    unit: 'Bag' as const,
    rate: 40000,
    discount: 0,
    tax: 0,
    transport: 0,
    other: 0,
  };
  assert.equal(billTotal([line]), 4000000);
  assert.equal(lineTotal({ ...line, quantity: '0.125', rate: 101 }), 13);
  assert.equal(scaledQuantity('-1.250'), -1250n);
  assert.equal(wageAmount(101, '1.125'), 114);
  assert.throws(() => lineTotal({ ...line, discount: 5000000 }));
});
test('bill 40000 with 15000 and 10000 payments has 15000 outstanding', () => {
  const rows = [
    record(
      'bill',
      { total: 4000000, date: '2026-11-01', lines: [{ category: 'Cement', total: 4000000 }] },
      'b',
    ),
    record('payment', { amount: 1500000, date: '2026-11-10' }, 'p1'),
    record('payment', { amount: 1000000, date: '2026-11-15' }, 'p2'),
    record('allocation', { bill: 'b', payment: 'p1', amount: 1500000 }, 'a1'),
    record('allocation', { bill: 'b', payment: 'p2', amount: 1000000 }, 'a2'),
  ];
  const s = summarize(rows);
  assert.equal(s.cost, 4000000);
  assert.equal(s.cash, 2500000);
  assert.equal(s.outstanding, 1500000);
  assert.equal(s.advances, 0);
  assert.equal(s.bills[0].status, 'partial');
});
test('advances, allocation, credit and refund have separate financial effects', () => {
  const rows = [
    record(
      'bill',
      { total: 4000000, date: '2026-11-01', lines: [{ category: 'Cement', total: 4000000 }] },
      'b',
    ),
    record('payment', { amount: 2000000, date: '2026-11-01' }, 'p'),
  ];
  let s = summarize(rows);
  assert.equal(s.cost, 4000000);
  assert.equal(s.advances, 2000000);
  rows.push(record('allocation', { bill: 'b', payment: 'p', amount: 1000000 }, 'a'));
  s = summarize(rows);
  assert.equal(s.cash, 2000000);
  assert.equal(s.advances, 1000000);
  rows.push(
    record('credit', { bill: 'b', amount: 500000, date: '2026-11-02' }, 'c'),
    record('refund', { payment: 'p', amount: 200000, date: '2026-11-03' }, 'r'),
  );
  s = summarize(rows);
  assert.equal(s.cost, 3500000);
  assert.equal(s.cash, 1800000);
  assert.equal(s.outstanding, 2500000);
  assert.equal(s.advances, 800000);
  assert.equal(s.category.Cement, 3500000);
  assert.equal(s.cost - s.cash, s.outstanding - s.advances);
});
test('business dates are strict date-only values', () => {
  assert.equal(dateOnly.parse('2026-11-10'), '2026-11-10');
  assert.throws(() => dateOnly.parse('2026-02-30'));
  assert.throws(() => dateOnly.parse('2026-11-10T00:00:00Z'));
});
test('authorization roles deny missing memberships and viewer writes', () => {
  assert.throws(() => assertMember(undefined), /Project not found/);
  assert.throws(() => assertMember('viewer', true), /role/);
  assert.throws(() => assertMember('contributor', true, true), /role/);
  assert.doesNotThrow(() => assertMember('manager', true, true));
  assert.doesNotThrow(() => assertMember('viewer'));
});
test('many tiny category lines reconcile after credits without negative categories', () => {
  const lines = Array.from({ length: 100 }, () => ({ total: 1 }));
  const shares = creditShares(lines, 99);
  assert.equal(
    shares.reduce((s, n) => s + n, 0),
    99,
  );
  assert.ok(shares.every((n) => n === 0 || n === 1));
  const records = [
    record(
      'bill',
      {
        total: 100,
        date: '2026-11-01',
        lines: lines.map((l, i) => ({ ...l, category: `Category ${i}` })),
      },
      'tiny',
    ),
    record('credit', { bill: 'tiny', amount: 99, date: '2026-11-02' }, 'credit'),
  ];
  const s = summarize(records);
  assert.equal(s.cost, 1);
  assert.equal(
    Object.values(s.category).reduce((s, n) => s + n, 0),
    1,
  );
  assert.ok(Object.values(s.category).every((n) => n >= 0));
});
test('dashboard bill filters count only the selected share of a split payment', () => {
  const rows = [
    record(
      'bill',
      {
        description: 'A',
        total: 40000,
        date: '2026-11-01',
        vendor: 'v',
        lines: [{ category: 'Cement', total: 40000 }],
      },
      'a',
    ),
    record(
      'bill',
      {
        description: 'B',
        total: 60000,
        date: '2026-11-01',
        vendor: 'v',
        lines: [{ category: 'Steel', total: 60000 }],
      },
      'b',
    ),
    record('payment', { amount: 100000, date: '2026-11-02', vendor: 'v' }, 'p'),
    record('allocation', { bill: 'a', payment: 'p', amount: 40000, date: '2026-11-02' }, 'aa'),
    record('allocation', { bill: 'b', payment: 'p', amount: 60000, date: '2026-11-02' }, 'ab'),
  ];
  const s = summarizeSelection(rows, 200000, { category: 'Cement' });
  assert.equal(s.cost, 40000);
  assert.equal(s.cash, 40000);
  assert.equal(s.outstanding, 0);
  assert.equal(s.bills.length, 1);
  assert.equal(s.advances, 0);
  assert.equal(s.budget, 200000);
});
