import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { formatDateTime } from '../../lib/format';
import { REASON_LABEL } from '../../lib/stock-labels';
import type { MovementRow, Paginated } from '../../types/api';

/** The owner's window into the company: the latest stock activity at every location. */
export default function RecentActivityCard() {
  const { data, isPending, error } = useQuery({
    queryKey: ['stock', 'recent'],
    queryFn: async () => (await api.get<Paginated<MovementRow>>('/stock/movements', { params: { pageSize: 8 } })).data,
    meta: { silent: true },
  });

  return (
    <section className="rounded-2xl border border-white/10 bg-ink-900 p-5" aria-label="Recent activity">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500/10 text-gold-400 ring-1 ring-gold-500/25">
            <Activity className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-zinc-100">Recent activity</h2>
            <p className="text-xs text-zinc-500">What is happening in the workshop, store and showrooms.</p>
          </div>
        </div>
        <Link to="/stock" className="inline-flex items-center gap-1 text-sm font-medium text-gold-300 hover:text-gold-200">
          See all <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {isPending ? (
        <div className="h-32 animate-pulse rounded-xl bg-white/5" aria-busy="true" />
      ) : error || !data ? (
        <p role="alert" className="text-sm text-zinc-500">Activity could not be loaded right now.</p>
      ) : data.items.length === 0 ? (
        <p className="text-sm text-zinc-500">Nothing yet. Activity appears here as soon as production is recorded.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {data.items.map((movement) => (
            <li key={movement.id} className="flex items-center justify-between gap-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-100">
                  {REASON_LABEL[movement.reason]}: {movement.product.name}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {movement.location.name} · {movement.createdBy.fullName} · {formatDateTime(movement.createdAt)}
                </p>
              </div>
              <span className={cn('shrink-0 font-semibold', movement.qtyChange > 0 ? 'text-emerald-300' : 'text-red-300')}>
                {movement.qtyChange > 0 ? `+${movement.qtyChange}` : movement.qtyChange}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
