import { useState } from 'react';
import toast from 'react-hot-toast';
import { Volume2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSpeech } from '../hooks/useSpeech.js';
import { errMsg } from '../api/client.js';
import { Avatar, Badge, Field, PageHeader, PasswordInput, Spinner, fmtDate } from '../components/ui.jsx';

function Section({ title, description, children, footer, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-6 border-b border-sand-200 py-8 last:border-0 md:grid-cols-[1fr_2fr]">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-ink-mute">{description}</p>
      </div>
      <div className="card">
        <div className="space-y-5 p-6">{children}</div>
        <div className="flex justify-end rounded-b-xl border-t border-sand-200 bg-sand-50 px-6 py-3">{footer}</div>
      </div>
    </form>
  );
}

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState({ name: user.name, preferredLang: user.preferredLang });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState('');
  const { speak, supported } = useSpeech(form.preferredLang);
  const dirty = form.name !== user.name || form.preferredLang !== user.preferredLang;

  const save = async (e) => {
    e.preventDefault();
    setBusy('profile');
    try { await updateProfile(form); toast.success('Profile updated'); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(''); }
  };
  const changePw = async (e) => {
    e.preventDefault();
    setBusy('pw');
    try { await updateProfile(pw); toast.success('Password changed'); setPw({ currentPassword: '', newPassword: '' }); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(''); }
  };

  return (
    <div className="container-x max-w-5xl py-10">
      <PageHeader eyebrow="Account" title="Profile & settings" subtitle="Manage your personal details, speech preferences and password." />

      <div className="card mb-2 flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
        <Avatar name={user.name} className="h-14 w-14 text-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{user.name}</p>
          <p className="truncate text-sm text-ink-mute">{user.email}</p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Badge tone={user.role === 'admin' ? 'amber' : 'teal'} className="capitalize">{user.role}</Badge>
          {user.createdAt && <span className="text-xs text-ink-mute">Member since {fmtDate(user.createdAt).split(',')[0]}</span>}
        </div>
      </div>

      <Section title="Personal details" description="Your name is shown in the app. Email cannot be changed." onSubmit={save}
        footer={<button className="btn-primary" disabled={busy === 'profile' || !dirty || form.name.trim().length < 2}>{busy === 'profile' && <Spinner className="h-4 w-4 text-white" />} Save changes</button>}>
        <Field label="Full name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Email address"><input className="input" value={user.email} disabled /></Field>
        <Field label="Voice language" hint="Used for text-to-speech when a matching voice is installed on your device.">
          <div className="flex gap-2">
            <select className="input" value={form.preferredLang} onChange={(e) => setForm({ ...form, preferredLang: e.target.value })}>
              <option value="en">English</option><option value="hi">Hindi</option><option value="ta">Tamil</option>
            </select>
            <button type="button" className="btn-outline" disabled={!supported} onClick={() => speak('Hello, welcome to SignBridge')}><Volume2 className="h-4 w-4" /> Test</button>
          </div>
        </Field>
      </Section>

      <Section title="Password" description="Use at least 8 characters, including a letter and a number." onSubmit={changePw}
        footer={<button className="btn-primary" disabled={busy === 'pw' || !pw.currentPassword || !pw.newPassword}>{busy === 'pw' && <Spinner className="h-4 w-4 text-white" />} Update password</button>}>
        <Field label="Current password"><PasswordInput autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
        <Field label="New password"><PasswordInput autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
      </Section>
    </div>
  );
}
