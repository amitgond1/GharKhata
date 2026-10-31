import { Link } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Plus,
  Wallet,
  ReceiptText,
  Landmark,
  Clock3,
  ChevronRight,
  ArrowRight,
  Check,
  Camera,
  CalendarDays,
  MapPin,
  Sprout,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { formatMoney, today } from '@gharkhata/shared';
import { api, type Snapshot } from './api';
import { useUi } from './context';
import { Money, Badge, Empty, Loading, dateLabel } from './ui';
import { House } from './House';
const colours = ['#195f52', '#65917a', '#a7b99a', '#e6b76a', '#c7b69b', '#8fa4a0', '#b98c6e'];
type DashboardProps = {
  data: Snapshot;
  name: string;
  onAdd: (kind: string) => void;
  onTask: (task: any) => void;
};
export function Dashboard(props: DashboardProps) {
  const { t } = useUi();
  const [show, setShow] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const active = !!query;
  const filtered = useQuery<Snapshot['summary']>({
    queryKey: ['dashboard', props.data.project._id, props.data.project.revision, query],
    queryFn: async () =>
      (await api(`/projects/${props.data.project._id}/dashboard?${query}`)).summary,
    enabled: active,
  });
  const fields = [
    ['from', 'From bill date'],
    ['to', 'To bill date'],
    ['category', 'Category in invoice'],
    ['vendor', 'Vendor'],
    ['floor', 'Floor'],
    ['stage', 'Stage'],
    ['status', 'Payment status'],
  ];
  const options = (key: string) =>
    key === 'vendor'
      ? props.data.vendors.map((v) => [v._id, v.data.name])
      : key === 'category'
        ? Object.keys(props.data.summary.category).map((v) => [v, v])
        : key === 'status'
          ? ['paid', 'partial', 'unpaid', 'credited'].map((v) => [v, v])
          : [...new Set(props.data.summary.bills.map((b) => b.data[key]).filter(Boolean))].map(
              (v) => [v, v],
            );
  const controls = (
    <>
      {show && (
        <section className="panel dashboard-filters">
          <div className="form-grid">
            {fields.map(([key, label]) => (
              <label className="field" key={key}>
                {label}
                {key === 'from' || key === 'to' ? (
                  <input
                    type="date"
                    value={filters[key] || ''}
                    onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
                  />
                ) : (
                  <select
                    value={filters[key] || ''}
                    onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
                  >
                    <option value="">All</option>
                    {options(key).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            ))}
          </div>
        </section>
      )}
      {active && (
        <div className="notice dashboard-filter-note">
          <span>
            Whole matching invoices · settlements through today. Payments show allocations to
            matching bills; budget and advances remain project-wide.
          </span>
          <button className="text-btn" onClick={() => setFilters({})}>
            Clear filters
          </button>
          <a
            className="text-btn"
            href={`/api/projects/${props.data.project._id}/export?type=bills&${query}`}
          >
            Download matching bills ↗
          </a>
        </div>
      )}
    </>
  );
  return (
    <DashboardContent
      {...props}
      data={{
        ...props.data,
        summary: active && filtered.data ? filtered.data : props.data.summary,
      }}
      fullSummary={props.data.summary}
      filtered={active}
      filters={controls}
      pending={active && filtered.isLoading}
      error={active && filtered.isError ? filtered.error.message : ''}
      filterButton={
        <button
          className="btn secondary dashboard-filter-toggle"
          aria-expanded={show}
          onClick={() => setShow(!show)}
        >
          <CalendarDays size={16} />
          {active ? 'Filtered bills' : t('allTime')}
          <ChevronRight size={14} />
        </button>
      }
    />
  );
}
function DashboardContent({
  data,
  name,
  onAdd,
  onTask,
  fullSummary,
  filtered,
  filters,
  pending,
  error,
  filterButton,
}: {
  data: Snapshot;
  name: string;
  onAdd: (kind: string) => void;
  onTask: (task: any) => void;
  fullSummary: Snapshot['summary'];
  filtered: boolean;
  filters: ReactNode;
  pending: boolean;
  error: string;
  filterButton: ReactNode;
}) {
  const { t, lang } = useUi();
  const s = data.summary;
  const p = data.project;
  const logs = data.records
    .filter((r) => r.kind === 'log' && !r.voided)
    .sort((a, b) => b.data.date.localeCompare(a.data.date));
  const tasks = data.records
    .filter((r) => r.kind === 'task' && !r.voided && r.data.status !== 'done')
    .sort((a, b) => a.data.dueDate.localeCompare(b.data.dueDate));
  const categories = Object.entries(s.category)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
  const recent = [...s.bills].sort((a, b) => b.data.date.localeCompare(a.data.date)).slice(0, 5);
  const overdue = s.bills.filter(
    (b) => b.outstanding > 0 && b.data.dueDate && b.data.dueDate < today(),
  );
  const ratio = s.budget ? Math.round((s.cost / s.budget) * 100) : 0;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="tiny-line" /> YOUR HOME. EVERY LITTLE DETAIL.
          </div>
          <h1>
            {t('goodMorning')}, {name.split(' ')[0]} <span className="greeting-sun">☀</span>
          </h1>
          <p>{t('overviewSubtitle')}</p>
        </div>
        {filterButton}
      </div>
      {filters}
      <div className="project-banner">
        <div className="project-banner-copy">
          <div className="project-state">
            <span className="status-dot" />
            {p.data.status} project
          </div>
          <h2>{p.name}</h2>
          <p>
            <MapPin size={14} />
            {p.data.location || 'Your home, your place'}
            <span>•</span>
            {p.data.floors} floors
            {p.data.area && (
              <>
                <span>•</span>
                {p.data.area.toLocaleString('en-IN')} {p.data.areaUnit}
              </>
            )}
          </p>
          <div className="project-banner-footer">
            <span className="small-house">
              <Sprout size={18} />
            </span>
            <span>
              {logs[0] ? logs[0].data.title : 'Every dream home begins with a first step.'}
            </span>
          </div>
        </div>
        {p.data.cover ? (
          <img
            className="banner-cover"
            src={`/api/projects/${p._id}/attachments/${p.data.cover}`}
            alt={p.name + ' project cover'}
          />
        ) : (
          <House className="banner-house" />
        )}
        <span className="banner-caption">A home is built one day at a time.</span>
      </div>
      {pending ? (
        <Loading />
      ) : error ? (
        <Empty title="Filters could not load" body={error} />
      ) : (
        <>
          <div className="stats-grid">
            {[
              {
                label: t('plannedBudget'),
                amount: s.budget,
                icon: Landmark,
                note: filtered ? 'Project budget, all time' : 'Your plan for this home',
                className: '',
              },
              {
                label: filtered ? 'Cost of matching bills' : t('recordedCost'),
                amount: s.cost,
                icon: ReceiptText,
                note: s.budget ? `${ratio}% of planned budget` : 'All bills, after credit notes',
                className: 'featured',
              },
              {
                label: filtered ? 'Paid toward matching bills' : t('cashPaid'),
                amount: s.cash,
                icon: Wallet,
                note: filtered ? 'Allocated payments, all dates' : 'Payments minus refunds',
                className: '',
              },
              {
                label: filtered ? 'Matching bills outstanding' : t('outstanding'),
                amount: s.outstanding,
                icon: Clock3,
                note: overdue.length
                  ? `${overdue.length} overdue bill${overdue.length > 1 ? 's' : ''}`
                  : `${s.bills.filter((b) => b.outstanding > 0).length} bills with a balance`,
                className: 'outstanding-card',
              },
            ].map(({ label, amount, icon: Icon, note, className }) => (
              <div className={`stat-card ${className}`} key={label}>
                <div className="stat-label">
                  {label}
                  <span className="stat-icon">
                    <Icon size={17} />
                  </span>
                </div>
                <div className="stat-value">
                  <Money value={amount} />
                </div>
                <div className="stat-note">
                  {className === 'featured' ? (
                    <span className="mini-progress">
                      <i style={{ width: `${Math.min(ratio, 100)}%` }} />
                    </span>
                  ) : (
                    <span className="note-dot" />
                  )}
                  {note}
                </div>
              </div>
            ))}
          </div>
          <div className="balance-strip">
            <div>
              <span className="note-dot amber" />
              {t('advances')}{' '}
              <strong>
                <Money value={fullSummary.advances} />
              </strong>
            </div>
            <span className="strip-divider" />
            <div>
              {fullSummary.overrun ? 'Budget overrun (project)' : t('remaining')}{' '}
              <strong className={fullSummary.overrun ? 'text-red' : ''}>
                <Money value={fullSummary.overrun || fullSummary.remaining} />
              </strong>
            </div>
            <p>
              {filtered ? 'Project-wide, all time. ' : ''}
              {t('budgetNote')}
            </p>
          </div>
          {!s.bills.length ? (
            <section className="panel">
              <Empty
                title={filtered ? 'No matching bills' : t('emptyTitle')}
                body={
                  filtered
                    ? 'Widen or clear the filters to see more of your project.'
                    : t('emptyText')
                }
                action={
                  <button className="btn primary" onClick={() => onAdd('bill')}>
                    <Plus size={16} />
                    {t('addExpense')}
                  </button>
                }
              />
            </section>
          ) : (
            <div className="dashboard-charts">
              <section className="panel activity-panel">
                <div className="panel-heading">
                  <div>
                    <h3>{t('costActivity')}</h3>
                    <p>Construction cost & payments, month by month</p>
                  </div>
                  <span className="subtle-tag">{filtered ? 'Matching bills' : t('allTime')}</span>
                </div>
                <div className="chart-legend">
                  <span>
                    <i style={{ background: '#276d5b' }} />
                    {t('cost')}
                  </span>
                  <span>
                    <i style={{ background: '#dfb268' }} />
                    {filtered ? 'Allocated payments' : t('cash')}
                  </span>
                </div>
                <div className="area-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={s.monthly} margin={{ left: 0, right: 15, top: 12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="costFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0" stopColor="#4e8b6f" stopOpacity={0.2} />
                          <stop offset="1" stopColor="#4e8b6f" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 5"
                        vertical={false}
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: 'var(--muted)' }}
                        tickFormatter={(v) =>
                          new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en', {
                            month: 'short',
                          }).format(new Date(`${v}-15`))
                        }
                        dy={10}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10, fill: 'var(--muted)' }}
                        tickFormatter={(n) => formatMoney(n, true)}
                        width={65}
                      />
                      <Tooltip
                        formatter={(v: any) => formatMoney(Number(v))}
                        labelFormatter={(v) => String(v)}
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--text)',
                          fontSize: 12,
                        }}
                      />
                      <Area
                        name={t('cost')}
                        type="monotone"
                        dataKey="cost"
                        stroke="#276d5b"
                        strokeWidth={2.5}
                        fill="url(#costFill)"
                        activeDot={{ r: 5 }}
                      />
                      <Area
                        name={filtered ? 'Allocated payments' : t('cash')}
                        type="monotone"
                        dataKey="cash"
                        stroke="#dfb268"
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        fill="transparent"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="panel category-panel">
                <div className="panel-heading">
                  <div>
                    <h3>{t('categoryCost')}</h3>
                    <p>Recorded cost by category</p>
                  </div>
                  <Link to="/app/budget" className="icon-link" aria-label="Open budget">
                    <ArrowUpRight size={18} />
                  </Link>
                </div>
                <div className="donut-wrap">
                  <ResponsiveContainer width="100%" height={185}>
                    <PieChart>
                      <Pie
                        data={categories}
                        innerRadius={61}
                        outerRadius={78}
                        dataKey="value"
                        stroke="var(--surface)"
                        strokeWidth={4}
                        paddingAngle={1}
                        startAngle={90}
                        endAngle={450}
                      >
                        {categories.map((_, i) => (
                          <Cell key={i} fill={colours[i % colours.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: any) => formatMoney(Number(v))}
                        contentStyle={{
                          borderRadius: 10,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-label">
                    <small>Total cost</small>
                    <strong>
                      <Money value={s.cost} compact />
                    </strong>
                    <span>{categories.length} categories</span>
                  </div>
                </div>
                <div className="category-legend">
                  {categories.slice(0, 4).map((c, i) => (
                    <div key={c.name}>
                      <span>
                        <i style={{ background: colours[i] }} />
                        {c.name}
                      </span>
                      <strong>{s.cost ? Math.round((c.value / s.cost) * 100) : 0}%</strong>
                    </div>
                  ))}
                </div>
                <Link to="/app/reports" className="category-footer">
                  See the full breakdown <ArrowRight size={14} />
                </Link>
              </section>
            </div>
          )}
          <div className="dashboard-second">
            <section className="panel recent-panel">
              <div className="panel-heading">
                <div>
                  <h3>{t('recentExpenses')}</h3>
                  <p>The little things that add up to home</p>
                </div>
                <Link className="text-btn" to="/app/expenses">
                  {t('viewAll')}
                  <ArrowRight size={14} />
                </Link>
              </div>
              {recent.length ? (
                <>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>EXPENSE</th>
                          <th>DATE</th>
                          <th>AMOUNT</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recent.map((b, i) => (
                          <tr key={b._id}>
                            <td>
                              <Link
                                to={`/app/expenses?q=${encodeURIComponent(b.data.description)}`}
                                className="expense-cell"
                              >
                                <span className={`category-icon tone-${i % 4}`}>
                                  <ReceiptText size={17} />
                                </span>
                                <span>
                                  <strong>{b.data.description}</strong>
                                  <small>
                                    {data.vendors.find((v) => v._id === b.data.vendor)?.data.name}
                                  </small>
                                </span>
                              </Link>
                            </td>
                            <td className="nowrap">{dateLabel(b.data.date, lang, true)}</td>
                            <td className="nowrap">
                              <Money value={b.total - b.credit} />
                            </td>
                            <td>
                              <Badge status={b.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button className="table-add" onClick={() => onAdd('bill')}>
                    <Plus size={15} />
                    {t('addExpense')}
                  </button>
                </>
              ) : (
                <Empty />
              )}
            </section>
            <section className="panel task-panel">
              <div className="panel-heading">
                <div>
                  <h3>{t('pendingTasks')}</h3>
                  <p>A small nudge for what’s next</p>
                </div>
                <Link className="icon-link" to="/app/tasks" aria-label="All tasks">
                  <ArrowUpRight size={18} />
                </Link>
              </div>
              <div className="dashboard-tasks">
                {tasks.length ? (
                  tasks.slice(0, 3).map((task) => (
                    <div className="dashboard-task" key={task._id}>
                      <button
                        className="task-check"
                        aria-label={`Complete ${task.data.title}`}
                        onClick={() => onTask(task)}
                      >
                        <Check size={13} />
                      </button>
                      <div>
                        <strong>{task.data.title}</strong>
                        <small className={task.data.dueDate < today() ? 'text-red' : ''}>
                          <CalendarDays size={12} />
                          {dateLabel(task.data.dueDate, lang, true)}
                          <span className={`priority-dot ${task.data.priority}`} />
                          {task.data.priority}
                        </small>
                      </div>
                      <ChevronRight size={15} className="muted" />
                    </div>
                  ))
                ) : (
                  <Empty title="You're all caught up" body="Add a task for your next site visit." />
                )}
              </div>
              <button className="task-add text-btn" onClick={() => onAdd('task')}>
                <Plus size={15} />
                {t('addTask')}
              </button>
            </section>
          </div>
          <div className="dashboard-bottom">
            <section className="progress-preview">
              <div>
                <span className="eyebrow">THE BUILDING DIARY</span>
                <h3>{t('recentProgress')}</h3>
                <p>
                  {logs[0]
                    ? logs[0].data.notes
                    : 'Keep the story of your home, one photo and one day at a time.'}
                </p>
                <Link to="/app/progress" className="text-btn">
                  Visit your progress diary
                  <ArrowRight size={15} />
                </Link>
              </div>
              <button className="progress-upload" onClick={() => onAdd('log')}>
                <Camera size={24} />
                <span>{t('addLog')}</span>
              </button>
            </section>
            <section className="care-note">
              <span className="care-icon">
                <Sprout size={28} />
              </span>
              <h3>Every rupee has a story.</h3>
              <p>
                Keep it safe. Keep it simple.
                <br />
                Build your home with a little more peace of mind.
              </p>
            </section>
          </div>
          <footer className="app-footer">
            <span>{t('builtWithCare')}</span>
            <span>
              <span className="status-dot" /> {t('privacy')}
            </span>
          </footer>
        </>
      )}
    </>
  );
}
