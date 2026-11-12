import { Armchair, ArrowRight, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import Badge from '../../components/ui/Badge';
import { canViewAllLocations } from '../../lib/permissions';
import { useAuth } from '../auth/useAuth';
import { useLowStock } from './useStock';

/** What is running low or out, so nobody discovers it in front of a customer. */
export default function LowStockCard() {
  const { user } = useAuth();
  const seesAll = canViewAllLocations(user?.role);
  const { data, isPending, error } = useLowStock();

  return (
    <section className="rounded-2xl border border-white/10 bg-ink-900 p-5" aria-label="Running low">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30">
            <TriangleAlert className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-zinc-100">Running low</h2>
            <p className="text-xs text-zinc-500">
              {data ? `${data.lowStockThreshold} or fewer left` : 'Items that need attention'}
              {seesAll ? ', in every location' : ''}
            </p>
          </div>
        </div>
        <Link to="/stock" className="inline-flex items-center gap-1 text-sm font-medium text-gold-300 hover:text-gold-200">
          Stock <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {isPending ? (
        <div className="h-32 animate-pulse rounded-xl bg-white/5" aria-busy="true" />
      ) : error || !data ? (
        <p role="alert" className="text-sm text-zinc-500">The low-stock list could not be loaded right now.</p>
      ) : data.items.length === 0 ? (
        <p className="text-sm text-zinc-500">Nothing is running low. 👍</p>
      ) : (
        <>
          <ul className="divide-y divide-white/5">
            {data.items.map((row) => (
              <li key={`${row.location.id}-${row.product.id}`} className="flex items-center gap-3 py-3">
                {row.product.imageUrl ? (
                  <img src={row.product.imageUrl} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-zinc-600">
                    <Armchair className="h-5 w-5" aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">{row.product.name}</p>
                  <p className="truncate text-xs text-zinc-500">{seesAll ? row.location.name : row.product.sku}</p>
                </div>
                {row.quantity === 0 ? <Badge tone="red">Out of stock</Badge> : <Badge tone="amber">{row.quantity} left</Badge>}
              </li>
            ))}
          </ul>
          {data.total > data.items.length && (
            <p className="mt-3 text-xs text-zinc-500">and {data.total - data.items.length} more</p>
          )}
        </>
      )}
    </section>
  );
}
