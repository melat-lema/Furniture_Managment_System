import { LoaderCircle, LogOut, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import { useAuth } from '../features/auth/useAuth';
import { cn } from '../lib/cn';
import { ROLE_LABELS, type AuthUser } from '../types/auth';
import { NAV_BY_ROLE } from './nav';

interface SidebarProps {
  user: AuthUser;
  signingOut: boolean;
  onNavigate: () => void;
  onLogout: () => void;
}

function Sidebar({ user, signingOut, onNavigate, onLogout }: SidebarProps) {
  const items = NAV_BY_ROLE[user.role];

  return (
    <div className="flex h-full flex-col border-r border-white/10 bg-ink-900">
      <div className="flex items-center gap-3 px-6 py-6">
        <BrandLogo variant="mark" className="h-10 w-auto" />
        <div className="leading-tight">
          <p className="font-display text-xl font-semibold text-gold-300">Gorgeous Furniture</p>
          <p className="text-xs text-zinc-500">Inventory &amp; Sales</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Main navigation">
        {items.map((item) =>
          item.soon ? (
            <div
              key={item.label}
              aria-disabled="true"
              className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600"
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Soon
              </span>
            </div>
          ) : (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.to === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-gold-500/10 text-gold-300 ring-1 ring-gold-500/30'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100',
                )
              }
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
            </NavLink>
          ),
        )}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-500/15 font-display text-lg font-semibold text-gold-300 ring-1 ring-gold-500/30">
            {user.fullName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-100">{user.fullName}</p>
            <p className="truncate text-xs text-zinc-500">
              {ROLE_LABELS[user.role]}
              {user.locationName ? ` · ${user.locationName}` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={signingOut}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-60"
        >
          {signingOut ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <LogOut className="h-4 w-4" aria-hidden="true" />
          )}
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Close the mobile menu with the Escape key.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  if (!user) return null; // RequireAuth guarantees a user; this only satisfies TypeScript.

  const handleLogout = () => {
    setSigningOut(true);
    void logout();
  };

  return (
    <div className="min-h-screen bg-ink-950">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 lg:block">
        <Sidebar user={user} signingOut={signingOut} onNavigate={() => undefined} onLogout={handleLogout} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/70"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">
            <Sidebar
              user={user}
              signingOut={signingOut}
              onNavigate={() => setDrawerOpen(false)}
              onLogout={handleLogout}
            />
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </aside>
        </div>
      )}

      <div className="lg:pl-72">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-ink-950/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-zinc-300 hover:bg-white/5"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          <BrandLogo variant="mark" className="h-8 w-auto" />
          <span className="font-display text-lg font-semibold text-gold-300">Gorgeous Furniture</span>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
