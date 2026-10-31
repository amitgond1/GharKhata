import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Camera,
  CalendarDays,
  Check,
  Clock3,
  ArrowUpRight,
  Package,
  ArrowDownLeft,
  ArrowUpRight as Up,
  Users,
  HardHat,
  Download,
  Image,
  GitCompareArrows,
  ClipboardCheck,
  MoreHorizontal,
  AlertTriangle,
} from 'lucide-react';
import { scaledQuantity, today, wageAmount } from '@gharkhata/shared';
import { type Snapshot } from './api';
import { useUi } from './context';
import { Money, Empty, Attachments, dateLabel, Badge } from './ui';
import { PageTitle } from './Records';
type Props = {
  data: Snapshot;
  onAdd: (kind: string, initial?: any) => void;
  canWrite: boolean;
  canManage: boolean;
  onVoid?: (r: any) => void;
  onTask?: (r: any, data?: any) => void;
};
export function Labour({ data, onAdd, canWrite, canManage }: Props) {
  const { t } = useUi();
  const live = data.records.filter((r) => !r.voided);
  const workers = live.filter((r) => r.kind === 'worker');
  const [tab, setTab] = useState('workers');
  const attendance = live
    .filter((r) => r.kind === 'attendance')
    .sort((a, b) => b.data.date.localeCompare(a.data.date));
  const wages = live.filter((r) => r.kind === 'wage');
  return (
    <>
      <PageTitle
        title={t('labour')}
        subtitle="For the hands that build your home. Keep attendance and wages clear."
        action={
          canWrite && (
            <button className="btn primary" onClick={() => onAdd('worker')}>
              <Plus size={17} />
              {t('addWorker')}
            </button>
          )
        }
      />
      <div className="secondary-actions top-actions">
        {canWrite && (
          <button className="btn secondary" onClick={() => onAdd('attendance')}>
            <CalendarDays size={16} />
            {t('attendance')}
          </button>
        )}
        {canManage && (
          <button className="btn secondary" onClick={() => onAdd('wage')}>
            <ClipboardCheck size={16} />
            {t('wage')}
          </button>
        )}
        {canWrite && (
          <button className="btn secondary" onClick={() => onAdd('bill')}>
            <Plus size={16} />
            Manual labour bill
          </button>
        )}
      </div>
      <div className="tabs">
        {['workers', 'attendance', 'wages'].map((s) => (
          <button className={tab === s ? 'active' : ''} onClick={() => setTab(s)} key={s}>
            {s === 'workers'
              ? 'Workers & teams'
              : s === 'attendance'
                ? 'Attendance'
                : 'Approved wages'}
          </button>
        ))}
      </div>
      {tab === 'workers' ? (
        <div className="cards-grid">
          {workers.map((w) => {
            const ws = wages.filter((r) => r.data.worker === w._id);
            const bills = data.summary.bills.filter((b) => ws.some((r) => r.data.bill === b._id));
            return (
              <article className="panel info-card" key={w._id}>
                <span className="category-icon tone-3">
                  <HardHat size={23} />
                </span>
                <h3>{w.data.name}</h3>
                <p className="muted">
                  {w.data.trade}
                  {w.data.phone && ` · ${w.data.phone}`}
                </p>
                <div className="rate-tag">
                  <Money value={w.data.rate} />
                  <span>/ day</span>
                </div>
                <div className="worker-totals">
                  <div>
                    <small>Approved wages</small>
                    <Money value={bills.reduce((n, b) => n + b.total - b.credit, 0)} />
                  </div>
                  <div>
                    <small>Paid toward wages</small>
                    <Money value={bills.reduce((n, b) => n + b.paid, 0)} />
                  </div>
                  <div>
                    <small>Pending wages</small>
                    <Money value={bills.reduce((n, b) => n + b.outstanding, 0)} />
                  </div>
                </div>
                <p className="fine-print">
                  Unbilled attendance is excluded until a wage statement is approved. Advances are
                  shown in the vendor ledger.
                </p>
                {canManage && (
                  <button
                    className="text-btn"
                    onClick={() => onAdd('worker', { ...w.data, _id: w._id })}
                  >
                    Edit worker / rate <ArrowUpRight size={14} />
                  </button>
                )}
              </article>
            );
          })}
          {!workers.length && (
            <section className="panel">
              <Empty
                title="People behind your home"
                body="Add a worker or team, mark attendance, then approve their wage statement."
              />
            </section>
          )}
        </div>
      ) : tab === 'attendance' ? (
        <section className="panel table-wrap">
          <table className="stacked-table">
            <thead>
              <tr>
                <th>WORKER / TEAM</th>
                <th>DATE</th>
                <th>APPROVED DAYS</th>
                <th>WAGE PREVIEW</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((a) => (
                <tr key={a._id}>
                  <td data-label="Worker / team">
                    {workers.find((w) => w._id === a.data.worker)?.data.name}
                  </td>
                  <td data-label="Date">{a.data.date}</td>
                  <td data-label="Approved days">{a.data.units}</td>
                  <td data-label="Wage preview">
                    <Money value={wageAmount(a.data.rate, a.data.units)} />
                  </td>
                  <td data-label="Status">
                    <span
                      className={`badge ${wages.some((w) => w.data.attendance.includes(a._id)) ? 'paid' : 'neutral'}`}
                    >
                      {wages.some((w) => w.data.attendance.includes(a._id))
                        ? 'Billed'
                        : 'Not billed'}
                    </span>
                    <small className="block muted">
                      {wages.some((w) => w.data.attendance.includes(a._id))
                        ? 'Billed · not payment status'
                        : 'Not yet billed'}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!attendance.length && <Empty />}
        </section>
      ) : (
        <section className="panel table-wrap">
          <table className="stacked-table">
            <thead>
              <tr>
                <th>STATEMENT</th>
                <th>DATE</th>
                <th>ATTENDANCE ENTRIES</th>
                <th>APPROVED COST</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {wages.map((w) => (
                <tr key={w._id}>
                  <td data-label="Statement">{w.data.description}</td>
                  <td data-label="Date">{w.data.date}</td>
                  <td data-label="Attendance entries">{w.data.attendance.length}</td>
                  <td data-label="Approved cost">
                    <Money value={w.data.total} />
                  </td>
                  <td data-label="Bill">
                    <Link
                      className="text-btn"
                      to={`/app/expenses?q=${encodeURIComponent(w.data.description)}`}
                    >
                      View linked bill
                      <ArrowUpRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!wages.length && <Empty />}
        </section>
      )}
      <p className="fine-print">
        Rates come from your records. Overtime is entered as explicitly approved equivalent day
        units; custom units support three decimal places. Attendance can be billed once.
      </p>
    </>
  );
}
export function stockBalances(data: Snapshot) {
  const groups: Record<
    string,
    { material: string; unit: string; quantity: bigint; threshold: bigint }
  > = {};
  for (const r of data.records.filter((r) => r.kind === 'stock' && !r.voided)) {
    const k = r.data.material + '|' + r.data.unit;
    const g = (groups[k] ??= {
      material: r.data.material,
      unit: r.data.unit,
      quantity: 0n,
      threshold: 0n,
    });
    g.quantity +=
      scaledQuantity(r.data.quantity) *
      (['used', 'returned', 'wastage'].includes(r.data.type) ? -1n : 1n);
    if (r.data.threshold !== undefined) g.threshold = scaledQuantity(r.data.threshold);
  }
  return Object.values(groups);
}
export function Materials({ data, onAdd, canManage }: Props) {
  const { t } = useUi();
  const groups = stockBalances(data);
  const [unitFilter, setUnitFilter] = useState('');
  const movements = data.records
    .filter((r) => r.kind === 'stock' && !r.voided)
    .sort((a, b) => b.data.date.localeCompare(a.data.date));
  return (
    <>
      <PageTitle
        title={t('materials')}
        subtitle="Know what’s on site, what’s been used, and what needs ordering."
        action={
          canManage && (
            <button className="btn primary" onClick={() => onAdd('stock')}>
              <Plus size={17} />
              {t('addStock')}
            </button>
          )
        }
      />
      <div className="notice">
        <Package size={17} />
        Stock tracks quantities. Receiving or using material never adds a second expense. Different
        units stay separate.
      </div>
      <div className="cards-grid stock-cards">
        {groups.map((g) => (
          <article className="panel info-card" key={g.material + g.unit}>
            <div className="card-top">
              <span className="category-icon tone-2">
                <Package size={22} />
              </span>
              {g.quantity <= g.threshold && <span className="badge partial">Low stock</span>}
            </div>
            <h3>{g.material}</h3>
            <div className="stock-quantity">
              {(Number(g.quantity) / 1000).toLocaleString('en-IN')}
              <span>{g.unit}</span>
            </div>
            <small className="muted">
              Low-stock alert at {Number(g.threshold) / 1000} {g.unit}
            </small>
          </article>
        ))}
        {!groups.length && (
          <section className="panel">
            <Empty
              title="A little order on site"
              body="Record a material delivery to start tracking quantities."
            />
          </section>
        )}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Stock movement history</h3>
            <p>Every delivery, use and adjustment</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="stacked-table">
            <thead>
              <tr>
                <th>MATERIAL</th>
                <th>DATE</th>
                <th>MOVEMENT</th>
                <th>QUANTITY</th>
                <th>NOTES</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((r) => (
                <tr key={r._id}>
                  <td data-label="Material">
                    <strong>{r.data.material}</strong>
                  </td>
                  <td data-label="Date">{r.data.date}</td>
                  <td data-label="Movement">
                    <span className={`badge ${r.data.type === 'received' ? 'paid' : 'partial'}`}>
                      {r.data.type}
                    </span>
                  </td>
                  <td data-label="Quantity">
                    {['used', 'returned', 'wastage'].includes(r.data.type) ? '−' : '+'}
                    {r.data.quantity} {r.data.unit}
                  </td>
                  <td data-label="Notes">{r.data.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!movements.length && <Empty />}
      </section>
    </>
  );
}
export function Progress({ data, onAdd, canWrite }: Props) {
  const { t, lang } = useUi();
  const [view, setView] = useState('timeline');
  const [month, setMonth] = useState('');
  const [compare, setCompare] = useState<string[]>(['', '']);
  const logs = data.records
    .filter((r) => r.kind === 'log' && !r.voided && (!month || r.data.date.startsWith(month)))
    .sort((a, b) => b.data.date.localeCompare(a.data.date));
  const photos = logs
    .flatMap((log) =>
      (log.data.attachments || []).map((id: string, i: number) => ({
        id,
        log,
        caption: log.data.captions?.[i] || log.data.title,
      })),
    )
    .filter((p) => data.attachments.find((a) => a._id === p.id)?.mime.startsWith('image/'));
  const url = (id: string) => `/api/projects/${data.project._id}/attachments/${id}`;
  return (
    <>
      <PageTitle
        title={t('progress')}
        subtitle="From the first brick to the finishing touches. Keep your home’s story."
        action={
          canWrite && (
            <button className="btn primary" onClick={() => onAdd('log')}>
              <Plus size={17} />
              {t('addLog')}
            </button>
          )
        }
      />
      <div className="view-toolbar">
        <div className="tabs">
          {[
            ['timeline', 'Timeline'],
            ['gallery', 'Photo gallery'],
            ['compare', 'Before & after'],
          ].map(([key, label]) => (
            <button key={key} className={view === key ? 'active' : ''} onClick={() => setView(key)}>
              {label}
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <input
            aria-label="Filter progress month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <a
            className="btn secondary compact"
            href={`/api/projects/${data.project._id}/export?type=progress`}
          >
            <Download size={15} />
            Diary CSV
          </a>
        </div>
      </div>
      {view === 'timeline' ? (
        <div className="progress-timeline">
          {logs.map((log) => (
            <article className="timeline-entry" key={log._id}>
              <div className="timeline-date">
                <strong>{log.data.date.slice(8)}</strong>
                <span>{dateLabel(log.data.date, lang, true).split(' ').slice(1).join(' ')}</span>
              </div>
              <div className="timeline-track">
                <span />
              </div>
              <div className="panel timeline-card">
                <div className="card-top">
                  <span className="eyebrow">{log.data.stage || 'SITE UPDATE'}</span>
                  <span className="muted small">{log.data.floor}</span>
                </div>
                <h2>{log.data.title}</h2>
                <p>{log.data.notes}</p>
                {log.data.problems && (
                  <p className="notice warning">
                    <AlertTriangle size={16} />
                    {log.data.problems}
                  </p>
                )}
                {log.data.labourCount !== undefined && (
                  <p className="muted small">
                    <Users size={14} /> {log.data.labourCount} people on site
                  </p>
                )}
                <div className="diary-images">
                  {photos
                    .filter((p) => p.log._id === log._id)
                    .map((p) => (
                      <a href={url(p.id)} target="_blank" rel="noreferrer" key={p.id}>
                        <img loading="lazy" src={url(p.id)} alt={p.caption} />
                        <span>{p.caption}</span>
                      </a>
                    ))}
                </div>
                {!log.data.attachments?.length && (
                  <div className="no-photo">
                    <Camera size={18} />
                    {t('noPhotos')}
                  </div>
                )}
                <Attachments
                  ids={(log.data.attachments || []).filter(
                    (id: string) => !photos.some((p) => p.id === id),
                  )}
                  project={data.project._id}
                  files={data.attachments}
                />
              </div>
            </article>
          ))}
          {!logs.length && (
            <section className="panel">
              <Empty
                title="Every day is a part of the story"
                body="Add a note and a site photo. Your future self will thank you."
                action={
                  canWrite && (
                    <button className="btn primary" onClick={() => onAdd('log')}>
                      <Camera size={16} />
                      {t('addLog')}
                    </button>
                  )
                }
              />
            </section>
          )}
        </div>
      ) : view === 'gallery' ? (
        <div className="photo-grid">
          {photos.map((p) => (
            <a
              className="panel photo-card"
              href={url(p.id)}
              target="_blank"
              rel="noreferrer"
              key={p.id}
            >
              <img src={url(p.id)} alt={p.caption} />
              <div>
                <h3>{p.caption}</h3>
                <small>{dateLabel(p.log.data.date, lang)}</small>
              </div>
            </a>
          ))}
          {!photos.length && (
            <section className="panel">
              <Empty
                title="Your building album"
                body="Upload site photos with a progress update. They stay private to your project."
              />
            </section>
          )}
        </div>
      ) : (
        <section className="panel compare-panel">
          <div className="panel-heading">
            <div>
              <h3>See how far you’ve come</h3>
              <p>Choose two of your own site photos to compare.</p>
            </div>
          </div>
          <div className="compare-grid">
            {['Before', 'After'].map((label, i) => (
              <div key={label}>
                <label className="field">
                  {label}
                  <select
                    value={compare[i]}
                    onChange={(e) =>
                      setCompare((s) => s.map((id, j) => (i === j ? e.target.value : id)))
                    }
                  >
                    <option value="">Select a photo</option>
                    {photos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.log.data.date} · {p.caption}
                      </option>
                    ))}
                  </select>
                </label>
                {compare[i] ? (
                  <img src={url(compare[i])} alt={label + ' site photo'} />
                ) : (
                  <div className="compare-empty">
                    <Camera size={32} />
                    <span>Choose a {label.toLowerCase()} photo</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
export function Tasks({ data, onAdd, canWrite, onTask }: Props) {
  const { t, lang } = useUi();
  const [filter, setFilter] = useState('pending');
  const tasks = data.records
    .filter(
      (r) =>
        r.kind === 'task' &&
        !r.voided &&
        (filter === 'all' || filter === 'done'
          ? filter === 'all' || r.data.status === 'done'
          : r.data.status !== 'done'),
    )
    .sort((a, b) => a.data.dueDate.localeCompare(b.data.dueDate));
  return (
    <>
      <PageTitle
        title={t('tasks')}
        subtitle="A place for the next little thing. Nothing slips through the cracks."
        action={
          canWrite && (
            <button className="btn primary" onClick={() => onAdd('task')}>
              <Plus size={17} />
              {t('addTask')}
            </button>
          )
        }
      />
      <div className="tabs">
        {[
          ['pending', 'To do'],
          ['done', 'Completed'],
          ['all', 'All tasks'],
        ].map(([v, l]) => (
          <button className={filter === v ? 'active' : ''} onClick={() => setFilter(v)} key={v}>
            {l}
          </button>
        ))}
      </div>
      <div className="task-list">
        {tasks.map((task) => (
          <article
            className={`panel task-card ${task.data.status === 'done' ? 'done' : ''}`}
            key={task._id}
          >
            <div className="task-card-main">
              <button
                className={`task-check ${task.data.status === 'done' ? 'checked' : ''}`}
                disabled={!canWrite}
                aria-label={`Toggle ${task.data.title}`}
                onClick={() => onTask?.(task)}
              >
                <Check size={15} />
              </button>
              <div>
                <div className="card-top">
                  <h3>{task.data.title}</h3>
                  <span className={`badge ${task.data.priority === 'high' ? 'unpaid' : 'neutral'}`}>
                    {task.data.priority}
                  </span>
                </div>
                <div className="task-metadata">
                  <span
                    className={
                      task.data.dueDate < today() && task.data.status !== 'done' ? 'text-red' : ''
                    }
                  >
                    <CalendarDays size={13} />
                    {dateLabel(task.data.dueDate, lang)}
                  </span>
                  {task.data.assignee && (
                    <span>
                      <Users size={13} />
                      {task.data.assignee}
                    </span>
                  )}
                  {task.data.stage && <span>{task.data.stage}</span>}
                </div>
              </div>
              {canWrite && (
                <select
                  aria-label={`Status of ${task.data.title}`}
                  value={task.data.status}
                  onChange={(e) => onTask?.(task, { ...task.data, status: e.target.value })}
                >
                  {['pending', 'in progress', 'done'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              )}
            </div>
            {task.data.checklist?.length > 0 && (
              <div className="task-checklist">
                {task.data.checklist.map((c: any, i: number) => (
                  <label className="checkbox" key={i}>
                    <input
                      type="checkbox"
                      checked={c.done}
                      disabled={!canWrite}
                      onChange={(e) =>
                        onTask?.(task, {
                          ...task.data,
                          checklist: task.data.checklist.map((x: any, j: number) =>
                            j === i ? { ...x, done: e.target.checked } : x,
                          ),
                        })
                      }
                    />
                    <span className={c.done ? 'struck' : ''}>{c.title}</span>
                  </label>
                ))}
              </div>
            )}
            <Attachments
              ids={task.data.attachments}
              files={data.attachments}
              project={data.project._id}
            />
          </article>
        ))}
        {!tasks.length && (
          <section className="panel">
            <Empty
              title={
                filter === 'done'
                  ? 'Every completed task is a step closer.'
                  : 'A little breathing room.'
              }
              body="Your tasks will appear here. Add one for your next site visit."
            />
          </section>
        )}
      </div>
      <p className="fine-print">
        Reminders appear in the bell menu. Share a reminder yourself; GharKhata does not send
        automated WhatsApp messages.
      </p>
    </>
  );
}
export function Budgets({ data, onAdd, canManage, onVoid }: Props) {
  const { t } = useUi();
  const [dimension, setDimension] = useState('category');
  const s = data.summary;
  const budgets = data.records.filter(
    (r) => r.kind === 'budget' && !r.voided && r.data.dimension === dimension,
  );
  const actual = dimension === 'category' ? s.category : s.stage;
  const labels = [...new Set([...budgets.map((b) => b.data.label), ...Object.keys(actual)])];
  const p = data.project.data;
  return (
    <>
      <PageTitle
        title={t('budget')}
        subtitle="A thoughtful plan. A clear view of where you stand."
        action={
          canManage && (
            <button className="btn primary" onClick={() => onAdd('budget')}>
              <Plus size={17} />
              {t('addBudget')}
            </button>
          )
        }
      />
      <div className="mini-stats budget-stats">
        <div>
          <span>{t('plannedBudget')}</span>
          <strong>
            <Money value={s.budget} />
          </strong>
        </div>
        <div>
          <span>{t('recordedCost')}</span>
          <strong>
            <Money value={s.cost} />
          </strong>
        </div>
        <div>
          <span>{t('remaining')}</span>
          <strong className={s.remaining < 0 ? 'text-red' : ''}>
            <Money value={s.remaining} />
          </strong>
        </div>
      </div>
      <p className="notice">{t('budgetNote')}</p>
      <div className="forecast-card">
        <div>
          <span className="eyebrow">YOUR FORECAST · AN ESTIMATE</span>
          <h3>{t('forecast')}</h3>
          <p>Recorded cost + your estimate of the remaining work</p>
        </div>
        <div>
          <strong>
            <Money value={s.cost + (p.estimate || 0)} />
          </strong>
          <span>
            Remaining work estimate: <Money value={p.estimate || 0} />
          </span>
        </div>
        <Link className="text-btn" to="/app/settings">
          Edit estimate <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="tabs">
        <button
          className={dimension === 'category' ? 'active' : ''}
          onClick={() => setDimension('category')}
        >
          By category
        </button>
        <button
          className={dimension === 'stage' ? 'active' : ''}
          onClick={() => setDimension('stage')}
        >
          By stage
        </button>
      </div>
      <section className="panel budget-table">
        <div className="panel-heading">
          <div>
            <h3>A plan for every part of your home</h3>
            <p>Alerts at your configured {p.threshold || 90}% threshold</p>
          </div>
        </div>
        {labels.map((label) => {
          const budget = budgets.find((b) => b.data.label === label);
          const n = actual[label] || 0;
          const ratio = budget?.data.amount ? Math.round((n / budget.data.amount) * 100) : 0;
          return (
            <div className="budget-row" key={label}>
              <div>
                <strong>{label}</strong>
                <span>
                  <Money value={n} />{' '}
                  <small>
                    of {budget ? <Money value={budget.data.amount} /> : <span>no budget set</span>}
                  </small>
                </span>
              </div>
              <div className={`budget-meter ${ratio > 100 ? 'over' : ''}`}>
                <i style={{ width: `${Math.min(ratio, 100)}%` }} />
              </div>
              <div>
                {budget ? (
                  <span className={ratio >= (p.threshold || 90) ? 'text-amber' : 'muted'}>
                    {ratio}% used
                  </span>
                ) : (
                  <span className="muted">Unplanned</span>
                )}
                {canManage && budget && (
                  <button className="text-btn danger" onClick={() => onVoid?.(budget)}>
                    Archive
                  </button>
                )}
                {canManage && budget && (
                  <button
                    className="text-btn"
                    onClick={() => onAdd('budget', { ...budget.data, _id: budget._id })}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!labels.length && (
          <Empty
            title="Give your budget a little structure"
            body="Allocate amounts by category or construction stage. Actual cost comes from recorded bills."
          />
        )}
      </section>
      {p.area && (
        <div className="notice">
          Recorded cost per {p.areaUnit}:{' '}
          <strong>
            <Money value={Math.round(s.cost / p.area)} />
          </strong>{' '}
          · {formatBasis(s.cost, p.area, p.areaUnit)}. Based on your entered built-up area.
        </div>
      )}
    </>
  );
}
function formatBasis(cost: number, area: number, unit: string) {
  return `${(cost / 100).toLocaleString('en-IN')} rupees ÷ ${area.toLocaleString('en-IN')} ${unit}`;
}
