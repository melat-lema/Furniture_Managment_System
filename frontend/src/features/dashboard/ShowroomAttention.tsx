import { ArrowRight, HandCoins, ShieldAlert, Wallet, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format';
import { usePayments, usePaymentsSummary } from '../payments/usePayments';
import { useSales } from '../sales/useSales';

function Card({
  title,
  hint,
  icon: Icon,
  hot,
  link,
  children,
}: {
  title: string;
  hint: string;
  icon: LucideIcon;
  hot: boolean;
  link: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('rounded-2xl border bg-ink-900 p-5', hot ? 'border-amber-500/40' : 'border-white/10')} aria-label={title}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg ring-1',
              hot ? 'bg-amber-500/10 text-amber-300 ring-amber-500/30' : 'bg-gold-500/10 text-gold-400 ring-gold-500/25',
            )}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-zinc-100">{title}</h2>
            <p className="text-xs text-zinc-500">{hint}</p>
          </div>
        </div>
        <Link to={link} className="inline-flex items-center gap-1 text-sm font-medium text-gold-300 hover:text-gold-200">
          All <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      {children}
    </section>
  );
}

/** What a showroom needs to act on: rejected payments, customers who still owe, payments waiting for the owner. */
export default function ShowroomAttention() {
  const { data: summary } = usePaymentsSummary();
  const rejected = usePayments({ status: 'REJECTED', method: '', overdue: false, locationId: '', search: '', page: 1 });
  const owing = useSales({ search: '', payment: 'UNPAID', locationId: '', page: 1 });

  // a rejected payment on a cancelled sale needs nothing from the showroom
  const toFix = (rejected.data?.items ?? []).filter((payment) => payment.sale.status === 'ACTIVE').slice(0, 5);
  const owingRows = (owing.data?.items ?? []).slice(0, 5);

  return (
    <div className="space-y-6">
      {summary && summary.unverified.count > 0 && (
        <p className="flex items-center gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-5 py-4 text-sm text-sky-100">
          <Wallet className="h-5 w-5 shrink-0" aria-hidden="true" />
          {summary.unverified.count} payment{summary.unverified.count === 1 ? ' is' : 's are'} waiting for the owner to check ({formatMoney(summary.unverified.amount)}).
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Payments to fix" hint="The owner rejected these. Record them again." icon={ShieldAlert} hot={toFix.length > 0} link="/sales?unpaid=1">
          {rejected.isPending ? (
            <div className="h-20 animate-pulse rounded-xl bg-white/5" aria-busy="true" />
          ) : toFix.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing was rejected. 👍</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {toFix.map((payment) => (
                <li key={payment.id}>
                  <Link to={`/sales/${payment.sale.id}`} className="block py-3 transition hover:text-gold-200">
                    <p className="text-sm font-semibold text-zinc-100">
                      {payment.sale.code} · {formatMoney(payment.amount)}
                    </p>
                    <p className="truncate text-xs text-red-300">{payment.rejectReason ?? 'Rejected'}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Customers who still owe" hint="Sales that are not fully paid." icon={HandCoins} hot={false} link="/sales?unpaid=1">
          {owing.isPending ? (
            <div className="h-20 animate-pulse rounded-xl bg-white/5" aria-busy="true" />
          ) : owingRows.length === 0 ? (
            <p className="text-sm text-zinc-500">Everyone has paid in full. 👍</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {owingRows.map((sale) => (
                <li key={sale.id}>
                  <Link to={`/sales/${sale.id}`} className="flex items-center justify-between gap-3 py-3 transition hover:text-gold-200">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-100">{sale.code}</p>
                      <p className="truncate text-xs text-zinc-500">{sale.customerName ?? 'No customer name'}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-amber-300">{formatMoney(sale.balance)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
