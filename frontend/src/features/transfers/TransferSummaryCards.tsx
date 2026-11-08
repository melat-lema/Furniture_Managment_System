import { ArrowRightLeft, ClipboardList, PackageCheck, TriangleAlert, Truck, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import type { Role } from '../../types/auth';
import { useTransferSummary } from './useTransfers';

interface Card {
  to: string;
  icon: LucideIcon;
  label: string;
  value: number;
  /** highlight when there is something to do */
  attention: boolean;
}

/** Small counters for the dashboard: what needs doing with transfers right now. */
export default function TransferSummaryCards({ role }: { role: Role }) {
  const { data } = useTransferSummary();
  if (!data) return null;

  const cards: Card[] = [];
  if (role === 'STORE_MANAGER' || role === 'SHOWROOM') {
    cards.push({
      to: '/transfers?status=IN_TRANSIT&direction=incoming',
      icon: PackageCheck,
      label: 'Waiting to be received',
      value: data.incomingWaiting,
      attention: data.incomingWaiting > 0,
    });
  }
  if (role === 'WORKSHOP_MANAGER' || role === 'STORE_MANAGER') {
    cards.push({
      to: '/transfers?status=DRAFT&direction=outgoing',
      icon: ClipboardList,
      label: 'Drafts to send',
      value: data.outgoingDrafts,
      attention: false,
    });
  }
  if (role === 'OWNER' || role === 'WORKSHOP_MANAGER' || role === 'STORE_MANAGER') {
    cards.push({
      to: '/transfers?status=IN_TRANSIT',
      icon: Truck,
      label: 'On the road now',
      value: data.inTransit,
      attention: false,
    });
  }
  if (role === 'OWNER' || role === 'WORKSHOP_MANAGER') {
    cards.push({
      to: '/transfers?status=RECEIVED_WITH_DISCREPANCY',
      icon: TriangleAlert,
      label: 'Differences, last 30 days',
      value: data.recentDiscrepancies,
      attention: data.recentDiscrepancies > 0,
    });
  }
  if (cards.length === 0) return null;

  return (
    <section aria-label="Transfers">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
        <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
        Transfers
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ to, icon: Icon, label, value, attention }) => (
          <Link
            key={label}
            to={to}
            className={cn(
              'rounded-2xl border bg-ink-900 p-5 transition hover:border-gold-500/40',
              attention ? 'border-amber-500/40' : 'border-white/10',
            )}
          >
            <span
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl ring-1',
                attention ? 'bg-amber-500/10 text-amber-300 ring-amber-500/30' : 'bg-gold-500/10 text-gold-400 ring-gold-500/25',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-4 font-display text-4xl font-semibold text-white">{value}</p>
            <p className="text-sm text-zinc-500">{label}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
