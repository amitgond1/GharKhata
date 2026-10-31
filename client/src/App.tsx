import { useEffect, useState } from 'react';
import {
  Routes,
  Route,
  Navigate,
  NavLink,
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  ReceiptText,
  Wallet,
  Store,
  HardHat,
  Package,
  Camera,
  ChartNoAxesCombined,
  ListTodo,
  FileText,
  Settings2,
  Plus,
  Search,
  Bell,
  ChevronDown,
  ArrowUpRight,
  House,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  ShieldCheck,
  ArrowRight,
  Check,
  WifiOff,
  RefreshCw,
  MoreHorizontal,
  Sprout,
} from 'lucide-react';
import { today } from '@gharkhata/shared';
import { api, post, setCsrf, type Snapshot } from './api';
import { UiContext, useUi, type TranslationKey } from './context';
import { AuthPage, Brand, Landing } from './Auth';
import { Dashboard } from './Dashboard';
import { FinancialList, Vendors } from './Records';
import { Labour, Materials, Progress, Tasks, Budgets, stockBalances } from './Operations';
import { Reports } from './Reports';
import { Search as ProjectSearch } from './Search';
import { Settings } from './Settings';
import { BillForm, RecordForm } from './forms';
import { Modal, Loading, Empty, Money, Submit } from './ui';
import { useMobileViewport } from './useMobileViewport';
const nav = [
  ['', 'home', LayoutDashboard],
  ['expenses', 'expenses', ReceiptText],
  ['payments', 'payments', Wallet],
  ['vendors', 'vendors', Store],
  ['labour', 'labour', HardHat],
  ['materials', 'materials', Package],
  ['progress', 'progress', Camera],
  ['budget', 'budget', ChartNoAxesCombined],
  ['tasks', 'tasks', ListTodo],
  ['reports', 'reports', FileText],
] as const;
export default function App() {
  useMobileViewport();
  const [lang, setLang] = useState(localStorage.getItem('gharkhata:language') || 'en');
  const [dark, setDark] = useState(localStorage.getItem('gharkhata:theme') === 'dark');
  const [notice, setNotice] = useState<{ message: string; error: boolean; id: number } | null>(
    null,
  );
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [demoBusy, setDemoBusy] = useState(false);
  const session = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        return await api('/auth/me');
      } catch (e) {
        if (
          (e as Error).message.includes('sign in') ||
          (e as Error).message.includes('Session expired')
        )
          return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 5 * 60000,
  });
  const toast = (message: string, error = false) => setNotice({ message, error, id: Date.now() });
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem('gharkhata:language', lang);
  }, [lang]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('gharkhata:theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    if (session.data?.csrf) setCsrf(session.data.csrf);
  }, [session.data]);
  useEffect(() => {
    if (notice) {
      const id = setTimeout(() => setNotice(null), 6500);
      return () => clearTimeout(id);
    }
  }, [notice]);
  const onSession = (s: any) => {
    setCsrf(s.csrf);
    qc.clear();
    qc.setQueryData(['session'], s);
    if (s.user.language) setLang(s.user.language);
  };
  const onDemo = async () => {
    setDemoBusy(true);
    try {
      onSession(await post('/demo', {}));
      navigate('/app');
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setDemoBusy(false);
    }
  };
  const user = session.data?.user;
  return (
    <UiContext.Provider value={{ lang, setLang, dark, setDark, toast }}>
      {session.isLoading ? (
        <div className="startup">
          <Brand />
          <Loading />
        </div>
      ) : session.isError ? (
        <div className="startup">
          <Brand />
          <Empty
            title="We couldn’t reach your project"
            body={session.error.message}
            action={
              <button className="btn primary" onClick={() => session.refetch()}>
                Try again
              </button>
            }
          />
        </div>
      ) : (
        <Routes>
          <Route
            path="/"
            element={
              user ? <Navigate to="/app" replace /> : <Landing onDemo={onDemo} busy={demoBusy} />
            }
          />
          {(['login', 'register', 'forgot-password', 'reset-password'] as const).map((path, i) => (
            <Route
              path={`/${path}`}
              key={path}
              element={
                <AuthPage
                  mode={(['login', 'register', 'forgot', 'reset'] as const)[i]}
                  onSession={onSession}
                />
              }
            />
          ))}
          <Route
            path="/invite"
            element={
              user ? (
                <AcceptInvite />
              ) : (
                <Navigate
                  to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
                  replace
                />
              )
            }
          />
          <Route
            path="/app/*"
            element={user ? <Workspace user={user} /> : <Navigate to="/login" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
      {notice && (
        <div
          key={notice.id}
          className={`toast ${notice.error ? 'error' : ''}`}
          role={notice.error ? 'alert' : 'status'}
        >
          {notice.error ? <X size={18} /> : <Check size={18} />}
          <span>{notice.message}</span>
          <button
            className="icon-btn"
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </UiContext.Provider>
  );
}
function AcceptInvite() {
  const [params] = useSearchParams();
  const { toast } = useUi();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <div className="startup">
      <Brand />
      <section className="panel info-card">
        <h1>A shared journey home.</h1>
        <p>
          Accept this invitation to join the project. Your signed-in email must match the
          invitation.
        </p>
        <button
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await post('/invitations/accept', { token: params.get('token') });
              qc.invalidateQueries({ queryKey: ['projects'] });
              toast('You joined the project');
              navigate('/app');
            } catch (e) {
              toast((e as Error).message, true);
            } finally {
              setBusy(false);
            }
          }}
        >
          Accept invitation
          <ArrowRight size={16} />
        </button>
      </section>
    </div>
  );
}
function Workspace({ user }: { user: any }) {
  const { t, toast, dark, setDark, lang, setLang } = useUi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [active, setActive] = useState(localStorage.getItem(`gharkhata:project:${user.id}`) || '');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [modal, setModal] = useState<{ kind: string; initial?: any } | null>(null);
  const [voiding, setVoiding] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [voidBusy, setVoidBusy] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const online = () => setOffline(!navigator.onLine);
    window.addEventListener('online', online);
    window.addEventListener('offline', online);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', online);
    };
  }, []);
  useEffect(() => {
    if (!mobileMenu) return;
    const before = document.activeElement as HTMLElement;
    const menu = document.querySelector('.mobile-sidebar') as HTMLElement | null;
    if (!menu) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const items = () =>
      Array.from(
        menu.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),select:not([disabled])'),
      );
    items()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenu(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const list = items();
      const first = list[0],
        last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      document.body.style.overflow = previousOverflow;
      before?.focus();
    };
  }, [mobileMenu]);
  const projects = useQuery<any[]>({
    queryKey: ['projects', user.id],
    queryFn: () => api('/projects'),
  });
  const selected = projects.data?.find((p) => p._id === active) || projects.data?.[0];
  const project = selected?._id;
  const role = selected?.role || 'viewer';
  const canWrite = role !== 'viewer';
  const canManage = ['owner', 'manager'].includes(role);
  const snapshot = useQuery<Snapshot>({
    queryKey: ['snapshot', project],
    queryFn: () => api(`/projects/${project}/snapshot`),
    enabled: !!project,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    if (project) {
      setActive(project);
      localStorage.setItem(`gharkhata:project:${user.id}`, project);
    }
  }, [project, user.id]);
  useEffect(() => {
    setMobileMenu(false);
    setAddMenu(false);
    setNotifications(false);
  }, [location.pathname]);
  const onAdd = (kind: string, initial?: any) => {
    setAddMenu(false);
    setMobileMenu(false);
    setModal({ kind, initial });
  };
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['snapshot', project] }),
      qc.invalidateQueries({ queryKey: ['projects', user.id] }),
      qc.invalidateQueries({ queryKey: ['audit', project] }),
    ]);
  };
  const save = async (kind: string, data: any, key?: string) => {
    if (kind === 'project') {
      const p = await post(
        modal?.initial ? `/projects/${project}` : '/projects',
        data,
        modal?.initial ? 'PATCH' : 'POST',
        key,
      );
      if (p._id) setActive(p._id);
    } else if (kind === 'vendor')
      await post(
        `/projects/${project}/vendors${modal?.initial?._id ? '/' + modal.initial._id : ''}`,
        data,
        modal?.initial?._id ? 'PATCH' : 'POST',
        key,
      );
    else if (modal?.initial?._id)
      await post(`/projects/${project}/records/${modal.initial._id}`, data, 'PATCH', key);
    else await post(`/projects/${project}/records/${kind}`, data, 'POST', key);
    await refresh();
    setModal(null);
    toast(t('success'));
  };
  const onTask = async (task: any, data?: any) => {
    try {
      await post(
        `/projects/${project}/tasks/${task._id}`,
        data || { ...task.data, status: task.data.status === 'done' ? 'pending' : 'done' },
        'PATCH',
      );
      await refresh();
      toast(t('success'));
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  const logout = async () => {
    try {
      await post('/auth/logout', {});
      setCsrf('');
      qc.clear();
      qc.setQueryData(['session'], null);
      navigate('/');
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  const data = snapshot.data;
  const reminders = data
    ? [
        ...data.summary.bills
          .filter(
            (b) =>
              b.outstanding > 0 &&
              b.data.dueDate &&
              b.data.dueDate <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          )
          .map((b) => ({
            id: b._id,
            title: b.data.description,
            note: `${b.data.dueDate < today() ? 'Overdue' : 'Due'} ${b.data.dueDate} · ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(b.outstanding / 100)}`,
            link: '/app/expenses',
            share: `Reminder: ${b.data.description}, outstanding ₹${b.outstanding / 100}, due ${b.data.dueDate}.`,
          })),
        ...data.records
          .filter((r) => r.kind === 'task' && !r.voided && r.data.status !== 'done')
          .map((r) => ({
            id: r._id,
            title: r.data.title,
            note: `Task due ${r.data.dueDate}`,
            link: '/app/tasks',
            share: `Task reminder: ${r.data.title}. Due ${r.data.dueDate}.`,
          })),
        ...stockBalances(data)
          .filter((g) => g.quantity <= g.threshold)
          .map((g) => ({
            id: g.material + g.unit,
            title: `Low stock: ${g.material}`,
            note: `${Number(g.quantity) / 1000} ${g.unit} available`,
            link: '/app/materials',
            share: `Low stock: ${g.material}, ${Number(g.quantity) / 1000} ${g.unit} available.`,
          })),
        ...(data.summary.budget &&
        data.summary.cost * 100 >= data.summary.budget * (data.project.data.threshold || 90)
          ? [
              {
                id: 'budget',
                title: 'Budget threshold reached',
                note: `Recorded cost is at ${Math.round((data.summary.cost / data.summary.budget) * 100)}% of your budget.`,
                link: '/app/budget',
                share: 'Let’s review our recorded construction cost against the budget.',
              },
            ]
          : []),
      ]
    : [];
  const titles: Record<string, TranslationKey> = {
    bill: 'addExpense',
    payment: 'addPayment',
    vendor: 'addVendor',
    worker: 'addWorker',
    attendance: 'attendance',
    wage: 'wage',
    log: 'addLog',
    task: 'addTask',
    budget: 'addBudget',
    stock: 'addStock',
    contract: 'addContract',
    credit: 'credit',
    refund: 'refund',
    allocation: 'allocate',
    project: modal?.initial ? 'projectDetails' : 'newProject',
  };
  const sidebar = (
    <>
      <div className="sidebar-brand">
        <Brand />
      </div>
      <div className="project-switcher">
        <span className="project-switch-icon">
          <House size={19} />
        </span>
        <div>
          <small>YOUR PROJECT</small>
          <select
            aria-label="Switch project"
            value={project || ''}
            onChange={(e) => {
              if (e.target.value === 'new') {
                onAdd('project');
                return;
              }
              setActive(e.target.value);
              setMobileMenu(false);
            }}
          >
            {projects.data?.map((p) => (
              <option value={p._id} key={p._id}>
                {p.name}
                {p.demo ? ' · Demo' : ''}
              </option>
            ))}
            {!projects.data?.length && <option value="">Create your project</option>}
            {!user.demo && <option value="new">＋ Create new project</option>}
          </select>
        </div>
        <ChevronDown size={14} />
      </div>
      <span className="nav-caption">WORKSPACE</span>
      <nav className="side-nav">
        {nav.map(([path, key, Icon], i) => (
          <NavLink
            key={path}
            to={`/app${path ? '/' + path : ''}`}
            end={!path}
            className={({ isActive }) =>
              `${isActive ? 'active' : ''} ${i === 6 ? 'nav-section-start' : ''}`
            }
          >
            <Icon size={18} strokeWidth={1.7} />
            <span>{t(key)}</span>
            {key === 'expenses' && data?.summary.bills.length ? (
              <span className="nav-count">{data.summary.bills.length}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <span className="sidebar-note-icon">
            <Sprout size={23} />
          </span>
          <strong>Built one day at a time.</strong>
          <p>
            Your dream home is worth
            <br />
            keeping track of.
          </p>
        </div>
        <NavLink className="settings-nav" to="/app/settings">
          <Settings2 size={18} />
          {t('settings')}
        </NavLink>
        <button className="user-profile" onClick={() => navigate('/app/settings')}>
          <span className="avatar">{user.name[0]}</span>
          <span>
            <strong>{user.name}</strong>
            <small>{role.charAt(0).toUpperCase() + role.slice(1)}</small>
          </span>
          <ChevronDown size={14} />
        </button>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">{sidebar}</aside>
      {mobileMenu && (
        <div className="mobile-menu-backdrop" onClick={() => setMobileMenu(false)}>
          <aside
            className="mobile-sidebar"
            role="dialog"
            aria-modal="true"
            aria-label="Project navigation"
            id="mobile-navigation"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-btn close-menu"
              aria-label="Close navigation"
              onClick={() => setMobileMenu(false)}
            >
              <X size={22} />
            </button>
            {sidebar}
            <button className="settings-nav" onClick={logout}>
              <LogOut size={17} />
              {t('logout')}
            </button>
          </aside>
        </div>
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <House size={15} />
            <span>/</span>
            {selected?.name || 'Your home'}
            <span>/</span>
            <strong>
              {t(
                nav.find(
                  ([path]) => location.pathname === '/app' + (path ? '/' + path : ''),
                )?.[1] || 'settings',
              )}
            </strong>
          </div>
          <form
            className="top-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/app/search?q=${encodeURIComponent(globalSearch)}`);
            }}
          >
            <Search size={16} />
            <input
              aria-label="Search project"
              placeholder={t('search')}
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <div className="topbar-actions">
            <button
              className="icon-btn mobile-search"
              aria-label="Search project"
              onClick={() => navigate('/app/search')}
            >
              <Search size={19} />
            </button>
            <button
              className="icon-btn theme-toggle"
              onClick={() => setDark(!dark)}
              aria-label={dark ? 'Use light mode' : 'Use dark mode'}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <div className="notification-wrap">
              <button
                className="icon-btn bell"
                aria-label={t('notifications')}
                aria-expanded={notifications}
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={19} />
                {reminders.length > 0 && <i />}
              </button>
              {notifications && (
                <div className="notification-panel">
                  <h3>
                    {t('notifications')}
                    <span>{reminders.length}</span>
                  </h3>
                  {reminders.length ? (
                    reminders.map((r) => (
                      <div className="reminder" key={r.id}>
                        <Link to={r.link}>
                          <strong>{r.title}</strong>
                          <small>{r.note}</small>
                        </Link>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(r.share)}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Prepare WhatsApp message"
                        >
                          Share ↗
                        </a>
                      </div>
                    ))
                  ) : (
                    <Empty
                      title="All clear for now"
                      body="Payment, task, budget and stock reminders appear here."
                    />
                  )}
                </div>
              )}
            </div>
            <span className="topbar-divider" />
            {canWrite && (
              <button className="btn primary top-add" onClick={() => onAdd('bill')}>
                <Plus size={17} />
                {t('addExpense')}
              </button>
            )}
            <button
              className="avatar top-avatar"
              onClick={logout}
              aria-label={t('logout')}
              title={t('logout')}
            >
              {user.name[0]}
            </button>
          </div>
        </header>
        {user.demo && (
          <div className="demo-banner">
            <span>
              <span className="demo-dot" />
              {t('demo')}
              <span className="demo-banner-detail">
                {' '}
                · Explore freely. These records are fictional and separate from real projects.
              </span>
            </span>
            <button
              onClick={async () => {
                await logout();
                navigate('/register');
              }}
            >
              Create your own account <ArrowUpRight size={13} />
            </button>
          </div>
        )}
        {offline && (
          <div className="offline-banner">
            <WifiOff size={15} />
            Offline · expense drafts stay on this device. Saved totals may be out of date.
          </div>
        )}
        <main className="main-content">
          {projects.isLoading || snapshot.isLoading ? (
            <Loading />
          ) : projects.isError || snapshot.isError ? (
            <Empty
              title="Your records couldn’t load"
              body={(projects.error || snapshot.error)?.message}
              action={
                <button
                  className="btn primary"
                  onClick={() => {
                    projects.refetch();
                    snapshot.refetch();
                  }}
                >
                  <RefreshCw size={16} />
                  {t('retry')}
                </button>
              }
            />
          ) : !data ? (
            <div className="welcome-project">
              <span className="welcome-icon">
                <House size={38} />
              </span>
              <div className="eyebrow">EVERY HOME STARTS SOMEWHERE</div>
              <h1>Let’s make room for your dream.</h1>
              <p>
                Create your construction or renovation project.
                <br />
                You can add your first expense right after.
              </p>
              <button className="btn primary" onClick={() => onAdd('project')}>
                <Plus size={17} />
                {t('newProject')}
              </button>
            </div>
          ) : (
            <Routes>
              <Route
                index
                element={
                  <Dashboard
                    data={data}
                    name={user.name}
                    onAdd={canWrite ? onAdd : () => toast('Your role is read-only', true)}
                    onTask={canWrite ? onTask : () => toast('Your role is read-only', true)}
                  />
                }
              />
              <Route
                path="expenses"
                element={
                  <FinancialList
                    data={data}
                    type="bill"
                    onAdd={onAdd}
                    onVoid={setVoiding}
                    canWrite={canWrite}
                    canManage={canManage}
                  />
                }
              />
              <Route
                path="payments"
                element={
                  <FinancialList
                    data={data}
                    type="payment"
                    onAdd={onAdd}
                    onVoid={setVoiding}
                    canWrite={canWrite}
                    canManage={canManage}
                  />
                }
              />
              <Route
                path="vendors"
                element={
                  <Vendors data={data} onAdd={onAdd} canWrite={canWrite} canManage={canManage} />
                }
              />
              <Route
                path="labour"
                element={
                  <Labour data={data} onAdd={onAdd} canWrite={canWrite} canManage={canManage} />
                }
              />
              <Route
                path="materials"
                element={
                  <Materials data={data} onAdd={onAdd} canWrite={canWrite} canManage={canManage} />
                }
              />
              <Route
                path="progress"
                element={
                  <Progress data={data} onAdd={onAdd} canWrite={canWrite} canManage={canManage} />
                }
              />
              <Route
                path="tasks"
                element={
                  <Tasks
                    data={data}
                    onAdd={onAdd}
                    canWrite={canWrite}
                    canManage={canManage}
                    onTask={onTask}
                  />
                }
              />
              <Route
                path="budget"
                element={
                  <Budgets
                    data={data}
                    onAdd={onAdd}
                    canWrite={canWrite}
                    canManage={canManage}
                    onVoid={setVoiding}
                  />
                }
              />
              <Route path="search" element={<ProjectSearch data={data} />} />
              <Route path="reports" element={<Reports data={data} />} />
              <Route
                path="settings"
                element={
                  <Settings data={data} user={user} role={role} onAdd={onAdd} onRefresh={refresh} />
                }
              />
              <Route path="*" element={<Navigate to="/app" />} />
            </Routes>
          )}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        <NavLink to="/app" end>
          <LayoutDashboard size={21} />
          <span>{t('home')}</span>
        </NavLink>
        <NavLink to="/app/expenses">
          <ReceiptText size={21} />
          <span>{t('expenses')}</span>
        </NavLink>
        <button
          className="mobile-add"
          disabled={!canWrite || !project}
          onClick={() => setAddMenu(true)}
        >
          <span>
            <Plus size={25} />
          </span>
          <b>{t('add')}</b>
        </button>
        <NavLink to="/app/progress">
          <Camera size={21} />
          <span>{t('progress')}</span>
        </NavLink>
        <button
          aria-expanded={mobileMenu}
          aria-controls="mobile-navigation"
          onClick={() => setMobileMenu(true)}
        >
          <MoreHorizontal size={23} />
          <span>{t('more')}</span>
        </button>
      </nav>
      {addMenu && (
        <Modal title="One more step towards home" onClose={() => setAddMenu(false)}>
          <div className="quick-add-grid">
            {[
              ['bill', 'addExpense', ReceiptText],
              ['payment', 'addPayment', Wallet],
              ['log', 'addLog', Camera],
              ['task', 'addTask', ListTodo],
            ].map(([kind, label, Icon]: any) => (
              <button key={kind} onClick={() => onAdd(kind)}>
                <Icon size={25} />
                <strong>{t(label)}</strong>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {modal && (
        <Modal
          wide={modal.kind === 'bill' || modal.kind === 'project'}
          title={t(titles[modal.kind] || 'add')}
          onClose={() => setModal(null)}
        >
          {modal.kind === 'bill' && data ? (
            <BillForm project={project} user={user.id} snapshot={data} onSave={save} />
          ) : (
            <RecordForm
              kind={modal.kind}
              snapshot={
                data ||
                ({
                  project: { _id: '' },
                  records: [],
                  vendors: [],
                  attachments: [],
                  summary: {
                    budget: 0,
                    cost: 0,
                    cash: 0,
                    outstanding: 0,
                    advances: 0,
                    remaining: 0,
                    overrun: 0,
                    bills: [],
                    payments: [],
                    category: {},
                    stage: {},
                    floor: {},
                    monthly: [],
                  },
                } as Snapshot)
              }
              onSave={save}
              initial={modal.initial}
            />
          )}
        </Modal>
      )}
      {voiding && (
        <Modal
          title="Keep history. Correct the record."
          onClose={() => {
            setVoiding(null);
            setReason('');
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setVoidBusy(true);
              try {
                await post(`/projects/${project}/records/${voiding._id}/void`, { reason });
                await refresh();
                setVoiding(null);
                setReason('');
                toast('Record voided. History is preserved.');
              } catch (e) {
                toast((e as Error).message, true);
              } finally {
                setVoidBusy(false);
              }
            }}
          >
            <div className="form-body">
              <p>
                This will void this {voiding.kind}. Its history stays in the audit trail. Linked
                records may need to be reversed first.
              </p>
              <label className="field">
                Why are you making this correction?
                <textarea
                  minLength={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </div>
            <div className="form-footer">
              <button type="button" className="btn secondary" onClick={() => setVoiding(null)}>
                {t('cancel')}
              </button>
              <Submit pending={voidBusy} label="Confirm void" />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
