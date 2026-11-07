import { Armchair, Package, Pencil, Search, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import ProductPicker, { type ProductOption } from '../components/ProductPicker';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Pagination from '../components/ui/Pagination';
import QueryError from '../components/ui/QueryError';
import { useAuth } from '../features/auth/useAuth';
import { useCategories } from '../features/categories/useCategories';
import { useLocations } from '../features/locations/useLocations';
import AdjustStockModal from '../features/stock/AdjustStockModal';
import { useStockLevels, useStockMovements, useStockOverview } from '../features/stock/useStock';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { cn } from '../lib/cn';
import { formatDateTime, formatMoney } from '../lib/format';
import { canViewAllLocations } from '../lib/permissions';
import { REASON_LABEL } from '../lib/stock-labels';
import type { MovementReason, StockLevelRow, StockProduct } from '../types/api';

const CONTROL =
  'rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-zinc-200 outline-none transition focus:border-gold-500/70 focus:ring-4 focus:ring-gold-500/15 [&>option]:bg-ink-900';


type Tab = 'overview' | 'location' | 'history';

function Thumb({ product }: { product: Pick<StockProduct, 'imageUrl' | 'name'> }) {
  return product.imageUrl ? (
    <img src={product.imageUrl} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
  ) : (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-zinc-600">
      <Armchair className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

function QuantityBadge({ quantity, threshold }: { quantity: number; threshold: number }) {
  if (quantity === 0) return <Badge tone="red">Out of stock</Badge>;
  if (quantity <= threshold) return <Badge tone="amber">Low: {quantity}</Badge>;
  return <span className="font-semibold text-zinc-100">{quantity}</span>;
}

function Skeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[0, 1, 2, 3, 4].map((n) => (
        <div key={n} className="h-14 animate-pulse rounded-2xl bg-white/5" />
      ))}
    </div>
  );
}

export default function StockPage() {
  const { user } = useAuth();
  const seesAll = canViewAllLocations(user?.role);
  const tabs: Array<{ id: Tab; label: string }> = seesAll
    ? [
        { id: 'overview', label: 'All locations' },
        { id: 'location', label: 'One location' },
        { id: 'history', label: 'History' },
      ]
    : [
        { id: 'location', label: 'Stock' },
        { id: 'history', label: 'History' },
      ];
  const [tab, setTab] = useState<Tab>(tabs[0].id);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Stock"
        description={seesAll ? 'What you have, and where.' : `What is at ${user?.locationName ?? 'your location'}.`}
      />

      <div role="tablist" aria-label="Stock views" className="flex gap-1 rounded-xl border border-white/10 bg-ink-900 p-1 sm:w-fit">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition',
              tab === item.id ? 'bg-gold-500/15 text-gold-300' : 'text-zinc-400 hover:text-zinc-200',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewView />}
      {tab === 'location' && <LocationView />}
      {tab === 'history' && <HistoryView />}
    </div>
  );
}

