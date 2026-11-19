import { Receipt, ShoppingBag, Wallet, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format';
import { useSalesSummary } from '../sales/useSales';

interface Card {
  to: string;
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  attention?: boolean;
}

/** Today, this month, and what customers still owe. */
export default function SalesSummaryCards() {
  const { data } = useSalesSummary();
  if (!data) return null;

  const cards: Card[] = [
    {
      to: '/sales',
      icon: ShoppingBag,
      label: 'Sold today',
      value: formatMoney(data.today.total),
      sub: `${data.today.count} sale${data.today.count === 1 ? '' : 's'}`,
    },
    {
      to: '/sales',
      icon: Receipt,
      label: 'Sold this month',
      value: formatMoney(data.month.total),
      sub: `${data.month.count} sale${data.month.count === 1 ? '' : 's'}`,
    },
    {
      to: '/sales?unpaid=1',
      icon: Wallet,
      label: 'Still to be paid',
      value: formatMoney(data.unpaid.balance),
      sub: `${data.unpaid.count} sale${data.unpaid.count === 1 ? '' : 's'} not fully paid`,
      attention: data.unpaid.count > 0,
    },
  ];

  return (
    <section aria-label="Sales">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
        <ShoppingBag className="h-4 w-4" aria-hidden="true" />
        Sales
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ to, icon: Icon, label, value, sub, attention }) => (
          <Link
            key={label}
            to={to}
            className={cn('rounded-2xl border bg-ink-900 p-5 transition hover:border-gold-500/40', attention ? 'border-amber-500/40' : 'border-white/10')}
          >
            <span
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl ring-1',
                attention ? 'bg-amber-500/10 text-amber-300 ring-amber-500/30' : 'bg-gold-500/10 text-gold-400 ring-gold-500/25',
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
