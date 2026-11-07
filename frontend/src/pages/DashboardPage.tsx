import { ArrowRightLeft, Hammer, Package, ReceiptText, ShoppingBag, Warehouse, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import ConnectionStatus from '../components/ConnectionStatus';
import { useAuth } from '../features/auth/useAuth';
import PriceChangesCard from '../features/products/PriceChangesCard';
import RecentActivityCard from '../features/stock/RecentActivityCard';
import StockSummaryCards from '../features/stock/StockSummaryCards';
import { ROLE_LABELS, type Role } from '../types/auth';

interface Shortcut {
  to: string;
  label: string;
  icon: LucideIcon;
}

const SHORTCUTS: Record<Role, Shortcut[]> = {
  OWNER: [
    { to: '/stock', label: 'Stock', icon: Warehouse },
    { to: '/products', label: 'Products', icon: Package },
  ],
  WORKSHOP_MANAGER: [
    { to: '/production', label: 'Record production', icon: Hammer },
    { to: '/products', label: 'Products', icon: Package },
    { to: '/stock', label: 'Stock', icon: Warehouse },
  ],
  STORE_MANAGER: [{ to: '/stock', label: 'Stock', icon: Warehouse }],
  SHOWROOM: [{ to: '/stock', label: 'Stock', icon: Warehouse }],
};

interface PlannedCard {
  icon: LucideIcon;
  title: string;
  text: string;
}

/** Placeholders for what is still to come. Each card disappears when the feature is built. */
const PLANNED: Record<Role, PlannedCard[]> = {
  OWNER: [
    { icon: ArrowRightLeft, title: 'Transfers', text: 'Follow goods moving between the workshop, store and showrooms.' },
    { icon: ReceiptText, title: 'Payments to verify', text: 'Receipts waiting for your approval, with overdue alerts.' },
    { icon: ShoppingBag, title: 'Sales by salesperson', text: 'Who is selling what, and where.' },
  ],
  WORKSHOP_MANAGER: [{ icon: ArrowRightLeft, title: 'Dispatch', text: 'Send items to the store or straight to a showroom.' }],
  STORE_MANAGER: [{ icon: ArrowRightLeft, title: 'Incoming transfers', text: 'Confirm what arrived from the workshop.' }],
  SHOWROOM: [
    { icon: ShoppingBag, title: 'New sale', text: 'Record a sale, pick the salesperson and upload the receipt.' },
    { icon: ArrowRightLeft, title: 'Incoming transfers', text: 'Confirm deliveries to your showroom.' },
  ],
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-8 animate-fade-up">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-400/80">
          {ROLE_LABELS[user.role]}
          {user.locationName ? ` · ${user.locationName}` : ''}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-white sm:text-5xl">
          {greeting()}, {user.fullName.split(' ')[0]}
        </h1>
        <div className="mt-5 flex flex-wrap gap-3">
          {SHORTCUTS[user.role].map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-ink-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-gold-500/40 hover:text-gold-300"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      </header>

      <section aria-label="Stock">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">Stock right now</h2>
        <StockSummaryCards />
      </section>

      {user.role === 'OWNER' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <RecentActivityCard />
          <PriceChangesCard />
        </div>
      )}

      <ConnectionStatus />

      <section aria-label="Coming next">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">Coming next</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PLANNED[user.role].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-dashed border-white/10 p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-zinc-500">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold text-zinc-300">{title}</h3>
              <p className="mt-1 text-sm text-zinc-500">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
