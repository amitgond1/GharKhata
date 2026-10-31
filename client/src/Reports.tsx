import { useState } from 'react';
import { creditShares } from '@gharkhata/shared';
import { Download, Printer, FileText, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { type Snapshot } from './api';
import { useUi } from './context';
import { Money, dateLabel, Empty } from './ui';
import { PageTitle } from './Records';
export function Reports({ data }: { data: Snapshot }) {
  const { t, lang } = useUi();
  const [type, setType] = useState('final');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [vendor, setVendor] = useState('');
  const s = data.summary;
  const live = data.records.filter((r) => !r.voided);
  const within = (r: any) => (!from || r.data.date >= from) && (!to || r.data.date <= to);
  const bills = s.bills.filter(within).filter((b) => !vendor || b.data.vendor === vendor);
  const filtered = type === 'outstanding' ? bills.filter((b) => b.outstanding > 0) : bills;
  const reportNames: Record<string, string> = {
    final: 'Final construction cost',
    bills: 'Complete expense report',
    payments: 'Payment report',
    outstanding: 'Outstanding bills',
    vendor: 'Vendor ledger',
    labour: 'Labour report',
    category: 'Category summary',
    stage: 'Stage summary',
    floor: 'Floor summary',
    monthly: 'Monthly summary',
    budget: 'Budget versus actual',
    progress: 'Progress diary',
    data: 'All project records',
  };
  const grouped: Record<string, number> = {};
  const dimension = type === 'budget' ? 'category' : type;
  for (const b of bills) {
    if (dimension === 'category') {
      const shares = creditShares(b.data.lines, b.credit);
      b.data.lines.forEach((l: any, i: number) => {
        grouped[l.category] = (grouped[l.category] || 0) + l.total - shares[i];
      });
    } else
      grouped[b.data[dimension] || 'Unspecified'] =
        (grouped[b.data[dimension] || 'Unspecified'] || 0) + b.total - b.credit;
  }
  const params = new URLSearchParams({
    type,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(vendor ? { vendor } : {}),
  });
  const vendorRecords = live
    .filter(within)
    .filter((r) => ['bill', 'payment', 'credit', 'refund', 'allocation'].includes(r.kind))
    .filter(
      (r) =>
        !vendor ||
        r.data.vendor === vendor ||
        s.bills.find((b) => b._id === r.data.bill)?.data.vendor === vendor ||
        s.payments.find((p) => p._id === r.data.payment)?.data.vendor === vendor,
    )
    .sort((a, b) => a.data.date.localeCompare(b.data.date));
  return (
    <>
      <div className="no-print">
        <PageTitle
          title={t('reports')}
          subtitle="A clear record for every conversation. Take your hisaab with you."
        />
        <section className="panel report-controls">
          <label className="field">
            Report
            <select aria-label="Report type" value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(reportNames).map(([k, n]) => (
                <option key={k} value={k}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t('from')}
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            {t('to')}
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="field">
            {t('vendor')}
            <select value={vendor} onChange={(e) => setVendor(e.target.value)}>
              <option value="">All vendors</option>
              {data.vendors.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.data.name}
                </option>
              ))}
            </select>
          </label>
          <div className="report-buttons">
            <a className="btn primary" href={`/api/projects/${data.project._id}/export?${params}`}>
              <Download size={16} />
              {t('download')}
            </a>
            <button className="btn secondary" onClick={() => window.print()}>
              <Printer size={16} />
              {t('print')}
            </button>
          </div>
        </section>
        <p className="fine-print">
          {t('reportNote')} Date filters select bill dates for bill reports; each bill’s settlements
          are shown through today. Monthly reports select whole months. Project totals below always
          show all-time balances.
        </p>
      </div>
      <article className="panel report-paper">
        <header className="report-header">
          <div>
            <span className="eyebrow">GHARKHATA · PROJECT REPORT</span>
            <h1>{reportNames[type]}</h1>
            <p>
              {data.project.name} · {data.project.data.location}
            </p>
            <small>
              {from || 'Start of project'} → {to || 'Latest record'}
              {vendor && ` · ${data.vendors.find((v) => v._id === vendor)?.data.name}`}
            </small>
            {data.project.demo && <p className="demo-print">Fictional demo data</p>}
          </div>
          <span className="report-emblem">
            <FileText size={30} />
          </span>
        </header>
        <div className="report-totals">
          {[
            ['All-time recorded cost', s.cost],
            ['All-time net cash paid', s.cash],
            ['Outstanding liabilities', s.outstanding],
            ['Unallocated advances', s.advances],
          ].map(([label, n]) => (
            <div key={String(label)}>
              <span>{label}</span>
              <strong>
                <Money value={Number(n)} />
              </strong>
            </div>
          ))}
        </div>
        {['final', 'bills', 'outstanding'].includes(type) ? (
          <>
            <div className="table-wrap">
              <table className="stacked-table">
                <thead>
                  <tr>
                    <th>BILL / DATE</th>
                    <th>NET COST</th>
                    <th>PAID</th>
                    <th>OUTSTANDING</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <tr key={b._id}>
                      <td data-label="Bill / date">
                        <strong>{b.data.description}</strong>
                        <small className="block muted">
                          {b.data.date} ·{' '}
                          {data.vendors.find((v) => v._id === b.data.vendor)?.data.name}
                        </small>
                      </td>
                      <td data-label="Net cost">
                        <Money value={b.total - b.credit} />
                      </td>
                      <td data-label="Paid">
                        <Money value={b.paid} />
                      </td>
                      <td data-label="Outstanding">
                        <Money value={b.outstanding} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td data-label="Bill / date">Filtered bill totals</td>
                    <td data-label="Net cost">
                      <Money value={filtered.reduce((n, b) => n + b.total - b.credit, 0)} />
                    </td>
                    <td data-label="Paid">
                      <Money value={filtered.reduce((n, b) => n + b.paid, 0)} />
                    </td>
                    <td data-label="Outstanding">
                      <Money value={filtered.reduce((n, b) => n + b.outstanding, 0)} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {type === 'final' && (
              <>
                <h3>Category breakdown · all time</h3>
                {Object.entries(s.category).map(([label, n]) => (
                  <div className="report-summary-row" key={label}>
                    <span>{label}</span>
                    <Money value={n} />
                  </div>
                ))}
                <p className="notice">
                  Completing this project does not settle unpaid bills. Remaining budget is not an
                  estimate of the cost to finish. Advances are cash paid, and become allocated to
                  cost only when linked to a bill.
                </p>
              </>
            )}
          </>
        ) : ['category', 'stage', 'floor', 'budget'].includes(type) ? (
          <table className="stacked-table">
            <thead>
              <tr>
                <th>GROUP</th>
                <th>RECORDED COST AFTER CREDITS</th>
                <th>BUDGET</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([label, n]) => (
                <tr key={label}>
                  <td data-label="Group">{label}</td>
                  <td data-label="Recorded cost after credits">
                    <Money value={n} />
                  </td>
                  <td data-label="Budget">
                    {live.find(
                      (r) =>
                        r.kind === 'budget' &&
                        r.data.dimension === dimension &&
                        r.data.label === label,
                    ) ? (
                      <Money
                        value={
                          live.find(
                            (r) =>
                              r.kind === 'budget' &&
                              r.data.dimension === dimension &&
                              r.data.label === label,
                          )!.data.amount
                        }
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : type === 'monthly' ? (
          <table className="stacked-table">
            <thead>
              <tr>
                <th>MONTH</th>
                <th>INCURRED COST AFTER CREDITS</th>
                <th>NET CASH PAID</th>
              </tr>
            </thead>
            <tbody>
              {s.monthly
                .filter(
                  (m) =>
                    (!from || m.month >= from.slice(0, 7)) && (!to || m.month <= to.slice(0, 7)),
                )
                .map((m) => (
                  <tr key={m.month}>
                    <td data-label="Month">{m.month}</td>
                    <td data-label="Incurred cost after credits">
                      <Money value={m.cost} />
                    </td>
                    <td data-label="Net cash paid">
                      <Money value={m.cash} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : ['payments', 'vendor'].includes(type) ? (
          <table className="stacked-table">
            <thead>
              <tr>
                <th>TYPE</th>
                <th>DATE</th>
                <th>DESCRIPTION / REFERENCE</th>
                <th>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {vendorRecords
                .filter((r) => type !== 'payments' || ['payment', 'refund'].includes(r.kind))
                .map((r) => (
                  <tr key={r._id}>
                    <td data-label="Type">{r.kind}</td>
                    <td data-label="Date">{r.data.date}</td>
                    <td data-label="Description / reference">
                      {r.data.description || r.data.reference || r.data.reason || 'Allocation'}
                    </td>
                    <td data-label="Amount">
                      <Money value={r.data.total || r.data.amount} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : type === 'progress' ? (
          <div className="print-diary">
            {live
              .filter((r) => r.kind === 'log' && within(r))
              .sort((a, b) => a.data.date.localeCompare(b.data.date))
              .map((r) => (
                <section key={r._id}>
                  <span className="eyebrow">
                    {r.data.date} · {r.data.stage}
                  </span>
                  <h3>{r.data.title}</h3>
                  <p>{r.data.notes}</p>
                  {r.data.problems && <p>Problems / delays: {r.data.problems}</p>}
                  <div className="diary-images">
                    {r.data.attachments
                      .filter((id: string) =>
                        data.attachments.find((a) => a._id === id)?.mime.startsWith('image/'),
                      )
                      .map((id: string, i: number) => (
                        <img
                          key={id}
                          src={`/api/projects/${data.project._id}/attachments/${id}`}
                          alt={r.data.captions?.[i] || 'Site progress'}
                        />
                      ))}
                  </div>
                </section>
              ))}
          </div>
        ) : (
          <div>
            {live
              .filter(within)
              .filter((r) => type === 'data' || ['worker', 'attendance', 'wage'].includes(r.kind))
              .map((r) => (
                <div className="ledger-row" key={r._id}>
                  <span>
                    <strong>{r.data.title || r.data.name || r.data.description || r.kind}</strong>
                    <small>
                      {r.kind} · {r.data.date || '—'}
                    </small>
                  </span>
                  {r.data.total && <Money value={r.data.total} />}
                </div>
              ))}
          </div>
        )}
        <footer className="report-foot">
          <ShieldCheck size={15} />
          <span>
            Generated from recorded project data · GharKhata records transactions and does not
            transfer money.
          </span>
        </footer>
      </article>
    </>
  );
}
