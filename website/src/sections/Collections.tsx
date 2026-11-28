import { motion } from 'framer-motion';
import { ArrowUpRight, RefreshCw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import ProductTile from '../components/ProductTile';
import { Button } from '../components/ui/Button';
import Crown from '../components/ui/Crown';
import Reveal from '../components/ui/Reveal';
import SectionHeading from '../components/ui/SectionHeading';
import { useDebounced } from '../hooks/useDebounced';
import { useSite } from '../hooks/useSite';
import { publicApi } from '../lib/api';
import { demoProducts } from '../lib/fallback';
import type { ProductCard } from '../lib/types';

const PAGE_SIZE = 8;
type Sort = 'new' | 'price_asc' | 'price_desc';

/** Big picture tiles, one per collection. Tapping one filters the pieces below. */
function CategoryTiles({ onPick }: { onPick: (id: string) => void }) {
  const { data } = useSite();
  if (data.categories.length === 0) return null;

  return (
    <ul className="mt-14 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
      {data.categories.slice(0, 6).map((category, index) => (
        <li key={category.id}>
          <Reveal delay={(index % 3) * 0.08} y={40}>
            <button
              type="button"
              onClick={() => onPick(category.id)}
              className="group relative block aspect-[4/5] w-full overflow-hidden rounded-3xl border border-white/10 bg-ink-800 text-left sm:aspect-[5/4] lg:aspect-[4/5]"
            >
              {category.imageUrl ? (
                <img src={category.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-[900ms] group-hover:scale-110" />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_70%_20%,rgb(201_154_46/0.22),transparent),linear-gradient(160deg,#1a1a1d,#0a0a0b)]">
                  <Crown className="absolute right-6 top-6 h-12 w-12 text-gold-500/30 transition duration-500 group-hover:rotate-12 group-hover:text-gold-400/60" />
                </div>
              )}
              <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 sm:p-7">
                <div>
                  <h3 className="font-display text-3xl font-semibold text-white sm:text-4xl">{category.name}</h3>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gold-300">
                    {category.count} piece{category.count === 1 ? '' : 's'}
                  </p>
                </div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 text-white transition duration-300 group-hover:border-gold-400 group-hover:bg-gold-400 group-hover:text-ink-950">
                  <ArrowUpRight className="h-5 w-5 transition duration-300 group-hover:rotate-12" aria-hidden="true" />
                </span>
              </div>
            </button>
          </Reveal>
        </li>
      ))}
    </ul>
  );
}

function Skeletons() {
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true" aria-label="Loading pieces">
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index}>
          <div className="aspect-[4/5] animate-pulse rounded-3xl bg-white/5" />
          <div className="mt-4 h-6 w-2/3 animate-pulse rounded bg-white/5" />
        </li>
      ))}
    </ul>
  );
}

export default function Collections() {
  const { data, isDemo, loading } = useSite();
  const [category, setCategory] = useState('');
  const [searchText, setSearchText] = useState('');
  const search = useDebounced(searchText);
  const [sort, setSort] = useState<Sort>('new');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [items, setItems] = useState<ProductCard[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (loading) return; // wait until we know if the real catalog is reachable
    let cancelled = false;
    if (page === 1) setState('loading');

    const run = async () => {
      try {
        const result = isDemo
          ? demoProducts(category, search, page, PAGE_SIZE)
          : await publicApi.products({ category: category || undefined, search: search || undefined, sort, page, pageSize: PAGE_SIZE });
        if (cancelled) return;
        setItems((previous) => (page === 1 ? result.items : [...previous, ...result.items]));
        setTotal(result.total);
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loading, isDemo, category, search, sort, page, reload]);

  const choose = (id: string) => {
    setCategory(id);
    setPage(1);
  };
  const pickFromTile = (id: string) => {
    choose(id);
    document.getElementById('all-pieces')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const chips = [{ id: '', name: 'All' }, ...data.categories.map((item) => ({ id: item.id, name: item.name }))];
  const filtered = category !== '' || search !== '';

  return (
    <section id="collections" className="relative bg-ink-900 py-28 sm:py-36">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Collections"
          title={
            <>
              Pieces for every <span className="text-gold-gradient italic">room.</span>
            </>
          }
          text="Choose a collection, then take a closer look at the pieces. Come and sit in them at one of our showrooms."
        />

        <CategoryTiles onPick={pickFromTile} />

        {/* ------------------------------------------------------------ all pieces */}
        <div id="all-pieces" className="mt-28 scroll-mt-24">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div role="tablist" aria-label="Collections" className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.id || 'all'}
                  type="button"
                  role="tab"
                  aria-selected={category === chip.id}
                  onClick={() => choose(chip.id)}
                  className={`relative rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${category === chip.id ? 'text-ink-950' : 'text-zinc-400 hover:text-white'}`}
                >
                  {category === chip.id && <motion.span layoutId="chip-active" className="absolute inset-0 rounded-full bg-linear-to-r from-gold-300 to-gold-500" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                  <span className="relative">{chip.name}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="relative">
                <span className="sr-only">Search pieces</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                <input
                  type="search"
                  value={searchText}
                  onChange={(event) => {
                    setSearchText(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search pieces"
                  className="w-full rounded-full border border-white/10 bg-ink-800 py-3 pl-11 pr-5 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-gold-400/60 sm:w-64 sm:text-sm"
                />
              </label>
              {data.showPrices && (
                <label>
                  <span className="sr-only">Sort pieces</span>
                  <select
                    value={sort}
                    onChange={(event) => {
                      setSort(event.target.value as Sort);
                      setPage(1);
                    }}
                    className="rounded-full border border-white/10 bg-ink-800 px-5 py-3 text-base text-zinc-200 outline-none transition focus:border-gold-400/60 sm:text-sm [&>option]:bg-ink-900"
                  >
                    <option value="new">Newest first</option>
                    <option value="price_asc">Price: low to high</option>
                    <option value="price_desc">Price: high to low</option>
                  </select>
                </label>
              )}
            </div>
          </div>

          {import.meta.env.DEV && isDemo && !loading && (
            <p className="mt-6 rounded-2xl border border-dashed border-gold-500/30 px-5 py-3 text-xs text-gold-300/80">
              Showing demo pieces because the backend could not be reached. Start the backend and publish products to see your real catalog here.
            </p>
          )}

          <div className="mt-12" aria-live="polite">
            {state === 'loading' ? (
              <Skeletons />
            ) : state === 'error' ? (
              <div role="alert" className="flex flex-col items-center gap-5 rounded-3xl border border-white/10 px-6 py-20 text-center">
                <p className="max-w-sm text-zinc-400">We could not load the pieces right now. Please check your connection and try again.</p>
                <Button variant="ghost" icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />} onClick={() => setReload((value) => value + 1)}>
                  Try again
                </Button>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-5 rounded-3xl border border-white/10 px-6 py-20 text-center">
                <Crown className="h-8 w-8 text-gold-500/60" />
                <p className="max-w-sm text-zinc-400">{filtered ? 'No pieces match your search.' : 'New pieces are on their way. Please visit a showroom to see our latest work.'}</p>
                {filtered && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setCategory('');
                      setSearchText('');
                      setPage(1);
                    }}
                  >
                    Clear the search
                  </Button>
                )}
              </div>
            ) : (
              <>
                <ul key={`${category}-${search}-${sort}`} className="grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((product, index) => (
                    <ProductTile key={product.id} product={product} index={index} />
                  ))}
                </ul>
                {items.length < total && (
                  <div className="mt-16 flex justify-center">
                    <Button variant="ghost" onClick={() => setPage((value) => value + 1)}>
                      Show more pieces
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
