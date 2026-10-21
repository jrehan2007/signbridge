import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, User as UserIcon, ShieldCheck, ChevronDown, History, GraduationCap, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar, cx } from './ui.jsx';

export function Logo({ className = '', light = false }) {
  return (
    <Link to="/" className={cx('flex items-center gap-2.5', className)} aria-label="SignBridge home">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className="leading-none">
        <span className={cx('block text-base font-bold tracking-tight', light ? 'text-white' : 'text-ink')}>SignBridge</span>
        <span className={cx('mt-0.5 block text-[11px] font-medium', light ? 'text-white/60' : 'text-ink-mute')}>ISL Translator</span>
      </span>
    </Link>
  );
}

const links = [
  { to: '/translate', label: 'Translate' },
  { to: '/dictionary', label: 'Dictionary' },
  { to: '/learn', label: 'Learn', auth: true },
  { to: '/history', label: 'History', auth: true },
  { to: '/admin', label: 'Admin', admin: true },
];

const TITLES = [
  ['/translate', 'Translate'], ['/dictionary', 'Dictionary'], ['/learn', 'Learn'], ['/history', 'History'],
  ['/profile', 'Profile'], ['/admin', 'Admin'], ['/login', 'Sign in'], ['/register', 'Create account'],
];

/** Resets scroll and updates the document title on navigation */
function useRouteEffects() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    const match = TITLES.find(([p]) => pathname.startsWith(p));
    document.title = match ? `${match[1]} · SignBridge` : 'SignBridge · Indian Sign Language Translator';
  }, [pathname]);
}

function UserMenu({ user, isAdmin, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const item = 'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink-soft transition-colors hover:bg-sand-100 hover:text-ink';
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-sand-100">
        <Avatar name={user.name} />
        <span className="max-w-[8rem] truncate text-sm font-medium text-ink">{user.name.split(' ')[0]}</span>
        <ChevronDown className={cx('h-4 w-4 text-ink-mute transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 origin-top-right animate-pop rounded-xl border border-sand-200 bg-white p-1.5 shadow-lift">
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <Avatar name={user.name} className="h-9 w-9 text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
              <p className="truncate text-xs text-ink-mute">{user.email}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-sand-200" />
          <Link role="menuitem" to="/profile" className={item}><UserIcon className="h-4 w-4" /> Profile & settings</Link>
          <Link role="menuitem" to="/learn" className={item}><GraduationCap className="h-4 w-4" /> My learning</Link>
          <Link role="menuitem" to="/history" className={item}><History className="h-4 w-4" /> Translation history</Link>
          {isAdmin && <Link role="menuitem" to="/admin" className={item}><ShieldCheck className="h-4 w-4" /> Admin console</Link>}
          <div className="my-1 h-px bg-sand-200" />
          <button role="menuitem" type="button" className={cx(item, 'hover:bg-rust-50 hover:text-rust-600')} onClick={onSignOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const visible = links.filter((l) => (!l.auth || user) && (!l.admin || isAdmin));
  useRouteEffects();
  useEffect(() => setOpen(false), [pathname]);

  const signOut = () => { logout(); navigate('/'); };

  const navCls = ({ isActive }) =>
    cx('relative rounded-md px-3 py-2 text-sm font-medium transition-colors',
      isActive ? 'text-teal-700 after:absolute after:inset-x-3 after:-bottom-[14px] after:h-0.5 after:rounded-full after:bg-teal-600' : 'text-ink-mute hover:text-ink');
  const mobileCls = ({ isActive }) =>
    cx('rounded-lg px-3 py-2.5 text-sm font-medium', isActive ? 'bg-teal-50 text-teal-700' : 'text-ink-soft hover:bg-sand-100');

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-lift">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-sand-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="container-x flex h-16 items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
              {visible.map((l) => <NavLink key={l.to} to={l.to} className={navCls}>{l.label}</NavLink>)}
            </nav>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            {user ? <UserMenu user={user} isAdmin={isAdmin} onSignOut={signOut} /> : (
              <>
                <Link to="/login" className="btn-ghost">Sign in</Link>
                <Link to="/register" className="btn-primary">Get started</Link>
              </>
            )}
          </div>
          <button type="button" className="btn-ghost -mr-2 px-2.5 md:hidden" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="border-t border-sand-200 bg-white md:hidden">
            <nav className="container-x flex flex-col gap-1 py-3" aria-label="Mobile">
              {user && (
                <div className="mb-2 flex items-center gap-3 rounded-lg bg-sand-50 px-3 py-3">
                  <Avatar name={user.name} className="h-9 w-9 text-sm" />
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-ink-mute">{user.email}</p></div>
                </div>
              )}
              {visible.map((l) => <NavLink key={l.to} to={l.to} className={mobileCls}>{l.label}</NavLink>)}
              {user ? (
                <>
                  <NavLink to="/profile" className={mobileCls}>Profile & settings</NavLink>
                  <button type="button" className="btn-outline mt-2" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</button>
                </>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Link to="/login" className="btn-outline">Sign in</Link>
                  <Link to="/register" className="btn-primary">Get started</Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-sand-200 bg-white">
        <div className="container-x grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-6 text-ink-mute">
              Real-time Indian Sign Language translation powered by on-device AI. Built to make everyday conversations more accessible.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-ink-soft">
              <Lock className="h-3.5 w-3.5 text-moss-600" /> Your video never leaves your device.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-ink-mute">
              <li><Link to="/translate" className="hover:text-ink">Live translator</Link></li>
              <li><Link to="/dictionary" className="hover:text-ink">Sign dictionary</Link></li>
              <li><Link to="/learn" className="hover:text-ink">Practice lessons</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Account</p>
            <ul className="mt-3 space-y-2 text-sm text-ink-mute">
              {user ? (
                <>
                  <li><Link to="/profile" className="hover:text-ink">Profile & settings</Link></li>
                  <li><Link to="/history" className="hover:text-ink">Translation history</Link></li>
                </>
              ) : (
                <>
                  <li><Link to="/login" className="hover:text-ink">Sign in</Link></li>
                  <li><Link to="/register" className="hover:text-ink">Create account</Link></li>
                </>
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-sand-200">
          <div className="container-x flex flex-col gap-2 py-5 text-xs text-ink-mute sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} SignBridge. All rights reserved.</p>
            <p>MediaPipe Hands · TensorFlow.js · MERN</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
