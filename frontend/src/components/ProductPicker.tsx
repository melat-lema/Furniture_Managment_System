import { useQuery } from '@tanstack/react-query';
import { Armchair, CircleAlert, LoaderCircle, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import type { Paginated, ProductRecord, StockLevelsPage } from '../types/api';

export interface ProductOption {
  id: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  /** only set when the picker lists stock of one location */
  available?: number;
}

interface ProductPickerProps {
  value: ProductOption | null;
  onChange: (product: ProductOption | null) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  /** When set, only products that are in stock at this location are listed, with how many. */
  stockLocationId?: string;
}

function Thumb({ url }: { url: string | null }) {
  return url ? (
    <img src={url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-zinc-600">
      <Armchair className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

/** Type to search the catalog, then pick a product. Works with the keyboard (arrows and Enter). */
export default function ProductPicker({
  value,
  onChange,
  label,
  error,
  disabled,
  placeholder = 'Search by name or code',
  stockLocationId,
}: ProductPickerProps) {
  const id = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const debounced = useDebouncedValue(query, 250);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['product-picker', stockLocationId ?? 'catalog', debounced],
    enabled: open && !value,
    queryFn: async (): Promise<Array<ProductOption & { category: string }>> => {
      if (stockLocationId) {
        const { data: page } = await api.get<StockLevelsPage>('/stock/levels', {
          params: { locationId: stockLocationId, pageSize: 8, ...(debounced && { search: debounced }) },
        });
        return page.items.map((row) => ({
          id: row.product.id,
          name: row.product.name,
          sku: row.product.sku,
          imageUrl: row.product.imageUrl,
          available: row.quantity,
          category: row.product.category.name,
        }));
      }
      const { data: page } = await api.get<Paginated<ProductRecord>>('/products', {
        params: { pageSize: 8, isActive: true, ...(debounced && { search: debounced }) },
      });
      return page.items.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        imageUrl: product.imageUrl,
        category: product.category.name,
      }));
    },
    meta: { silent: true },
  });
  const results = data ?? [];

  // close the list when clicking elsewhere
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const choose = (product: ProductOption) => {
    onChange({ id: product.id, name: product.name, sku: product.sku, imageUrl: product.imageUrl, available: product.available });
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlight((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && open && results[highlight]) {
      event.preventDefault();
      choose(results[highlight]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapper} className="relative">
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-300">
          {label}
        </label>
      )}

      {value ? (
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl border bg-black/40 px-3 py-2',
            error ? 'border-red-500/60' : 'border-white/10',
          )}
        >
          <Thumb url={value.imageUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-100">{value.name}</p>
            <p className="truncate text-xs text-zinc-500">
              {value.sku}
              {value.available !== undefined && ` · ${value.available} in stock`}
            </p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label="Choose a different product"
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            className={cn(
              'flex items-center gap-2 rounded-xl border bg-black/40 px-3 transition focus-within:ring-4',
              error
                ? 'border-red-500/60 focus-within:ring-red-500/15'
                : 'border-white/10 focus-within:border-gold-500/70 focus-within:ring-gold-500/15',
            )}
          >
            <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
            <input
              id={id}
              role="combobox"
              aria-expanded={open}
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
              disabled={disabled}
              value={query}
              placeholder={placeholder}
              autoComplete="off"
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlight(0);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              className="w-full bg-transparent py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            />
            {isFetching && open && <LoaderCircle className="h-4 w-4 animate-spin text-zinc-500" aria-hidden="true" />}
          </div>

          {open && (
            <ul
              id={`${id}-list`}
              role="listbox"
              className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-white/10 bg-ink-800 p-1 shadow-2xl"
            >
              {isError ? (
                <li className="px-3 py-3 text-sm text-red-300">We could not load products. Try again.</li>
              ) : results.length === 0 && !isFetching ? (
                <li className="px-3 py-3 text-sm text-zinc-500">No products found.</li>
              ) : (
                results.map((product, index) => (
                  <li key={product.id} role="option" aria-selected={index === highlight}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => choose(product)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition',
                        index === highlight ? 'bg-gold-500/10' : 'hover:bg-white/5',
                      )}
                    >
                      <Thumb url={product.imageUrl} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-zinc-100">{product.name}</span>
                        <span className="block truncate text-xs text-zinc-500">
                          {product.sku} · {product.category}
                        </span>
                      </span>
                      {product.available !== undefined && (
                        <span className="ml-auto shrink-0 text-xs font-semibold text-gold-300">{product.available} in stock</span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm text-red-400">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
