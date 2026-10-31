import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  ReceiptText,
  Wallet,
  Download,
  SlidersHorizontal,
  Paperclip,
  ArrowRight,
  Store,
  Phone,
  MapPin,
  FileText,
  CornerDownRight,
} from 'lucide-react';
import { categories, formatMoney } from '@gharkhata/shared';
import { type Snapshot } from './api';
import { useUi, type TranslationKey } from './context';
import { Badge, Money, Empty, Modal, dateLabel, Attachments } from './ui';
export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading inner-heading">
      <div>
        <div className="eyebrow">
          <span className="tiny-line" /> A CLEARER HISAAB
        </div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
export function FinancialList({
  data,
  type,
  onAdd,
  onVoid,
  canWrite,
  canManage,
}: {
  data: Snapshot;
  type: 'bill' | 'payment';
  onAdd: (kind: string, initial?: any) => void;
  onVoid: (r: any) => void;
  canWrite: boolean;
  canManage: boolean;
}) {
  const { t, lang } = useUi();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const [vendor, setVendor] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [floor, setFloor] = useState('');
  const [stage, setStage] = useState('');
  const [sort, setSort] = useState('date');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<any>(null);
  const [filters, setFilters] = useState(false);
  const s = data.summary;
  useEffect(() => setPage(1), [q, vendor, category, status, from, to, floor, stage, sort]);
  const rows = (type === 'bill' ? s.bills : s.payments)
    .filter((r) => {
      const text =
        JSON.stringify(r.data).toLowerCase() +
        ' ' +
        data.vendors.find((v) => v._id === r.data.vendor)?.data.name.toLowerCase() +
        ' ' +
        formatMoney(r.data.total || r.data.amount);
      return (
        (!q || text.includes(q.toLowerCase())) &&
        (!vendor || r.data.vendor === vendor) &&
        (!category || r.data.lines?.some((l: any) => l.category === category)) &&
        (!status || r.status === status) &&
        (!from || r.data.date >= from) &&
        (!to || r.data.date <= to) &&
        (!floor || r.data.floor === floor) &&
        (!stage || r.data.stage === stage)
      );
    })
    .sort((a, b) =>
      sort === 'amount'
        ? (b.total || b.data.amount) - (a.total || a.data.amount)
        : sort === 'oldest'
          ? a.data.date.localeCompare(b.data.date)
          : b.data.date.localeCompare(a.data.date),
    );
  const total = rows.reduce(
    (n, r) => n + (type === 'bill' ? r.total - r.credit : r.data.amount),
    0,
  );
  const shown = rows.slice((page - 1) * 10, page * 10);
  const vendorName = (id: string) => data.vendors.find((v) => v._id === id)?.data.name || '—';
  const history = detail
    ? data.records
        .filter((r) => !r.voided && (r.data.bill === detail._id || r.data.payment === detail._id))
        .sort((a, b) => a.data.date.localeCompare(b.data.date))
    : [];
  return (
    <>
      <PageTitle
        title={type === 'bill' ? t('expenses') : t('payments')}
        subtitle={
          type === 'bill'
            ? 'Every bill has its place. Keep track of what your home costs.'
            : 'Your recorded payments, allocations and advances. No money is moved.'
        }
        action={
          canWrite && (
            <button className="btn primary" onClick={() => onAdd(type)}>
              <Plus size={17} />
              {type === 'bill' ? t('addExpense') : t('addPayment')}
            </button>
          )
        }
      />
      <div className="mini-stats">
        <div>
          <span>{type === 'bill' ? 'Filtered recorded cost' : 'Filtered gross payments'}</span>
          <strong>
            <Money value={total} />
          </strong>
        </div>
        <div>
          <span>{type === 'bill' ? 'Filtered outstanding' : 'All-time available advances'}</span>
          <strong>
            <Money
              value={type === 'bill' ? rows.reduce((n, r) => n + r.outstanding, 0) : s.advances}
            />
          </strong>
        </div>
        <div>
          <span>Matching records</span>
          <strong>{rows.length}</strong>
        </div>
      </div>
      <section className="panel">
        <div className="list-toolbar">
          <label className="search-field">
            <Search size={17} />
            <input
              placeholder={t('search')}
              aria-label={t('search')}
              value={q}
              onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {})}
            />
          </label>
          <select
            aria-label="Vendor filter"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          >
            <option value="">All vendors</option>
            {data.vendors.map((v) => (
              <option value={v._id} key={v._id}>
                {v.data.name}
              </option>
            ))}
          </select>
          <button
            className={`btn secondary compact ${filters ? 'selected' : ''}`}
            onClick={() => setFilters(!filters)}
            aria-expanded={filters}
          >
            <SlidersHorizontal size={15} />
            Filters
          </button>
          <select aria-label="Sort records" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="date">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount">Largest amount</option>
          </select>
        </div>
        {filters && (
          <div className="filter-drawer">
            <label className="field">
              {t('from')}
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="field">
              {t('to')}
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            {type === 'bill' && (
              <>
                <label className="field">
                  {t('category')}
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">All categories</option>
                    {[
                      ...new Set([
                        ...categories,
                        ...s.bills.flatMap((b) => b.data.lines.map((l: any) => l.category)),
                      ]),
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  {t('status')}
                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">All statuses</option>
                    {['paid', 'partial', 'unpaid', 'credited'].map((s) => (
                      <option key={s} value={s}>
                        {s === 'credited' ? 'Settled by credit' : t(s as TranslationKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  {t('floor')}
                  <select value={floor} onChange={(e) => setFloor(e.target.value)}>
                    <option value="">All floors</option>
                    {[...new Set(s.bills.map((b) => b.data.floor).filter(Boolean))].map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  {t('stage')}
                  <select value={stage} onChange={(e) => setStage(e.target.value)}>
                    <option value="">All stages</option>
                    {[...new Set(s.bills.map((b) => b.data.stage).filter(Boolean))].map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
        )}
        {shown.length ? (
          <>
            <div className="desktop-table table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{type === 'bill' ? 'EXPENSE / BILL' : 'PAYMENT / PAYEE'}</th>
                    <th>DATE</th>
                    <th>METHOD / CATEGORY</th>
                    <th>AMOUNT</th>
                    <th>{type === 'bill' ? 'OUTSTANDING' : 'AVAILABLE ADVANCE'}</th>
                    <th>{type === 'bill' ? 'STATUS' : 'REFERENCE'}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r._id} onClick={() => setDetail(r)} className="clickable">
                      <td>
                        <button className="expense-cell row-button" onClick={() => setDetail(r)}>
                          <span className="category-icon tone-0">
                            {type === 'bill' ? <ReceiptText size={18} /> : <Wallet size={18} />}
                          </span>
                          <span>
                            <strong>{type === 'bill' ? r.data.description : r.data.payee}</strong>
                            <small>{vendorName(r.data.vendor)}</small>
                          </span>
                        </button>
                      </td>
                      <td className="nowrap">{dateLabel(r.data.date, lang, true)}</td>
                      <td>{type === 'bill' ? r.data.lines[0].category : r.data.method}</td>
                      <td className="nowrap">
                        <Money value={type === 'bill' ? r.total - r.credit : r.data.amount} />
                      </td>
                      <td className="nowrap">
                        <Money value={type === 'bill' ? r.outstanding : r.available} />
                      </td>
                      <td>
                        {type === 'bill' ? (
                          <Badge status={r.status} />
                        ) : (
                          <span className="muted">{r.data.reference || '—'}</span>
                        )}
                      </td>
                      <td>
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-records">
              {shown.map((r) => (
                <button className="mobile-record" key={r._id} onClick={() => setDetail(r)}>
                  <div>
                    <span className="category-icon tone-0">
                      <ReceiptText size={19} />
                    </span>
                    <span>
                      <strong>{r.data.description || r.data.payee}</strong>
                      <small>
                        {vendorName(r.data.vendor)} · {dateLabel(r.data.date, lang, true)}
                      </small>
                    </span>
                    <ChevronRight size={16} />
                  </div>
                  <div>
                    <strong>
                      <Money value={type === 'bill' ? r.total - r.credit : r.data.amount} />
                    </strong>
                    {type === 'bill' ? <Badge status={r.status} /> : <span>{r.data.method}</span>}
                  </div>
                  <small>
                    {type === 'bill' ? t('pending') : t('available')}:{' '}
                    <Money value={type === 'bill' ? r.outstanding : r.available} />
                  </small>
                </button>
              ))}
            </div>
            <div className="pagination">
              <span>
                {(page - 1) * 10 + 1}–{Math.min(page * 10, rows.length)} of {rows.length} records
              </span>
              <div>
                <button
                  className="icon-btn"
                  disabled={page === 1}
                  onClick={() => setPage((n) => n - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={18} />
                </button>
                <span>{page}</span>
                <button
                  className="icon-btn"
                  disabled={page * 10 >= rows.length}
                  onClick={() => setPage((n) => n + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <Empty
            action={
              canWrite && (
                <button className="btn primary" onClick={() => onAdd(type)}>
                  <Plus size={16} />
                  {type === 'bill' ? t('addExpense') : t('addPayment')}
                </button>
              )
            }
          />
        )}
      </section>
      <p className="fine-print">{t('expenseNote')}</p>
      {canManage && (
        <div className="secondary-actions">
          {(type === 'bill'
            ? [
                ['credit', 'credit'],
                ['allocation', 'allocate'],
              ]
            : [
                ['allocation', 'allocate'],
                ['refund', 'refund'],
              ]
          ).map(([kind, key]) => (
            <button className="btn secondary" key={kind} onClick={() => onAdd(kind)}>
              <Plus size={15} />
              {t(key as TranslationKey)}
            </button>
          ))}
        </div>
      )}
      {detail && (
        <Modal
          title={type === 'bill' ? detail.data.description : detail.data.payee}
          wide
          onClose={() => setDetail(null)}
        >
          <div className="detail-body">
            <div className="detail-top">
              <div>
                <span className="muted">{vendorName(detail.data.vendor)}</span>
                <h2>
                  <Money
                    value={type === 'bill' ? detail.total - detail.credit : detail.data.amount}
                  />
                </h2>
              </div>
              {type === 'bill' && <Badge status={detail.status} />}
            </div>
            <div className="detail-meta">
              <span>
                {t('date')}: <strong>{dateLabel(detail.data.date, lang)}</strong>
              </span>
              <span>
                {type === 'bill' ? t('invoice') : t('reference')}:{' '}
                <strong>{detail.data.invoice || detail.data.reference || '—'}</strong>
              </span>
              {detail.data.dueDate && (
                <span>
                  {t('dueDate')}: <strong>{dateLabel(detail.data.dueDate, lang)}</strong>
                </span>
              )}
              {detail.data.historical && (
                <span className="badge partial">Historical opening record</span>
              )}
            </div>
            {type === 'bill' && (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ITEM</th>
                        <th>QTY × RATE</th>
                        <th>TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.data.lines.map((l: any, i: number) => (
                        <tr key={i}>
                          <td>
                            <strong>{l.description}</strong>
                            <small className="block muted">{l.category}</small>
                          </td>
                          <td>
                            {l.quantity} {l.unit} × <Money value={l.rate} />
                            <small className="block muted">
                              Discount <Money value={l.discount} /> · Tax <Money value={l.tax} /> ·
                              Delivery <Money value={l.transport} /> · Other{' '}
                              <Money value={l.other} />
                            </small>
                          </td>
                          <td>
                            <Money value={l.total} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="calculation">
                  <div>
                    <span>Credits</span>
                    <Money value={detail.credit} />
                  </div>
                  <div>
                    <span>Allocated payments</span>
                    <Money value={detail.paid} />
                  </div>
                  <div>
                    <span>Outstanding</span>
                    <Money value={detail.outstanding} />
                  </div>
                </div>
              </>
            )}
            {detail.data.notes && <p className="detail-notes">{detail.data.notes}</p>}
            <Attachments
              ids={detail.data.attachments}
              files={data.attachments}
              project={data.project._id}
            />
            <h4>{t('ledger')}</h4>
            {history.length ? (
              history.map((r) => (
                <div className="ledger-row" key={r._id}>
                  <span className="ledger-dot" />
                  <span>
                    <strong>
                      {r.kind === 'allocation'
                        ? 'Payment allocation'
                        : r.kind === 'credit'
                          ? 'Credit note'
                          : 'Refund'}
                    </strong>
                    <small>
                      {dateLabel(r.data.date, lang)} · {r.data.reason || 'Linked record'}
                    </small>
                  </span>
                  <Money value={r.data.amount} />
                  {canManage && (
                    <button
                      className="text-btn danger"
                      onClick={() => {
                        setDetail(null);
                        onVoid(r);
                      }}
                    >
                      Reverse
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="muted">No linked transactions yet.</p>
            )}
            <div className="detail-actions">
              {canWrite && type === 'bill' && detail.outstanding > 0 && (
                <button
                  className="btn primary"
                  onClick={() => {
                    setDetail(null);
                    onAdd('payment', {
                      vendor: detail.data.vendor,
                      payee: vendorName(detail.data.vendor),
                      amount: detail.outstanding,
                      bill: detail._id,
                    });
                  }}
                >
                  {t('addPayment')}
                  <ArrowUpRight size={16} />
                </button>
              )}
              {canManage && (
                <button
                  className="btn secondary danger"
                  onClick={() => {
                    setDetail(null);
                    onVoid(detail);
                  }}
                >
                  {t('archive')}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
export function Vendors({
  data,
  onAdd,
  canWrite,
  canManage,
}: {
  data: Snapshot;
  onAdd: (kind: string, initial?: any) => void;
  canWrite: boolean;
  canManage: boolean;
}) {
  const { t } = useUi();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [tab, setTab] = useState('vendors');
  const contracts = data.records.filter((r) => r.kind === 'contract' && !r.voided);
  return (
    <>
      <PageTitle
        title={t('vendors')}
        subtitle="Good people make a home. Keep their details and balances together."
        action={
          (tab === 'vendors' ? canWrite : canManage) && (
            <button
              className="btn primary"
              onClick={() => onAdd(tab === 'vendors' ? 'vendor' : 'contract')}
            >
              <Plus size={16} />
              {tab === 'vendors' ? t('addVendor') : t('addContract')}
            </button>
          )
        }
      />
      <div className="tabs">
        <button className={tab === 'vendors' ? 'active' : ''} onClick={() => setTab('vendors')}>
          {t('vendors')}
        </button>
        <button className={tab === 'contracts' ? 'active' : ''} onClick={() => setTab('contracts')}>
          {t('contract')}
        </button>
      </div>
      <label className="search-field standalone-search">
        <Search size={17} />
        <input
          placeholder="Find a vendor or agreement"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {tab === 'vendors' ? (
        <div className="vendor-grid">
          {data.vendors
            .filter((v) => JSON.stringify(v.data).toLowerCase().includes(search.toLowerCase()))
            .map((v) => {
              const bills = data.summary.bills.filter((b) => b.data.vendor === v._id);
              const payments = data.summary.payments.filter((p) => p.data.vendor === v._id);
              return (
                <button className="panel vendor-card" key={v._id} onClick={() => setSelected(v)}>
                  <div className="vendor-card-top">
                    <span className="vendor-avatar">
                      {v.data.name
                        .split(' ')
                        .slice(0, 2)
                        .map((n: string) => n[0])
                        .join('')}
                    </span>
                    <ArrowUpRight size={18} />
                  </div>
                  <h3>{v.data.name}</h3>
                  <p>{v.data.business || v.data.type}</p>
                  <div className="vendor-details">
                    <span>
                      <Phone size={13} />
                      {v.data.phone || 'No phone added'}
                    </span>
                    <span>
                      <FileText size={13} />
                      {bills.length} bills recorded
                    </span>
                  </div>
                  <div className="vendor-balances">
                    <div>
                      <small>{t('pending')}</small>
                      <strong>
                        <Money value={bills.reduce((n, b) => n + b.outstanding, 0)} />
                      </strong>
                    </div>
                    <div>
                      <small>{t('available')}</small>
                      <strong>
                        <Money value={payments.reduce((n, p) => n + p.available, 0)} />
                      </strong>
                    </div>
                  </div>
                </button>
              );
            })}
          {!data.vendors.length && (
            <section className="panel">
              <Empty
                title="Your building partners"
                body="Add the suppliers and contractors helping build your home."
              />
            </section>
          )}
        </div>
      ) : (
        <div className="cards-grid">
          {contracts
            .filter((c) => JSON.stringify(c.data).toLowerCase().includes(search.toLowerCase()))
            .map((c) => (
              <article className="panel info-card" key={c._id}>
                <span className="eyebrow">AGREEMENT · COMMITMENT ONLY</span>
                <h3>{c.data.title}</h3>
                <p className="muted">
                  {data.vendors.find((v) => v._id === c.data.vendor)?.data.name}
                </p>
                <h2>
                  <Money value={c.data.amount} />
                </h2>
                <p>{c.data.scope}</p>
                <small className="muted">
                  {c.data.startDate} → {c.data.endDate}
                </small>
                {c.data.milestones?.map((m: any, i: number) => (
                  <div className="ledger-row" key={i}>
                    <span>
                      {m.title}
                      <small>{m.date}</small>
                    </span>
                    <Money value={m.amount} />
                  </div>
                ))}
                {c.data.changes && <p>{c.data.changes}</p>}
                <Attachments
                  ids={c.data.attachments}
                  project={data.project._id}
                  files={data.attachments}
                />
                {canManage && (
                  <button
                    className="text-btn"
                    onClick={() => onAdd('contract', { ...c.data, _id: c._id })}
                  >
                    Edit agreement <ArrowUpRight size={14} />
                  </button>
                )}
              </article>
            ))}
          {!contracts.length && (
            <section className="panel">
              <Empty
                title="Agreements, kept together"
                body="An agreed amount is a commitment. Record separate bills when work is approved."
              />
            </section>
          )}
        </div>
      )}
      {selected && (
        <Modal title={selected.data.name} wide onClose={() => setSelected(null)}>
          <div className="detail-body">
            <p className="muted">
              {selected.data.business} · {selected.data.type}
            </p>
            {selected.data.phone && (
              <p>
                <Phone size={14} /> {selected.data.phone}
              </p>
            )}
            {selected.data.address && (
              <p>
                <MapPin size={14} /> {selected.data.address}
              </p>
            )}
            {selected.data.tax && <p>Tax details: {selected.data.tax}</p>}
            {selected.data.notes && <p>{selected.data.notes}</p>}
            <div className="mini-stats">
              {[
                [
                  'Bills after credits',
                  data.summary.bills
                    .filter((b) => b.data.vendor === selected._id)
                    .reduce((n, b) => n + b.total - b.credit, 0),
                ],
                [
                  'Outstanding',
                  data.summary.bills
                    .filter((b) => b.data.vendor === selected._id)
                    .reduce((n, b) => n + b.outstanding, 0),
                ],
                [
                  'Available advances',
                  data.summary.payments
                    .filter((p) => p.data.vendor === selected._id)
                    .reduce((n, p) => n + p.available, 0),
                ],
              ].map(([name, value]) => (
                <div key={String(name)}>
                  <span>{name}</span>
                  <strong>
                    <Money value={Number(value)} />
                  </strong>
                </div>
              ))}
            </div>
            <div className="detail-actions">
              {canManage && (
                <button
                  className="btn secondary"
                  onClick={() => {
                    onAdd('vendor', { ...selected.data, _id: selected._id });
                    setSelected(null);
                  }}
                >
                  Edit vendor <ArrowUpRight size={14} />
                </button>
              )}
            </div>
            <h4>{t('ledger')}</h4>
            {data.records
              .filter(
                (r) =>
                  !r.voided &&
                  ['bill', 'payment', 'credit', 'refund', 'allocation'].includes(r.kind) &&
                  (r.data.vendor === selected._id ||
                    data.summary.bills.find((b) => b._id === r.data.bill)?.data.vendor ===
                      selected._id ||
                    data.summary.payments.find((p) => p._id === r.data.payment)?.data.vendor ===
                      selected._id),
              )
              .sort((a, b) => a.data.date.localeCompare(b.data.date))
              .map((r) => (
                <div className="ledger-row" key={r._id}>
                  <span className="ledger-dot" />
                  <span>
                    <strong>
                      {r.data.description || r.data.reason || r.data.payee || 'Allocation'}
                    </strong>
                    <small>
                      {r.kind} · {r.data.date}
                    </small>
                  </span>
                  <Money value={r.data.total || r.data.amount} />
                </div>
              ))}
            <a
              className="btn secondary"
              href={`/api/projects/${data.project._id}/export?type=vendor&vendor=${selected._id}`}
            >
              <Download size={15} />
              Download ledger
            </a>
          </div>
        </Modal>
      )}
    </>
  );
}
