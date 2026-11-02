import { ArrowRightLeft, Hammer, ReceiptText, ShoppingBag, Warehouse, type LucideIcon } from 'lucide-react';
import ConnectionStatus from '../components/ConnectionStatus';
import { useAuth } from '../features/auth/useAuth';
import { ROLE_LABELS, type Role } from '../types/auth';

interface PlannedCard {
  icon: LucideIcon;
  title: string;
  text: string;
}

/** Placeholders: each card becomes a real widget as the matching feature is built. */
const PLANNED: Record<Role, PlannedCard[]> = {
  OWNER: [
    { icon: Warehouse, title: 'Stock across locations', text: 'Every product at the workshop, store and showrooms.' },
    { icon: ReceiptText, title: 'Payments to verify', text: 'Receipts waiting for your approval, with overdue alerts.' },
    { icon: ShoppingBag, title: 'Sales by salesperson', text: 'Who is selling what, and where.' },
  ],
  WORKSHOP_MANAGER: [
    { icon: Hammer, title: 'Record production', text: 'Add newly finished furniture to the workshop stock.' },
    { icon: ArrowRightLeft, title: 'Dispatch', text: 'Send items to the store or straight to a showroom.' },
  ],
  STORE_MANAGER: [
    { icon: ArrowRightLeft, title: 'Incoming transfers', text: 'Confirm what arrived from the workshop.' },
    { icon: Warehouse, title: 'Store stock', text: 'What you hold, ready to send to the showrooms.' },
  ],
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
        <p className="mt-2 text-zinc-400">You are signed in. The tools for your role will appear here as they are built.</p>
      </header>

      <ConnectionStatus />

      <section aria-label="Coming next">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">Coming next for your role</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PLANNED[user.role].map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-ink-900 p-5 transition hover:border-gold-500/30"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400 ring-1 ring-gold-500/25">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold text-zinc-100">{title}</h3>
              <p className="mt-1 text-sm text-zinc-500">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
