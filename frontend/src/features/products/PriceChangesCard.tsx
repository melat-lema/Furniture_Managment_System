import { ArrowRight, TrendingUp } from 'lucide-react';
import { formatDateTime, formatMoney } from '../../lib/format';
import { usePriceChanges } from './usePriceChanges';

/** Owner only: who changed which price recently. Keeps the owner in the loop without blocking anyone. */
export default function PriceChangesCard() {
  const { data, isPending, error } = usePriceChanges(true);

  return (
    <section className="rounded-2xl border border-white/10 bg-ink-900 p-5" aria-label="Recent price changes">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500/10 text-gold-400 ring-1 ring-gold-500/25">
          <TrendingUp className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-semibold text-zinc-100">Recent price changes</h2>
          <p className="text-xs text-zinc-500">The workshop can set prices, so you can see every change here.</p>
        </div>
      </div>

      {isPending ? (
        <div className="h-20 animate-pulse rounded-xl bg-white/5" aria-busy="true" />
      ) : error || !data ? (
        <p role="alert" className="text-sm text-zinc-500">Price changes could not be loaded right now.</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-zinc-500">No price changes yet.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {data.map((change) => (
            <li key={change.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-100">{change.name ?? 'A product'}</p>
                <p className="text-xs text-zinc-500">
                  {change.changedBy} · {formatDateTime(change.at)}
                </p>
              </div>
              <p className="flex items-center gap-2 text-zinc-400">
                {formatMoney(change.oldPrice)}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="font-semibold text-gold-300">{formatMoney(change.newPrice)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
