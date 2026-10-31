import { creditShares, type LedgerRecord } from '@gharkhata/shared';
export function summarize(records: LedgerRecord[], budget = 0) {
  const live = records.filter((r) => !r.voided);
  const of = (kind: string) => live.filter((r) => r.kind === kind);
  const sum = (rs: LedgerRecord[], key = 'amount') => {
    const n = rs.reduce((s, r) => s + BigInt(r.data[key]), 0n);
    if (n > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error('Financial total exceeds the supported range');
    return Number(n);
  };
  const allocations = of('allocation');
  const credits = of('credit');
  const refunds = of('refund');
  const bills = of('bill').map((r) => {
    const credit = sum(credits.filter((c) => c.data.bill === r._id));
    const paid = sum(allocations.filter((a) => a.data.bill === r._id));
    return {
      ...r,
      total: r.data.total,
      credit,
      paid,
      outstanding: r.data.total - credit - paid,
      status:
        credit === r.data.total
          ? 'credited'
          : paid === r.data.total - credit
            ? 'paid'
            : paid > 0
              ? 'partial'
              : 'unpaid',
    };
  });
  const payments = of('payment').map((r) => ({
    ...r,
    available:
      r.data.amount -
      sum(allocations.filter((a) => a.data.payment === r._id)) -
      sum(refunds.filter((a) => a.data.payment === r._id)),
  }));
  const cost = sum(of('bill'), 'total') - sum(credits);
  const cash = sum(of('payment')) - sum(refunds);
  const outstanding = bills.reduce((s, b) => s + b.outstanding, 0);
  const advances = payments.reduce((s, p) => s + p.available, 0);
  const category: Record<string, number> = {};
  const stage: Record<string, number> = {};
  const floor: Record<string, number> = {};
  const monthly: Record<string, { month: string; cost: number; cash: number }> = {};
  const month = (date: string) =>
    (monthly[date.slice(0, 7)] ??= { month: date.slice(0, 7), cost: 0, cash: 0 });
  for (const b of bills) {
    month(b.data.date).cost += b.total;
    const shares = creditShares(b.data.lines, b.credit);
    b.data.lines.forEach(
      (l: any, i: number) =>
        (category[l.category] = (category[l.category] || 0) + l.total - shares[i]),
    );
    stage[b.data.stage || 'Unspecified'] =
      (stage[b.data.stage || 'Unspecified'] || 0) + b.total - b.credit;
    floor[b.data.floor || 'Unspecified'] =
      (floor[b.data.floor || 'Unspecified'] || 0) + b.total - b.credit;
  }
  for (const c of credits) month(c.data.date).cost -= c.data.amount;
  for (const p of of('payment')) month(p.data.date).cash += p.data.amount;
  for (const r of refunds) month(r.data.date).cash -= r.data.amount;
  return {
    budget,
    cost,
    cash,
    outstanding,
    advances,
    remaining: budget - cost,
    overrun: Math.max(0, cost - budget),
    bills,
    payments,
    category,
    stage,
    floor,
    monthly: Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)),
  };
}
export function assertMember(role: string | undefined, write = false, manager = false) {
  if (!role) throw Object.assign(new Error('Project not found'), { status: 404 });
  if ((write && role === 'viewer') || (manager && !['owner', 'manager'].includes(role!)))
    throw Object.assign(new Error('Your role does not allow this action'), { status: 403 });
}

export interface BillFilters {
  from?: string;
  to?: string;
  vendor?: string;
  category?: string;
  floor?: string;
  stage?: string;
  status?: string;
}
export function matchesBill(b: any, f: BillFilters) {
  return (
    (!f.from || b.data.date >= f.from) &&
    (!f.to || b.data.date <= f.to) &&
    (!f.vendor || b.data.vendor === f.vendor) &&
    (!f.category || b.data.lines.some((l: any) => l.category === f.category)) &&
    (!f.floor || b.data.floor === f.floor) &&
    (!f.stage || b.data.stage === f.stage) &&
    (!f.status || b.status === f.status)
  );
}
/** A bill selection shows allocated settlement, never the whole cash value of a split payment. */
export function summarizeSelection(records: LedgerRecord[], budget: number, filters: BillFilters) {
  const state = summarize(records, budget);
  const bills = state.bills.filter((b) => matchesBill(b, filters));
  const ids = new Set(bills.map((b) => b._id));
  const related = records.filter(
    (r) =>
      !r.voided &&
      (r.kind === 'bill'
        ? ids.has(r._id)
        : ['allocation', 'credit'].includes(r.kind) && ids.has(r.data.bill)),
  );
  const allocations = related.filter((r) => r.kind === 'allocation');
  for (const p of state.payments) {
    const amount = allocations
      .filter((a) => a.data.payment === p._id)
      .reduce((n, a) => n + a.data.amount, 0);
    if (amount) related.push({ ...p, data: { ...p.data, amount } });
  }
  return summarize(related, budget);
}
