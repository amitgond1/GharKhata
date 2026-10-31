import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  House as HouseIcon,
  ShieldCheck,
  Check,
  ReceiptText,
  Wallet,
  Camera,
  Menu,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { post } from './api';
import { useUi } from './context';
import { House } from './House';
import { Submit } from './ui';
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className={`brand ${light ? 'brand-light' : ''}`}>
      <span className="brand-mark">
        <HouseIcon size={23} strokeWidth={1.7} />
        <i />
      </span>
      <span>
        Ghar<span className="brand-weight">Khata</span>
        <small>BUILD WITH PEACE OF MIND</small>
      </span>
    </Link>
  );
}
export function Landing({ onDemo, busy }: { onDemo: () => void; busy: boolean }) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <nav>
          <a href="#how">How it works</a>
          <a href="#privacy">Your privacy</a>
          <a href="#faq">FAQs</a>
        </nav>
        <div>
          <Link className="text-btn" to="/login">
            Sign in
          </Link>
          <Link className="btn primary" to="/register">
            Get started <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="tiny-line" /> FOR THE HOME YOU’RE BUILDING
            </span>
            <h1>
              A dream home.
              <br />A clearer <em>hisaab.</em>
            </h1>
            <h2>
              Ghar banane ka har kharcha,
              <br />
              ab ek jagah.
            </h2>
            <p>
              Material bills, labour payments, pending dues aur daily progress—phone se aasani se
              manage karein.
            </p>
            <div className="hero-actions">
              <Link className="btn primary" to="/register">
                Start your home’s story <ArrowUpRight size={17} />
              </Link>
              <button className="btn secondary" disabled={busy} onClick={onDemo}>
                {busy ? 'Preparing your demo…' : 'Explore the live demo'}
                <ArrowRight size={16} />
              </button>
            </div>
            <span className="hero-assurance">
              <ShieldCheck size={15} /> Private by default. No bank connection needed.
            </span>
          </div>
          <div className="hero-visual">
            <span className="handwritten">
              It’s more than a house.
              <br />
              It’s your home.
            </span>
            <House className="hero-house" />
            <div className="floating-note cost-note">
              <span className="note-icon">
                <ReceiptText size={20} />
              </span>
              <div>
                <small>100 bags of cement</small>
                <strong>
                  ₹40,000 <span>recorded cost</span>
                </strong>
              </div>
              <Check size={16} />
            </div>
            <div className="floating-note paid-note">
              <span className="note-icon amber-bg">
                <Wallet size={20} />
              </span>
              <div>
                <small>Paid ₹25,000</small>
                <strong>
                  ₹15,000 <span>still to pay</span>
                </strong>
              </div>
            </div>
            <span className="example-label">
              Illustrative example · Try the demo to explore real calculations
            </span>
            <div className="visual-orbit" />
          </div>
        </section>
        <section className="landing-values">
          <span>
            <ReceiptText size={21} />
            Every bill accounted for
          </span>
          <span>
            <Wallet size={21} />
            Know what’s still pending
          </span>
          <span>
            <Camera size={21} />
            Watch your home take shape
          </span>
        </section>
        <section className="landing-section" id="how">
          <span className="eyebrow">LESS PAPERWORK. MORE PEACE OF MIND.</span>
          <h2>Simple enough for every site visit.</h2>
          <div className="steps-grid">
            {[
              [
                '01',
                'Make a home for your home',
                'Create a project, add your family, and set a budget that works for you.',
              ],
              [
                '02',
                'Add today’s expenses',
                'Capture a bill, record how much you paid, and save the receipt.',
              ],
              [
                '03',
                'See the whole picture',
                'Understand your costs, pending payments and daily progress in one place.',
              ],
            ].map(([n, title, body]) => (
              <article key={n}>
                <span className="step-number">{n}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="privacy-band" id="privacy">
          <ShieldCheck size={42} />
          <div>
            <span className="eyebrow">YOUR HOME. YOUR INFORMATION.</span>
            <h2>A private space for a personal journey.</h2>
            <p>
              Choose who can see or add to your project. Receipts and site photos stay private.
              Export your records whenever you need them.
            </p>
          </div>
          <Link className="btn secondary" to="/register">
            Create your account <ArrowUpRight size={16} />
          </Link>
        </section>
        <section className="landing-section faq" id="faq">
          <div>
            <span className="eyebrow">A FEW THINGS YOU MIGHT WONDER</span>
            <h2>
              Good questions.
              <br />
              Clear answers.
            </h2>
          </div>
          <div>
            {[
              [
                'Does GharKhata make payments?',
                'No. GharKhata records bills and payments you have made elsewhere. It never moves money or asks you to connect your bank.',
              ],
              [
                'Can my family help maintain the records?',
                'Yes. Invite people to your project and give them an owner, manager, contributor or viewer role. Access can be revoked by the owner.',
              ],
              [
                'Can I use it for a renovation?',
                'Absolutely. Choose renovation when creating a project. The same bills, payments and progress tools work for both.',
              ],
              [
                'Can I take my data with me?',
                'Yes. Download CSV reports, export project records, and print reports or save them as PDFs from your browser.',
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span>+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <p>Ghar banane ka har kharcha, ek jagah.</p>
        <span>Made for the journey home.</span>
      </footer>
    </div>
  );
}
export function AuthPage({
  mode,
  onSession,
}: {
  mode: 'login' | 'register' | 'forgot' | 'reset';
  onSession: (s: any) => void;
}) {
  const { t, toast, lang, setLang } = useUi();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [message, setMessage] = useState('');
  const schema = z.object({
    email: mode === 'reset' ? z.string() : z.email('Enter a valid email address'),
    password: ['forgot'].includes(mode)
      ? z.string()
      : z.string().min(10, 'Use at least 10 characters').max(72),
    name: mode === 'register' ? z.string().trim().min(1, 'Enter your name') : z.string(),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', name: '' },
  });
  const title =
    mode === 'register'
      ? 'Your home’s story starts here.'
      : mode === 'forgot'
        ? 'Let’s get you back in.'
        : mode === 'reset'
          ? 'A fresh start.'
          : 'Welcome home.';
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Brand light />
        <div>
          <span className="eyebrow">EVERY RUPEE. EVERY LITTLE MILESTONE.</span>
          <h1>
            A home takes heart.
            <br />
            The hisaab can
            <br />
            be simple.
          </h1>
          <House className="auth-house" />
        </div>
        <p>Ghar banane ka har kharcha, ek jagah.</p>
      </aside>
      <main className="auth-main">
        <Link to="/" className="auth-back">
          ← Back to GharKhata
        </Link>
        <div className="auth-card">
          <span className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</span>
          <h1>{title}</h1>
          <p className="muted">
            {mode === 'register'
              ? 'Your bills, payments and building memories, together.'
              : mode === 'login'
                ? 'Sign in to pick up where you left off.'
                : 'Choose a secure password for your account.'}
          </p>
          <form
            onSubmit={handleSubmit(async (v) => {
              setBusy(true);
              try {
                if (mode === 'forgot') {
                  const r = await post('/auth/forgot-password', { email: v.email });
                  setMessage(r.message);
                  setPreview(r.developmentPreview);
                } else if (mode === 'reset') {
                  await post('/auth/reset-password', {
                    token: params.get('token'),
                    password: v.password,
                  });
                  toast('Password updated. Sign in with your new password.');
                  navigate('/login');
                } else {
                  const session = await post(`/auth/${mode}`, { ...v, language: lang });
                  onSession(session);
                  const next = params.get('next');
                  navigate(next?.startsWith('/') && !next.startsWith('//') ? next : '/app');
                }
              } catch (e) {
                toast((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            })}
          >
            {mode === 'register' && (
              <label className="field">
                {t('name')}
                <input
                  autoComplete="name"
                  placeholder="What should we call you?"
                  {...register('name')}
                />
                {errors.name && <span className="field-error">{errors.name.message}</span>}
              </label>
            )}
            {mode !== 'reset' && (
              <label className="field">
                {t('email')}
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...register('email')}
                />
                {errors.email && <span className="field-error">{errors.email.message}</span>}
              </label>
            )}
            {mode !== 'forgot' && (
              <label className="field">
                {t('password')}
                <input
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="At least 10 characters"
                  {...register('password')}
                />
                {errors.password && <span className="field-error">{errors.password.message}</span>}
              </label>
            )}
            {mode === 'register' && (
              <label className="field">
                {t('language')}
                <select value={lang} onChange={(e) => setLang(e.target.value)}>
                  <option value="en">English</option>
                  <option value="hi">हिन्दी</option>
                </select>
              </label>
            )}
            {mode === 'login' && (
              <Link className="forgot-link" to="/forgot-password">
                {t('forgot')}
              </Link>
            )}
            <Submit
              pending={busy}
              label={
                mode === 'register' ? t('signUp') : mode === 'login' ? t('signIn') : t('reset')
              }
            />
          </form>
          {message && <p className="notice">{message}</p>}
          {preview && (
            <div className="dev-preview">
              <strong>Development email preview</strong>
              <p>{preview.note}</p>
              <Link to={preview.url.replace(new URL(preview.url).origin, '')}>
                Open reset link →
              </Link>
            </div>
          )}
          {mode === 'login' ? (
            <p className="auth-switch">
              New here? <Link to="/register">Create your account</Link>
            </p>
          ) : mode === 'register' ? (
            <p className="auth-switch">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          ) : (
            <p className="auth-switch">
              <Link to="/login">Back to sign in</Link>
            </p>
          )}
          <div className="auth-privacy">
            <ShieldCheck size={16} />
            Your home’s information stays private.
          </div>
        </div>
      </main>
    </div>
  );
}
