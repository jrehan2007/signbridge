import { useEffect, useId, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Info, Loader2, X, XCircle } from 'lucide-react';

export const cx = (...c) => c.filter(Boolean).join(' ');

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={cx('animate-spin text-teal-600', className)} aria-hidden="true" />;
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-ink-mute" role="status">
      <Spinner className="h-7 w-7" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-sand-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="animate-rise">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-mute sm:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  teal: 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/15',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  moss: 'bg-moss-50 text-moss-600 ring-1 ring-inset ring-moss-600/20',
  rust: 'bg-rust-50 text-rust-600 ring-1 ring-inset ring-rust-600/15',
  sand: 'bg-sand-100 text-ink-soft ring-1 ring-inset ring-sand-300/60',
  dark: 'bg-ink text-white',
};
const ICON_TONES = {
  teal: 'bg-teal-50 text-teal-600', amber: 'bg-amber-50 text-amber-600', moss: 'bg-moss-50 text-moss-600',
  rust: 'bg-rust-50 text-rust-600', sand: 'bg-sand-100 text-ink-soft', dark: 'bg-ink text-white',
};

export function Badge({ tone = 'sand', children, className }) {
  return <span className={cx('chip', TONES[tone], className)}>{children}</span>;
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'teal' }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink-mute">{label}</span>
        {Icon && <span className={cx('rounded-lg p-2', ICON_TONES[tone])}><Icon className="h-4 w-4" /></span>}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{value}</div>
      {hint && <div className="mt-1 truncate text-xs text-ink-mute" title={typeof hint === 'string' ? hint : undefined}>{hint}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      {Icon && <div className="mb-4 rounded-full bg-sand-100 p-3.5 text-ink-mute ring-8 ring-sand-50"><Icon className="h-6 w-6" /></div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {children && <p className="mt-1.5 max-w-md text-sm text-ink-mute">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

const ALERT = {
  info: { cls: 'border-teal-100 bg-teal-50 text-teal-900', icon: Info, iconCls: 'text-teal-600' },
  warning: { cls: 'border-amber-100 bg-amber-50 text-amber-900', icon: AlertTriangle, iconCls: 'text-amber-600' },
  error: { cls: 'border-rust-50 bg-rust-50 text-rust-600', icon: XCircle, iconCls: 'text-rust-600' },
  success: { cls: 'border-moss-50 bg-moss-50 text-moss-600', icon: CheckCircle2, iconCls: 'text-moss-600' },
};

export function Alert({ tone = 'info', title, children, action, className }) {
  const { cls, icon: Icon, iconCls } = ALERT[tone];
  return (
    <div className={cx('flex flex-col gap-3 rounded-xl border p-4 text-sm sm:flex-row sm:items-start', cls, className)} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon className={cx('h-5 w-5 shrink-0', iconCls)} aria-hidden="true" />
      <div className="flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Segmented control used for tabs and filters */
export function Tabs({ items, value, onChange, label, className }) {
  return (
    <div className={cx('segmented', className)} role="tablist" aria-label={label}>
      {items.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)}
          className={cx('segmented-item', value === t.key && 'segmented-item-active')}>
          {t.icon && <t.icon className="h-4 w-4" />}{t.label}
        </button>
      ))}
    </div>
  );
}

export function ConfidenceBar({ value = 0, threshold, neutral = false }) {
  const pctVal = Math.round(value * 100);
  const tone = neutral ? 'bg-teal-500' : value >= (threshold ?? 0.8) ? 'bg-moss-500' : value >= 0.5 ? 'bg-amber-500' : 'bg-rust-500';
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-sand-200" role="meter" aria-valuenow={pctVal} aria-valuemin={0} aria-valuemax={100} aria-label="Confidence">
      <div className={cx('h-full rounded-full transition-[width] duration-150', tone)} style={{ width: `${pctVal}%` }} />
      {threshold !== undefined && <div className="absolute top-0 h-full w-0.5 bg-ink/40" style={{ left: `${threshold * 100}%` }} />}
    </div>
  );
}

export function Modal({ open, onClose, title, description, children, footer, size = 'max-w-lg' }) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 backdrop-blur-[2px] sm:items-center" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={cx('w-full animate-pop rounded-xl bg-white shadow-lift ring-1 ring-ink/5', size)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-mute">{description}</p>}
          </div>
          <button type="button" className="-mr-2 rounded-md p-1.5 text-ink-mute transition-colors hover:bg-sand-100 hover:text-ink" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 rounded-b-xl border-t border-sand-200 bg-sand-50 px-6 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, error, children, hint }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-ink-mute">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs font-medium text-rust-600" role="alert">{error}</span>}
    </label>
  );
}

/** Password input with a show/hide toggle */
export function PasswordInput({ className, invalid, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={cx('input pr-10', invalid && 'input-error', className)} aria-invalid={invalid || undefined} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-mute hover:text-ink"
        aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function Avatar({ name = '', className = 'h-8 w-8 text-xs' }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
  return <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full bg-teal-600 font-semibold text-white', className)} aria-hidden="true">{initials}</span>;
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-ink-mute sm:flex-row sm:items-center sm:justify-between">
      <span>Page <strong className="font-semibold text-ink">{meta.page}</strong> of {meta.pages} · {meta.total} records</span>
      <div className="flex gap-2">
        <button type="button" className="btn-outline btn-sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</button>
        <button type="button" className="btn-outline btn-sm" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>Next</button>
      </div>
    </div>
  );
}

export const pct = (v, d = 0) => `${((v || 0) * 100).toFixed(d)}%`;
export const fmtDate = (d) => new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
