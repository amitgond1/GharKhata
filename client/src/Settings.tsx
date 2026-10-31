import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus,
  Users,
  ShieldCheck,
  Settings2,
  ArrowUpRight,
  Trash2,
  History,
  Sun,
  Moon,
  Globe,
  Check,
} from 'lucide-react';
import { type Snapshot, api, post } from './api';
import { useUi } from './context';
import { Empty, Modal, Submit } from './ui';
import { PageTitle } from './Records';
export function Settings({
  data,
  user,
  role,
  onAdd,
  onRefresh,
}: {
  data: Snapshot;
  user: any;
  role: string;
  onAdd: (kind: string, initial?: any) => void;
  onRefresh: () => void;
}) {
  const { t, toast, lang, setLang, dark, setDark } = useUi();
  const qc = useQueryClient();
  const [tab, setTab] = useState('project');
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [preview, setPreview] = useState<any>(null);
  const [revoke, setRevoke] = useState<any>(null);
  const [auditPage, setAuditPage] = useState(1);
  const path = `/projects/${data.project._id}`;
  const invitations = useQuery<any[]>({
    queryKey: ['invitations', data.project._id],
    queryFn: () => api(`${path}/invitations`),
    enabled: tab === 'team' && role === 'owner',
  });
  const members = useQuery({
    queryKey: ['members', data.project._id],
    queryFn: () => api(`${path}/members`),
  });
  const audit = useQuery({
    queryKey: ['audit', data.project._id, auditPage],
    queryFn: () => api(`${path}/audit?page=${auditPage}`),
    enabled: tab === 'audit',
  });
  return (
    <>
      <PageTitle
        title={t('settings')}
        subtitle="A home is a shared journey. Make this space work for you."
      />
      <div className="tabs">
        {[
          ['project', 'Project'],
          ['profile', 'Profile & appearance'],
          ['team', 'Project team'],
          ['audit', 'Audit history'],
        ].map(([k, l]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'project' && (
        <section className="panel settings-panel">
          <div className="panel-heading">
            <div>
              <h3>{data.project.name}</h3>
              <p>{data.project.data.location}</p>
            </div>
            {['owner', 'manager'].includes(role) && (
              <button className="btn secondary" onClick={() => onAdd('project', data.project.data)}>
                <Settings2 size={16} />
                Edit project
              </button>
            )}
          </div>
          <dl className="project-dl">
            {[
              ['Project type', data.project.data.type],
              ['Status', data.project.data.status],
              ['Started', data.project.data.startDate],
              ['Expected completion', data.project.data.endDate || 'Not set'],
              ['Floors', data.project.data.floors],
              [
                'Built-up area',
                data.project.data.area
                  ? `${data.project.data.area} ${data.project.data.areaUnit}`
                  : 'Not set',
              ],
              [
                'Plot area',
                data.project.data.plotArea
                  ? `${data.project.data.plotArea} ${data.project.data.areaUnit}`
                  : 'Not set',
              ],
              ['Timezone', 'Asia/Kolkata'],
              ['Your role', role],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="notice">{t('projectComplete')}</p>
          <div className="settings-export">
            <ShieldCheck size={24} />
            <div>
              <h4>Your records belong to you.</h4>
              <p>Download all active project records as CSV. Audit history is kept separately.</p>
            </div>
            <a
              className="btn secondary"
              href={`${path.replace('/projects', '/api/projects')}/export?type=data`}
            >
              Export records <ArrowUpRight size={16} />
            </a>
          </div>
        </section>
      )}
      {tab === 'profile' && (
        <section className="panel settings-panel">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await post('/auth/profile', { name, language: lang }, 'PATCH');
                qc.invalidateQueries({ queryKey: ['session'] });
                toast(t('success'));
              } catch (e) {
                toast((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>{t('profile')}</h3>
            <div className="form-grid">
              <label className="field">
                {t('name')}
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="field">
                {t('email')}
                <input disabled value={user.email} />
              </label>
              <label className="field">
                {t('language')}
                <select value={lang} onChange={(e) => setLang(e.target.value)}>
                  <option value="en">English</option>
                  <option value="hi">हिन्दी</option>
                </select>
              </label>
              <div className="field">
                <span>{t('theme')}</span>
                <div className="theme-selector">
                  <button
                    type="button"
                    className={`btn secondary ${!dark ? 'selected' : ''}`}
                    onClick={() => setDark(false)}
                  >
                    <Sun size={16} />
                    {t('light')}
                  </button>
                  <button
                    type="button"
                    className={`btn secondary ${dark ? 'selected' : ''}`}
                    onClick={() => setDark(true)}
                  >
                    <Moon size={16} />
                    {t('dark')}
                  </button>
                </div>
              </div>
            </div>
            <Submit pending={busy} />
          </form>
        </section>
      )}
      {tab === 'team' && (
        <>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>{t('team')}</h3>
                <p>Owner controls access. Every role is checked by the server.</p>
              </div>
              <Users size={22} />
            </div>
            {members.isError ? (
              <p className="notice warning">Could not load members.</p>
            ) : (
              members.data?.map((m: any) => (
                <div className="member-row" key={m._id}>
                  <span className="avatar">{m.name?.[0]}</span>
                  <div>
                    <strong>{m.name}</strong>
                    <small>{m.email}</small>
                  </div>
                  <span className="badge neutral">{m.role}</span>
                  {role === 'owner' && m.role !== 'owner' && (
                    <button
                      className="icon-btn danger"
                      aria-label={`Revoke ${m.name}`}
                      onClick={() => setRevoke(m)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))
            )}
          </section>
          <div className="role-guide">
            {[
              ['Owner', 'Full project control and access management.'],
              ['Manager', 'Manage operational and financial records.'],
              ['Contributor', 'Add bills, payments, attendance, progress and tasks.'],
              ['Viewer', 'Read and export records. No changes.'],
            ].map(([r, d]) => (
              <div key={r}>
                <strong>{r}</strong>
                <p>{d}</p>
              </div>
            ))}
          </div>
          {role === 'owner' && invitations.data && invitations.data.length > 0 && (
            <section className="panel pending-invitations">
              <div className="panel-heading">
                <h3>Pending invitations</h3>
              </div>
              {invitations.data.map((i) => (
                <div className="member-row" key={i._id}>
                  <div>
                    <strong>{i.email}</strong>
                    <small>
                      {i.role} ? expires{' '}
                      {new Date(i.expiresAt).toLocaleDateString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                      })}
                    </small>
                  </div>
                  <button
                    className="text-btn danger"
                    onClick={() => setRevoke({ ...i, name: i.email, invitation: true })}
                  >
                    Revoke invitation
                  </button>
                </div>
              ))}
            </section>
          )}
          {role === 'owner' && (
            <section className="panel settings-panel">
              <h3>{t('invite')}</h3>
              <form
                className="invite-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    const r = await post(`${path}/invitations`, { email, role: inviteRole });
                    setPreview(r.developmentPreview);
                    qc.invalidateQueries({ queryKey: ['invitations'] });
                    toast(
                      r.developmentPreview
                        ? 'Invitation link ready in development preview'
                        : 'Invitation sent',
                    );
                    if (!r.developmentPreview) setEmail('');
                  } catch (e) {
                    toast((e as Error).message, true);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label className="field">
                  {t('email')}
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label className="field">
                  {t('memberRole')}
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                    {['viewer', 'contributor', 'manager'].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <Submit pending={busy} label={t('invite')} />
              </form>
              {preview && (
                <div className="dev-preview">
                  <strong>Development email preview</strong>
                  <p>{preview.note}</p>
                  <a href={preview.url}>{preview.url}</a>
                </div>
              )}
            </section>
          )}
        </>
      )}
      {tab === 'audit' && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>A clear record of every change</h3>
              <p>Who changed what, and when. Financial records are never silently deleted.</p>
            </div>
            <History size={22} />
          </div>
          {audit.isLoading ? (
            <p className="notice">Loading history…</p>
          ) : audit.isError ? (
            <p className="notice warning">Could not load audit history.</p>
          ) : (
            audit.data?.map((a: any) => (
              <details className="audit-row" key={a._id}>
                <summary>
                  <span className="ledger-dot" />
                  <strong>{a.action.replaceAll('.', ' · ')}</strong>
                  <small>
                    {new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Asia/Kolkata',
                    }).format(new Date(a.createdAt))}
                  </small>
                </summary>
                <p>
                  By{' '}
                  {members.data?.find((m: any) => String(m.user) === String(a.user))?.name ||
                    'Former member'}{' '}
                  · Record {a.target}
                </p>
                <div className="audit-data">
                  {a.before && (
                    <div>
                      <strong>Before</strong>
                      <pre>{JSON.stringify(a.before, null, 2)}</pre>
                    </div>
                  )}
                  {a.after && (
                    <div>
                      <strong>After</strong>
                      <pre>{JSON.stringify(a.after, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </details>
            ))
          )}
          {audit.data?.length === 0 && <Empty />}
          <div className="pagination">
            <button
              className="btn secondary compact"
              disabled={auditPage === 1}
              onClick={() => setAuditPage((n) => n - 1)}
            >
              Previous
            </button>
            <span>Page {auditPage}</span>
            <button
              className="btn secondary compact"
              disabled={!audit.data || audit.data.length < 50}
              onClick={() => setAuditPage((n) => n + 1)}
            >
              Next
            </button>
          </div>
        </section>
      )}
      {revoke && (
        <Modal title={`Revoke access for ${revoke.name}?`} onClose={() => setRevoke(null)}>
          <div className="form-body">
            <p>
              This person will lose access to this project. Their previous records and audit history
              will remain.
            </p>
            <div className="detail-actions">
              <button className="btn secondary" onClick={() => setRevoke(null)}>
                {t('cancel')}
              </button>
              <button
                className="btn primary danger-solid"
                onClick={async () => {
                  try {
                    await api(
                      `${path}/${revoke.invitation ? 'invitations' : 'members'}/${revoke._id}`,
                      { method: 'DELETE' },
                    );
                    qc.invalidateQueries({ queryKey: ['members'] });
                    qc.invalidateQueries({ queryKey: ['invitations'] });
                    toast('Access revoked');
                    setRevoke(null);
                  } catch (e) {
                    toast((e as Error).message, true);
                  }
                }}
              >
                Revoke access
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