// ------------------------------------------------------------------ one location
function LocationView() {
  const { user } = useAuth();
  const role = user?.role;
  const isOwner = role === 'OWNER';
  const seesAll = canViewAllLocations(role);

  const { data: locations = [] } = useLocations();
  const { data: categories = [] } = useCategories();

  // The owner and workshop manager can look at any location (starting with their own);
  // everyone else is limited to their own.
  const ownLocation = user?.locationId ?? '';
  const [pickedLocation, setPickedLocation] = useState('');
  const defaultLocation = locations.find((l) => l.id === ownLocation)?.id ?? locations[0]?.id ?? '';
  const locationId = seesAll ? pickedLocation || defaultLocation : ownLocation;
  const locationName = seesAll ? (locations.find((l) => l.id === locationId)?.name ?? '') : (user?.locationName ?? '');

  // The owner may correct any location. The workshop and store managers only their own.
  const canAdjust = isOwner || (role === 'WORKSHOP_MANAGER' && locationId === ownLocation) || role === 'STORE_MANAGER';

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);
  const [adjusting, setAdjusting] = useState<StockLevelRow | null>(null);

  const { data, isPending, isFetching, error, refetch } = useStockLevels(
    { locationId: seesAll ? locationId : '', search: debounced, categoryId, lowOnly, page },
    !seesAll || locationId !== '',
  );

  const filtered = search !== '' || categoryId !== '' || lowOnly;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row">
        {seesAll && (
          <select
            aria-label="Location"
            value={locationId}
            onChange={(event) => {
              setPickedLocation(event.target.value);
              setPage(1);
            }}
            className={CONTROL}
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        )}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name or code"
            aria-label="Search stock"
            className={`${CONTROL} w-full pl-10`}
          />
        </div>
        <select
          aria-label="Filter by category"
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value);
            setPage(1);
          }}
          className={CONTROL}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(event) => {
              setLowOnly(event.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 accent-gold-500"
          />
          Low stock only
        </label>
      </div>

      {isPending && (seesAll ? locationId !== '' : true) ? (
        <Skeleton />
      ) : error && !data ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data && data.items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={filtered ? 'Nothing matches your filters' : 'No stock here yet'}
          text={filtered ? 'Try clearing the search or filters.' : 'Stock appears here once production is recorded or goods arrive.'}
        />
      ) : data ? (
        <div className={isFetching ? 'opacity-70 transition' : 'transition'}>
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-ink-900">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Product</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Category</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Price</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">In stock</th>
                  {canAdjust && <th scope="col" className="px-5 py-3.5 text-right font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.items.map((row) => (
                  <tr key={row.product.id}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Thumb product={row.product} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-zinc-100">{row.product.name}</p>
                          <p className="text-xs text-zinc-500">{row.product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-400">{row.product.category.name}</td>
                    <td className="px-5 py-3.5 text-zinc-400">{formatMoney(row.product.price)}</td>
                    <td className="px-5 py-3.5">
                      <QuantityBadge quantity={row.quantity} threshold={data.lowStockThreshold} />
                    </td>
                    {canAdjust && (
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />}
                          onClick={() => setAdjusting(row)}
                        >
                          Adjust
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </div>
        </div>
      ) : null}

      <AdjustStockModal
        open={adjusting !== null}
        onClose={() => setAdjusting(null)}
        row={adjusting}
        locationId={locationId}
        locationName={locationName}
        sendLocation={isOwner}
      />
    </div>
  );
}

// ------------------------------------------------------------------ owner: all locations
function OverviewView() {
  const { data: categories = [] } = useCategories();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);

  const { data, isPending, isFetching, error, refetch } = useStockOverview({ search: debounced, categoryId, page });
  const filtered = search !== '' || categoryId !== '';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name or code"
            aria-label="Search products"
            className={`${CONTROL} w-full pl-10`}
          />
        </div>
        <select
          aria-label="Filter by category"
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value);
            setPage(1);
          }}
          className={CONTROL}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {isPending ? (
        <Skeleton />
      ) : error && !data ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data && data.items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={filtered ? 'Nothing matches your filters' : 'No products yet'}
          text={filtered ? 'Try clearing the search or filter.' : 'Add products first, then record production.'}
        />
      ) : data ? (
        <div className={isFetching ? 'opacity-70 transition' : 'transition'}>
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-ink-900">
            <table className="w-full text-left text-sm" style={{ minWidth: `${28 + data.locations.length * 8}rem` }}>
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Product</th>
                  {data.locations.map((location) => (
                    <th key={location.id} scope="col" className="px-4 py-3.5 text-center font-semibold">
                      <span className="block normal-case tracking-normal text-zinc-300">{location.name}</span>
                      <span className="block text-[10px]">{location.type.toLowerCase()}</span>
                    </th>
                  ))}
                  <th scope="col" className="px-5 py-3.5 text-center font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.items.map((row) => (
                  <tr key={row.product.id}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Thumb product={row.product} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-zinc-100">{row.product.name}</p>
                          <p className="text-xs text-zinc-500">{row.product.sku}</p>
                        </div>
                      </div>
                    </td>
                    {data.locations.map((location) => {
                      const quantity = row.quantities[location.id] ?? 0;
                      return (
                        <td key={location.id} className="px-4 py-3.5 text-center">
                          {quantity === 0 ? (
                            <span className="text-zinc-700">-</span>
                          ) : quantity <= data.lowStockThreshold ? (
                            <span className="font-semibold text-amber-300">{quantity}</span>
                          ) : (
                            <span className="text-zinc-200">{quantity}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-5 py-3.5 text-center font-semibold text-gold-300">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-500">Amber numbers are low stock ({data.lowStockThreshold} or fewer).</p>
          <div className="mt-2">
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ history (the ledger)
function HistoryView() {
  const { user } = useAuth();
  const seesAll = canViewAllLocations(user?.role);
  const { data: locations = [] } = useLocations();

  const [locationId, setLocationId] = useState('');
  const [reason, setReason] = useState<MovementReason | ''>('');
  const [product, setProduct] = useState<ProductOption | null>(null);
  const [page, setPage] = useState(1);

  const { data, isPending, isFetching, error, refetch } = useStockMovements({
    locationId: seesAll ? locationId : '',
    productId: product?.id ?? '',
    reason,
    page,
  });
  const filtered = locationId !== '' || reason !== '' || product !== null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        {seesAll && (
          <select
            aria-label="Filter by location"
            value={locationId}
            onChange={(event) => {
              setLocationId(event.target.value);
              setPage(1);
            }}
            className={CONTROL}
          >
            <option value="">All locations</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Filter by type"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value as MovementReason | '');
            setPage(1);
          }}
          className={CONTROL}
        >
          <option value="">All types</option>
          {(Object.keys(REASON_LABEL) as MovementReason[]).map((value) => (
            <option key={value} value={value}>
              {REASON_LABEL[value]}
            </option>
          ))}
        </select>
        <div className="min-w-0 flex-1 lg:max-w-sm">
          <ProductPicker
            value={product}
            onChange={(next) => {
              setProduct(next);
              setPage(1);
            }}
            placeholder="Filter by product"
          />
        </div>
        {filtered && (
          <Button
            variant="ghost"
            icon={<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}
            onClick={() => {
              setLocationId('');
              setReason('');
              setProduct(null);
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {isPending ? (
        <Skeleton />
      ) : error && !data ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data && data.items.length === 0 ? (
        <EmptyState icon={Package} title="No movements yet" text="Every change to stock is recorded here." />
      ) : data ? (
        <div className={isFetching ? 'opacity-70 transition' : 'transition'}>
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-ink-900">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-semibold">When</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Product</th>
                  {seesAll && <th scope="col" className="px-5 py-3.5 font-semibold">Location</th>}
                  <th scope="col" className="px-5 py-3.5 font-semibold">Change</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Type</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Note</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.items.map((movement) => (
                  <tr key={movement.id}>
                    <td className="whitespace-nowrap px-5 py-3.5 text-zinc-500">{formatDateTime(movement.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-zinc-100">{movement.product.name}</p>
                      <p className="text-xs text-zinc-500">{movement.product.sku}</p>
                    </td>
                    {seesAll && <td className="px-5 py-3.5 text-zinc-400">{movement.location.name}</td>}
                    <td className={cn('px-5 py-3.5 font-semibold', movement.qtyChange > 0 ? 'text-emerald-300' : 'text-red-300')}>
                      {movement.qtyChange > 0 ? `+${movement.qtyChange}` : movement.qtyChange}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={movement.reason === 'PRODUCTION' ? 'gold' : 'zinc'}>{REASON_LABEL[movement.reason]}</Badge>
                    </td>
                    <td className="max-w-[16rem] truncate px-5 py-3.5 text-zinc-500" title={movement.note ?? undefined}>
                      {movement.note ?? ''}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-400">{movement.createdBy.fullName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
