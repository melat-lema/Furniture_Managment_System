import { Armchair, Pencil, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Pagination from '../components/ui/Pagination';
import QueryError from '../components/ui/QueryError';
import { useAuth } from '../features/auth/useAuth';
import { useCategories } from '../features/categories/useCategories';
import ProductFormModal from '../features/products/ProductFormModal';
import { useProducts, type ProductFilters } from '../features/products/useProducts';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { formatMoney } from '../lib/format';
import type { ProductRecord } from '../types/api';

const CONTROL =
  'rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-zinc-200 outline-none transition focus:border-gold-500/70 focus:ring-4 focus:ring-gold-500/15 [&>option]:bg-ink-900';

export default function ProductsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'OWNER' || user?.role === 'WORKSHOP_MANAGER';

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isActive, setIsActive] = useState<ProductFilters['isActive']>('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const { data: categories = [] } = useCategories();
  const { data, isPending, isFetching, error, refetch } = useProducts({
    search: debouncedSearch,
    categoryId,
    isActive: canManage ? isActive : '',
    page,
  });

  const [editing, setEditing] = useState<ProductRecord | null | 'new'>(null);

  const filtered = search !== '' || categoryId !== '' || isActive !== '';
  const clearFilters = () => {
    setSearch('');
    setCategoryId('');
    setIsActive('');
    setPage(1);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Products"
        description={canManage ? 'Your catalog: details, photos and what shows on the website.' : 'The furniture catalog.'}
        actions={
          canManage && (
            <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setEditing('new')}>
              Add product
            </Button>
          )
        }
      />

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
            placeholder="Search by name, code or material"
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
        {canManage && (
          <select
            aria-label="Filter by status"
            value={isActive}
            onChange={(event) => {
              setIsActive(event.target.value as ProductFilters['isActive']);
              setPage(1);
            }}
            className={CONTROL}
          >
            <option value="">Active and inactive</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </select>
        )}
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-72 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : error && !data ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data && data.items.length === 0 ? (
        <EmptyState
          icon={Armchair}
          title={filtered ? 'No products match your search' : 'No products yet'}
          text={filtered ? 'Try a different search or clear the filters.' : canManage ? 'Add your first product.' : 'Products will appear here once the owner adds them.'}
          action={
            filtered ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : canManage ? (
              <Button onClick={() => setEditing('new')}>Add product</Button>
            ) : undefined
          }
        />
      ) : data ? (
        <div className={isFetching ? 'opacity-70 transition' : 'transition'}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((product) => (
              <article
                key={product.id}
                className={`group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-900 transition hover:border-gold-500/30 ${product.isActive ? '' : 'opacity-60'}`}
              >
                <div className="relative aspect-[4/3] bg-black/40">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Armchair className="h-12 w-12 text-zinc-700" aria-hidden="true" />
                    </div>
                  )}
                  <div className="absolute left-3 top-3 flex gap-1.5">
                    {product.isPublished && <Badge tone="blue">On website</Badge>}
                    {!product.isActive && <Badge tone="zinc">Inactive</Badge>}
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-gold-400/80">{product.category.name}</p>
                  <h2 className="mt-1 font-semibold text-zinc-100">{product.name}</h2>
                  <p className="mt-0.5 text-xs text-zinc-500">{product.sku}</p>
                  {(product.material || product.dimensions) && (
                    <p className="mt-2 text-sm text-zinc-500">{[product.material, product.dimensions].filter(Boolean).join(' · ')}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <p className="text-lg font-semibold text-gold-300">{formatMoney(product.price)}</p>
                    {canManage && (
                      <Button variant="secondary" size="sm" icon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setEditing(product)}>
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-4">
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </div>
        </div>
      ) : null}

      {canManage && (
        <ProductFormModal open={editing !== null} onClose={() => setEditing(null)} product={editing === 'new' ? null : editing} />
      )}
    </div>
  );
}
