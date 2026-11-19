import { ArrowRight, Plus, Receipt, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Pagination from '../components/ui/Pagination';
import QueryError from '../components/ui/QueryError';
import { useAuth } from '../features/auth/useAuth';
import { useLocations } from '../features/locations/useLocations';
import { SalePaymentBadge } from '../features/sales/PaymentBadges';
import { useSales, type SalesFilters } from '../features/sales/useSales';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { formatDateTime, formatMoney } from '../lib/format';

const CONTROL =
  'rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-base sm:text-sm text-zinc-200 outline-none transition focus:border-gold-500/70 focus:ring-4 focus:ring-gold-500/15 [&>option]:bg-ink-900';

export default function SalesPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const isOwner = user?.role === 'OWNER';

  const { data: locations = [] } = useLocations();
  const showrooms = locations.filter((location) => location.type === 'SHOWROOM');

  // The dashboard card links here with ?unpaid=1
  const [payment, setPayment] = useState<SalesFilters['payment']>(params.get('unpaid') === '1' ? 'UNPAID' : '');
  const [locationId, setLocationId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);

  const { data, isPending, isFetching, error, refetch } = useSales({ search: debounced, payment, locationId: isOwner ? locationId : '', page });
  const filtered = payment !== '' || locationId !== '' || search !== '';

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Sales"
        description={isOwner ? 'Every sale in every showroom.' : `Sales made at ${user?.locationName ?? 'your showroom'}.`}
        actions={
          user?.role === 'SHOWROOM' && (
            <Link to="/sales/new">
              <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />}>New sale</Button>
            </Link>
          )
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by sale code, customer name or phone"
            aria-label="Search sales"
            className={`${CONTROL} w-full pl-10`}
          />
        </div>
        <select
          aria-label="Filter by payment"
          value={payment}
          onChange={(event) => {
            setPayment(event.target.value as SalesFilters['payment']);
            setPage(1);
          }}
          className={CONTROL}
        >
          <option value="">Any payment status</option>
          <option value="UNPAID">Still to pay</option>
          <option value="PENDING">Unpaid</option>
          <option value="PARTIAL">Partly paid</option>
          <option value="PAID">Paid</option>
        </select>
        {isOwner && (
          <select
            aria-label="Filter by showroom"
            value={locationId}
            onChange={(event) => {
              setLocationId(event.target.value);
              setPage(1);
            }}
            className={CONTROL}
          >
            <option value="">All showrooms</option>
            {showrooms.map((showroom) => (
              <option key={showroom.id} value={showroom.id}>
                {showroom.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {isPending ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-16 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : error && !data ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data && data.items.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={filtered ? 'No sales match your filters' : 'No sales yet'}
          text={filtered ? 'Try clearing the filters.' : user?.role === 'SHOWROOM' ? 'Record your first sale.' : 'Sales appear here as showrooms record them.'}
          action={
            filtered ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setPayment('');
                  setLocationId('');
                  setSearch('');
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : user?.role === 'SHOWROOM' ? (
              <Link to="/sales/new">
                <Button>New sale</Button>
              </Link>
            ) : undefined
          }
        />
      ) : data ? (
        <div className={isFetching ? 'opacity-70 transition' : 'transition'}>
          {/* Phones: one card per sale */}
          <ul className="space-y-3 sm:hidden">
            {data.items.map((sale) => (
              <li key={sale.id}>
                <Link to={`/sales/${sale.id}`} className="block rounded-2xl border border-white/10 bg-ink-900 p-4 transition active:bg-white/[0.04]">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-gold-300">{sale.code}</span>
                    <SalePaymentBadge status={sale.paymentStatus} />
                  </div>
                  <p className="mt-2 text-lg font-semibold text-zinc-100">{formatMoney(sale.total)}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {isOwner && `${sale.location.name} · `}
                    {sale.salesperson.fullName} · {sale.customerName ?? 'No customer name'} · {formatDateTime(sale.soldAt)}
                  </p>
                  {Number(sale.balance) > 0 && <p className="mt-1 text-xs text-amber-300">Balance: {formatMoney(sale.balance)}</p>}
                </Link>
              </li>
            ))}
          </ul>

          {/* Tablets and computers: the table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-ink-900 sm:block">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Sale</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Date</th>
                  {isOwner && <th scope="col" className="px-5 py-3.5 font-semibold">Showroom</th>}
                  <th scope="col" className="px-5 py-3.5 font-semibold">Sold by</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Customer</th>
                  <th scope="col" className="px-5 py-3.5 text-right font-semibold">Total</th>
                  <th scope="col" className="px-5 py-3.5 text-right font-semibold">Balance</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Payment</th>
                  <th scope="col" className="px-5 py-3.5"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.items.map((sale) => (
                  <tr key={sale.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-5 py-4">
                      <Link to={`/sales/${sale.id}`} className="font-semibold text-gold-300 hover:text-gold-200">
                        {sale.code}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-zinc-500">{formatDateTime(sale.soldAt)}</td>
                    {isOwner && <td className="px-5 py-4 text-zinc-300">{sale.location.name}</td>}
                    <td className="px-5 py-4 text-zinc-300">{sale.salesperson.fullName}</td>
                    <td className="px-5 py-4 text-zinc-400">{sale.customerName ?? <span className="text-zinc-600">-</span>}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-medium text-zinc-100">{formatMoney(sale.total)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right text-zinc-400">{Number(sale.balance) > 0 ? formatMoney(sale.balance) : '-'}</td>
                    <td className="px-5 py-4">
                      <SalePaymentBadge status={sale.paymentStatus} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link to={`/sales/${sale.id}`} aria-label={`Open ${sale.code}`} className="text-zinc-500 hover:text-gold-300">
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </td>
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
