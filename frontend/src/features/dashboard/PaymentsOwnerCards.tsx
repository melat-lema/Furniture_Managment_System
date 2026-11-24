import { Clock, ShieldCheck, Wallet, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format';
import { usePaymentsSummary } from '../payments/usePayments';

interface Card {
  to: string;
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  tone: 'normal' | 'attention' | 'alarm';
}

/** The owner's payments at a glance: what waits for him, what is late, what is confirmed. */
export default function PaymentsOwnerCards() {
  const { data } = usePaymentsSummary();
  if (!data) return null;

  const cards: Card[] = [
    {
      to: '/payments',
      icon: Wallet,
      label: 'Waiting for you',
      value: String(data.unverified.count),
      sub: `${formatMoney(data.unverified.amount)} to check`,
      tone: data.unverified.count > 0 ? 'attention' : 'normal',
    },
    {
      to: '/payments?overdue=1',
      icon: Clock,
      label: 'Overdue',
      value: String(data.overdue),
      sub: `waiting more than ${data.reminderHours} hours`,
      tone: data.overdue > 0 ? 'alarm' : 'normal',
    },
    {
      to: '/payments?status=VERIFIED',
      icon: ShieldCheck,
      label: 'Verified this month',
      value: formatMoney(data.verifiedThisMonth),
      sub: 'confirmed revenue',
      tone: 'normal',
    },
  ];

  return (
    <section aria-label="Payments">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
        <Wallet className="h-4 w-4" aria-hidden="true" />
        Payments
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ to, icon: Icon, label, value, sub, tone }) => (
          <Link
            key={label}
            to={to}
            className={cn(
              'rounded-2xl border bg-ink-900 p-5 transition hover:border-gold-500/40',
              tone === 'alarm' ? 'border-red-500/40' : tone === 'attention' ? 'border-amber-500/40' : 'border-white/10',
            )}
          >
            <span
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl ring-1',
                tone === 'alarm'
                  ? 'bg-red-500/10 text-red-300 ring-red-500/30'
                  : tone === 'attention'
                    ? 'bg-amber-500/10 text-amber-300 ring-amber-500/30'
                    : 'bg-gold-500/10 text-gold-400 ring-gold-500/25',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-4 text-sm text-zinc-500">{label}</p>
            <p className="font-display text-3xl font-semibold text-white">{value}</p>
            <p className="text-xs text-zinc-500">{sub}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
