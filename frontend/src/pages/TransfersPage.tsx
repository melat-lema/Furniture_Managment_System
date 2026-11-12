import { ArrowRight, ArrowRightLeft, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Pagination from '../components/ui/Pagination';
import QueryError from '../components/ui/QueryError';
import { useAuth } from '../features/auth/useAuth';
import StatusLegend from '../features/transfers/StatusLegend';
import TransferStatusBadge, { TRANSFER_STATUS_LABEL } from '../features/transfers/TransferStatusBadge';
import { useTransfers, type TransferFilters } from '../features/transfers/useTransfers';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { formatDateTime } from '../lib/format';
import type { TransferListRow, TransferStatus } from '../types/api';

const CONTROL =
  'rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-base sm:text-sm text-zinc-200 outline-none transition focus:border-gold-500/70 focus:ring-4 focus:ring-gold-500/15 [&>option]:bg-ink-900';

const STATUSES = Object.keys(TRANSFER_STATUS_LABEL) as TransferStatus[];

export default function TransfersPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const canCreate = user?.role === 'WORKSHOP_MANAGER' || user?.role === 'STORE_MANAGER';
  const hasLocation = Boolean(user?.locationId);

  // The dashboard cards link here with ?status=...&direction=...
  const initialStatus = params.get('status');
  const initialDirection = params.get('direction');
  const [status, setStatus] = useState<TransferFilters['status']>(
    STATUSES.includes(initialStatus as TransferStatus) ? (initialStatus as TransferStatus) : '',
  );
  const [direction, setDirection] = useState<TransferFilters['direction']>(
    initialDirection === 'incoming' || initialDirection === 'outgoing' ? initialDirection : '',
  );
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);

  const { data, isPending, isFetching, error, refetch } = useTransfers({
    status,
    direction: hasLocation ? direction : '',
    search: debounced,
    page,
  });
  const filtered = status !== '' || direction !== '' || search !== '';

  /** An incoming transfer that this person has to confirm */
  const needsMe = (transfer: TransferListRow): boolean =>
    transfer.status === 'IN_TRANSIT' &&
    transfer.toLocation.id === user?.locationId &&
    (user?.role === 'STORE_MANAGER' || user?.role === 'SHOWROOM');

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Transfers"
        description="Goods moving between the workshop, the store and the showrooms."
        actions={
          canCreate && (
            <Link to="/transfers/new">
              <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />}>New transfer</Button>
            </Link>
          )
        }
      />

      {user && <StatusLegend role={user.role} />}

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
            placeholder="Search by transfer code"
            aria-label="Search transfers"
            className={`${CONTROL} w-full pl-10`}
          />
        </div>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as TransferFilters['status']);
            setPage(1);
          }}
          className={CONTROL}
        >
          <option value="">Any status</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {TRANSFER_STATUS_LABEL[value]}
            </option>
          ))}
        </select>
        {hasLocation && (
          <select
            aria-label="Filter by direction"
            value={direction}
            onChange={(event) => {
              setDirection(event.target.value as TransferFilters['direction']);
              setPage(1);
            }}
            className={CONTROL}
          >
            <option value="">Incoming and outgoing</option>
            <option value="incoming">Incoming to me</option>
            <option value="outgoing">Outgoing from me</option>
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
          icon={ArrowRightLeft}
          title={filtered ? 'No transfers match your filters' : 'No transfers yet'}
          text={filtered ? 'Try clearing the filters.' : canCreate ? 'Create one to move goods to the store or a showroom.' : 'Transfers that involve you will appear here.'}
          action={
            filtered ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setStatus('');
                  setDirection('');
                  setSearch('');
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : data ? (
        <div className={isFetching ? 'opacity-70 transition' : 'transition'}>
          {/* Phones: one card per transfer */}
          <ul className="space-y-3 sm:hidden">
            {data.items.map((transfer) => (
              <li key={transfer.id}>
                <Link
                  to={`/transfers/${transfer.id}`}
                  className="block rounded-2xl border border-white/10 bg-ink-900 p-4 transition active:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-gold-300">{transfer.code}</span>
                    <TransferStatusBadge status={transfer.status} />
                  </div>
                  <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-zinc-300">
                    {transfer.fromLocation.name}
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-600" aria-hidden="true" />
                    {transfer.toLocation.name}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {transfer.unitsSent} item{transfer.unitsSent === 1 ? '' : 's'} · {transfer.lines} product
                    {transfer.lines === 1 ? '' : 's'} · {formatDateTime(transfer.receivedAt ?? transfer.sentAt ?? transfer.createdAt)}
                  </p>
                  {needsMe(transfer) && (
                    <div className="mt-3">
                      <Badge tone="gold">Needs your confirmation</Badge>
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {/* Tablets and computers: the table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-ink-900 sm:block">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Transfer</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Route</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Goods</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Date</th>
                  <th scope="col" className="px-5 py-3.5"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.items.map((transfer) => {
                  return (
                    <tr key={transfer.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-5 py-4">
                        <Link to={`/transfers/${transfer.id}`} className="font-semibold text-gold-300 hover:text-gold-200">
                          {transfer.code}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-zinc-300">
                        <span className="inline-flex items-center gap-2">
                          {transfer.fromLocation.name}
                          <ArrowRight className="h-3.5 w-3.5 text-zinc-600" aria-hidden="true" />
                          {transfer.toLocation.name}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-zinc-400">
                        {transfer.unitsSent} item{transfer.unitsSent === 1 ? '' : 's'} · {transfer.lines} product{transfer.lines === 1 ? '' : 's'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <TransferStatusBadge status={transfer.status} />
                          {needsMe(transfer) && <Badge tone="gold">Needs your confirmation</Badge>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-zinc-500">
                        {formatDateTime(transfer.receivedAt ?? transfer.sentAt ?? transfer.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link to={`/transfers/${transfer.id}`} className="text-sm text-zinc-500 hover:text-gold-300">
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
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
