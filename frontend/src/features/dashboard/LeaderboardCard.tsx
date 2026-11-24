import { Trophy } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format';
import { useLeaderboard } from '../sales/useSales';

/** Who is selling how much. The showroom sees its own people; the owner sees everyone. */
export default function LeaderboardCard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'today' | 'month'>('month');
  const { data, isPending, error } = useLeaderboard(period);
  const isOwner = user?.role === 'OWNER';
  const top = (data ?? []).slice(0, 6);

  return (
    <section className="rounded-2xl border border-white/10 bg-ink-900 p-5" aria-label="Sales by salesperson">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500/10 text-gold-400 ring-1 ring-gold-500/25">
            <Trophy className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-zinc-100">Sales by salesperson</h2>
            <p className="text-xs text-zinc-500">Cancelled sales are not counted.</p>
          </div>
        </div>
        <div role="tablist" aria-label="Period" className="flex rounded-lg border border-white/10 p-0.5 text-xs">
          {(['today', 'month'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={period === value}
              onClick={() => setPeriod(value)}
              className={cn('rounded-md px-3 py-1.5 font-medium transition', period === value ? 'bg-gold-500/15 text-gold-300' : 'text-zinc-500 hover:text-zinc-300')}
            >
              {value === 'today' ? 'Today' : 'This month'}
            </button>
          ))}
        </div>
      </div>

      {isPending ? (
        <div className="h-28 animate-pulse rounded-xl bg-white/5" aria-busy="true" />
      ) : error || !data ? (
        <p role="alert" className="text-sm text-zinc-500">The numbers could not be loaded right now.</p>
      ) : top.length === 0 ? (
        <p className="text-sm text-zinc-500">No sales {period === 'today' ? 'today' : 'this month'} yet.</p>
      ) : (
        <ol className="divide-y divide-white/5">
          {top.map((row, index) => (
            <li key={row.salesperson.id} className="flex items-center gap-3 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-semibold text-zinc-400">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">{row.salesperson.fullName}</p>
                <p className="truncate text-xs text-zinc-500">
                  {isOwner && `${row.salesperson.showroom.name} · `}
                  {row.count} sale{row.count === 1 ? '' : 's'}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-gold-300">{formatMoney(row.total)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
