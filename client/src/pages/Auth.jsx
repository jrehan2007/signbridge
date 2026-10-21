import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { Field, PasswordInput, Spinner, cx } from '../components/ui.jsx';
import { Logo } from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { errMsg } from '../api/client.js';

const PERKS = [
  'Save your translation history across devices',
  'Track mastery as you practise ISL signs',
  'Choose your preferred speech language',
];

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="container-x py-10 lg:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-lift lg:grid-cols-2">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-ink to-teal-900 p-10 text-white lg:flex">
          <div className="bg-grid absolute inset-0 opacity-[.07] invert" aria-hidden="true" />
          <div className="relative"><Logo light /></div>
          <div className="relative">
            <h2 className="text-3xl font-bold leading-tight">Every gesture, understood.</h2>
            <p className="mt-3 text-white/70">An account keeps your progress in sync — your camera feed always stays on your device.</p>
            <ul className="mt-8 space-y-3">
              {PERKS.map((p) => <li key={p} className="flex items-start gap-3 text-sm text-white/90"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-100" /> {p}</li>)}
            </ul>
          </div>
          <p className="relative flex items-center gap-2 text-xs text-white/60"><ShieldCheck className="h-4 w-4" /> Passwords are hashed with bcrypt. Video is never uploaded.</p>
        </aside>
        <div className="p-6 sm:p-10 lg:p-12">
          <div className="mx-auto w-full max-w-sm animate-rise">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="mt-1.5 text-sm text-ink-mute">{subtitle}</p>
            <div className="mt-8">{children}</div>
            <p className="mt-8 text-center text-sm text-ink-mute">{footer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!EMAIL_RE.test(form.email)) v.email = 'Enter a valid email address';
    if (!form.password) v.password = 'Enter your password';
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      navigate(location.state?.from || (user.role === 'admin' ? '/admin' : '/translate'), { replace: true });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue translating and learning ISL." footer={<>Don’t have an account? <Link to="/register" className="link">Create one</Link></>}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Email address" error={errors.email}>
          <input className={cx('input', errors.email && 'input-error')} type="email" autoComplete="email" autoFocus placeholder="you@example.com" aria-invalid={Boolean(errors.email) || undefined}
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password" error={errors.password}>
          <PasswordInput autoComplete="current-password" placeholder="••••••••" invalid={Boolean(errors.password)}
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />} {busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </AuthShell>
  );
}

const ROLES = [
  { value: 'user', title: 'Translate', text: 'Use the live translator' },
  { value: 'learner', title: 'Learn ISL', text: 'Practise with feedback' },
];

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user', preferredLang: 'en' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Enter your full name';
    if (!EMAIL_RE.test(form.email)) e.email = 'Enter a valid email address';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) e.password = 'Use at least 8 characters with a letter and a number';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      await register(form);
      toast.success('Account created');
      navigate(form.role === 'learner' ? '/learn' : '/translate', { replace: true });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const pwChecks = [
    ['8+ characters', form.password.length >= 8],
    ['A letter', /[A-Za-z]/.test(form.password)],
    ['A number', /\d/.test(form.password)],
  ];

  return (
    <AuthShell title="Create your account" subtitle="Free forever · takes less than a minute." footer={<>Already have an account? <Link to="/login" className="link">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Full name" error={errors.name}>
          <input className={cx('input', errors.name && 'input-error')} autoComplete="name" autoFocus placeholder="Priya Sharma" value={form.name} onChange={set('name')} aria-invalid={Boolean(errors.name) || undefined} />
        </Field>
        <Field label="Email address" error={errors.email}>
          <input className={cx('input', errors.email && 'input-error')} type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={set('email')} aria-invalid={Boolean(errors.email) || undefined} />
        </Field>
        <Field label="Password" error={errors.password}>
          <PasswordInput autoComplete="new-password" placeholder="Create a password" value={form.password} onChange={set('password')} invalid={Boolean(errors.password)} />
          <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
            {pwChecks.map(([l, ok]) => (
              <span key={l} className={cx('flex items-center gap-1 text-xs transition-colors', ok ? 'text-moss-600' : 'text-ink-mute')}>
                <CheckCircle2 className={cx('h-3.5 w-3.5', !ok && 'opacity-40')} /> {l}
              </span>
            ))}
          </span>
        </Field>
        <fieldset>
          <legend className="label">I mainly want to</legend>
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map((r) => (
              <label key={r.value} className={cx('cursor-pointer rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-500', form.role === r.value ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500' : 'border-sand-300 hover:border-ink-mute')}>
                <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={set('role')} className="sr-only" />
                <span className="block text-sm font-semibold">{r.title}</span>
                <span className="block text-xs text-ink-mute">{r.text}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Voice language">
          <select className="input" value={form.preferredLang} onChange={set('preferredLang')}>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="ta">Tamil</option>
          </select>
        </Field>
        <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />} {busy ? 'Creating account…' : 'Create account'}</button>
      </form>
    </AuthShell>
  );
}
