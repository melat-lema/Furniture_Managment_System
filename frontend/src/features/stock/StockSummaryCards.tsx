import { Armchair, Hammer, Store, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import Badge from '../../components/ui/Badge';
import type { LocationType } from '../../types/auth';
import { useStockSummary } from './useStock';

const ICON: Record<LocationType, LucideIcon> = { WORKSHOP: Hammer, STORE: Store, SHOWROOM: Armchair };

/** Live stock numbers for the dashboard: the owner sees every location, everyone else their own. */
export default function StockSummaryCards() {
  const { data, isPending, error } = useStockSummary();

  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((n) => (
          <div key={n} className="h-36 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }
  if (error || !data) {
    return (
      <p role="alert" className="rounded-2xl border border-white/10 bg-ink-900 p-5 text-sm text-zinc-500">
        Stock numbers could not be loaded right now.
      </p>
    );
  }
  if (data.locations.length === 0) {
    return <p className="rounded-2xl border border-white/10 bg-ink-900 p-5 text-sm text-zinc-500">No locations to show yet.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {data.locations.map((location) => {
        const Icon = ICON[location.type];
        return (
          <Link
            key={location.id}
            to="/stock"
            className="group rounded-2xl border border-white/10 bg-ink-900 p-5 transition hover:border-gold-500/30"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400 ring-1 ring-gold-500/25">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              {location.lowStockCount > 0 && (
                <Badge tone="amber">
                  <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                  {location.lowStockCount} low
                </Badge>
              )}
            </div>
            <p className="mt-4 text-sm text-zinc-500">{location.name}</p>
            <p className="mt-0.5 font-display text-4xl font-semibold text-white">{location.totalItems}</p>
            <p className="text-sm text-zinc-500">
              items in stock · {location.productCount} product{location.productCount === 1 ? '' : 's'}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
