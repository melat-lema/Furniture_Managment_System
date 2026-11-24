import { CircleCheck, Search, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Pagination from '../components/ui/Pagination';
import QueryError from '../components/ui/QueryError';
import { useLocations } from '../features/locations/useLocations';
import { type PaymentFilters, useBulkVerify, usePayments, usePaymentsSummary } from '../features/payments/usePayments';
import VerifyPaymentModal from '../features/payments/VerifyPaymentModal';
import { METHOD_LABEL, VerificationBadge } from '../features/sales/PaymentBadges';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { cn } from '../lib/cn';
import { formatDateTime, formatMoney } from '../lib/format';
import type { PaymentMethod, VerificationStatus } from '../types/api';

const CONTROL =
  'rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-base sm:text-sm text-zinc-200 outline-none transition focus:border-gold-500/70 focus:ring-4 focus:ring-gold-500/15 [&>option]:bg-ink-900';

const TABS: Array<{ value: VerificationStatus | ''; label: string }> = [
  { value: 'UNVERIFIED', label: 'Waiting for you' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: '', label: 'All' },
];

function ageText(hours: number): string {
  if (hours < 1) return 'less than an hour ago';
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function PaymentsPage() {
  const [params] = useSearchParams();
  const initial = params.get('status');
  const [status, setStatus] = useState<PaymentFilters['status']>(
    initial === 'VERIFIED' || initial === 'REJECTED' || initial === 'UNVERIFIED' ? initial : initial === 'ALL' ? '' : 'UNVERIFIED',
  );
  const [overdue, setOverdue] = useState(params.get('overdue') === '1');
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const [locationId, setLocationId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);

  const { data: locations = [] } = useLocations();
  const showrooms = locations.filter((location) => location.type === 'SHOWROOM');
  const { data: summary } = usePaymentsSummary();
  const { data, isPending, isFetching, error, refetch } = usePayments({ status, method, overdue, locationId, search: debounced, page });
  const bulk = useBulkVerify();

  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

  const items = data?.items ?? [];
  const open = items.find((payment) => payment.id === openId) ?? null;
  const openIndex = open ? items.indexOf(open) : -1;
  const next = openIndex >= 0 ? items.slice(openIndex + 1).find((payment) => payment.verificationStatus === 'UNVERIFIED') : undefined;

  const waitingOnPage = items.filter((payment) => payment.verificationStatus === 'UNVERIFIED');
  const selectedPayments = items.filter((payment) => selected.has(payment.id));
  const selectedAmount = selectedPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const withReceipts = selectedPayments.filter((payment) => payment.hasReceipt).length;
  const filtered = overdue || method !== '' || locationId !== '' || search !== '';

  const resetSelection = () => setSelected(new Set());
  const toggle = (id: string) =>
    setSelected((current) => {
      const copy = new Set(current);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  const allSelected = waitingOnPage.length > 0 && waitingOnPage.every((payment) => selected.has(payment.id));

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader title="Payments" description="Check each payment against its receipt. Only you can confirm or reject a payment." />

      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className={cn('rounded-2xl border bg-ink-900 p-4', summary.unverified.count > 0 ? 'border-amber-500/40' : 'border-white/10')}>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Waiting for you</p>
            <p className="mt-1 font-display text-3xl font-semibold text-white">{summary.unverified.count}</p>
            <p className="text-xs text-zinc-500">
              {formatMoney(summary.unverified.amount)}
              {summary.unverified.oldestHours !== null && ` · oldest ${ageText(summary.unverified.oldestHours)}`}
            </p>
          </div>
          <div className={cn('rounded-2xl border bg-ink-900 p-4', summary.overdue > 0 ? 'border-red-500/40' : 'border-white/10')}>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Overdue</p>
            <p className="mt-1 font-display text-3xl font-semibold text-white">{summary.overdue}</p>
            <p className="text-xs text-zinc-500">waiting more than {summary.reminderHours} hours</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-ink-900 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Verified this month</p>
            <p className="mt-1 font-display text-3xl font-semibold text-white">{formatMoney(summary.verifiedThisMonth)}</p>
            <p className="text-xs text-zinc-500">confirmed revenue</p>
          </div>
        </div>
      )}

      <div role="tablist" aria-label="Payment status" className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-ink-900 p-1 sm:w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
              resetSelection();
            }}
            className={cn('rounded-lg px-4 py-2 text-sm font-medium transition', status === tab.value ? 'bg-gold-500/15 text-gold-300' : 'text-zinc-400 hover:text-zinc-200')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
              resetSelection();
            }}
            placeholder="Search by sale code, reference or customer"
            aria-label="Search payments"
            className={`${CONTROL} w-full pl-10`}
          />
        </div>
        <select
          aria-label="Filter by showroom"
          value={locationId}
          onChange={(event) => {
            setLocationId(event.target.value);
            setPage(1);
            resetSelection();
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
        <select
          aria-label="Filter by method"
          value={method}
          onChange={(event) => {
            setMethod(event.target.value as PaymentMethod | '');
            setPage(1);
            resetSelection();
          }}
          className={CONTROL}
        >
          <option value="">Any method</option>
          {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((value) => (
            <option key={value} value={value}>
              {METHOD_LABEL[value]}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={overdue}
            onChange={(event) => {
              setOverdue(event.target.checked);
              setPage(1);
              resetSelection();
            }}
            className="h-4 w-4 accent-gold-500"
          />
          Overdue only
        </label>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-500/40 bg-ink-800/95 px-5 py-3 shadow-xl backdrop-blur">
          <p className="text-sm text-zinc-200">
            <strong>{selected.size}</strong> selected · {formatMoney(selectedAmount)}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={resetSelection}>
              Clear
            </Button>
            <Button size="sm" icon={<CircleCheck className="h-4 w-4" aria-hidden="true" />} onClick={() => setConfirmBulk(true)}>
              Verify selected
            </Button>
          </div>
        </div>
      )}

      {isPending ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-20 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : error && !data ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data && items.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={status === 'UNVERIFIED' && !filtered ? 'Nothing is waiting for you 🎉' : 'No payments match your filters'}
          text={status === 'UNVERIFIED' && !filtered ? 'Every payment has been checked.' : 'Try another tab or clear the filters.'}
        />
      ) : data ? (
        <div className={isFetching ? 'opacity-70 transition' : 'transition'}>
          {waitingOnPage.length > 0 && (
            <label className="mb-3 flex cursor-pointer items-center gap-2 px-1 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(waitingOnPage.map((payment) => payment.id)))}
                className="h-4 w-4 accent-gold-500"
              />
              Select all waiting payments on this page
            </label>
          )}

          <ul className="space-y-3">
            {items.map((payment) => {
              const canSelect = payment.verificationStatus === 'UNVERIFIED';
              return (
                <li
                  key={payment.id}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border bg-ink-900 p-4 transition hover:border-gold-500/30',
                    payment.overdue ? 'border-red-500/30' : 'border-white/10',
                  )}
                >
                  {canSelect ? (
                    <input
                      type="checkbox"
                      checked={selected.has(payment.id)}
                      onChange={() => toggle(payment.id)}
                      aria-label={`Select ${payment.sale.code}`}
                      className="h-4 w-4 shrink-0 accent-gold-500"
                    />
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}
                  <button type="button" onClick={() => setOpenId(payment.id)} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-2 text-left">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="font-semibold text-zinc-100">
                        {formatMoney(payment.amount)}
                        <span className="ml-2 text-sm font-normal text-zinc-400">{METHOD_LABEL[payment.method]}</span>
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {payment.sale.code} · {payment.location.name} · {payment.salesperson.fullName}
                        {payment.referenceNo && ` · Ref ${payment.referenceNo}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <VerificationBadge status={payment.verificationStatus} />
                      {payment.overdue && <Badge tone="red">Overdue</Badge>}
                      {!payment.hasReceipt && <Badge tone="zinc">Cash</Badge>}
                    </div>
                    <p className="w-28 text-right text-xs text-zinc-500">
                      {payment.verificationStatus === 'UNVERIFIED' ? ageText(payment.ageHours) : formatDateTime(payment.verifiedAt)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3">
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(next) => { setPage(next); resetSelection(); }} />
          </div>
        </div>
      ) : null}

      <VerifyPaymentModal
        open={open !== null}
        onClose={() => setOpenId(null)}
        payment={open}
        hasNext={next !== undefined}
        onNext={() => setOpenId(next?.id ?? null)}
      />

      <ConfirmDialog
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        title={`Verify ${selected.size} payment${selected.size === 1 ? '' : 's'}?`}
        message={`You are confirming ${formatMoney(selectedAmount)} without opening each one here.${withReceipts > 0 ? ` ${withReceipts} of them have a receipt: only continue if you have already checked those.` : ''}`}
        confirmLabel="Verify them all"
        onConfirm={async () => {
          const result = await bulk.mutateAsync([...selected]);
          toast.success(`${result.verified} payment${result.verified === 1 ? '' : 's'} verified`, {
            description: result.skipped > 0 ? `${result.skipped} were skipped because they had already been checked.` : undefined,
          });
          resetSelection();
        }}
      />
    </div>
  );
}
