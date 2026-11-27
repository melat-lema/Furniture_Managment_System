import { BarChart3, Download, TriangleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import FormAlert from '../components/FormAlert';
import { TextField } from '../components/form/Fields';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import QueryError from '../components/ui/QueryError';
import { useAuth } from '../features/auth/useAuth';
import { useLocations } from '../features/locations/useLocations';
import { METHOD_LABEL } from '../features/sales/PaymentBadges';
import { DailyChart, RankChart } from '../features/reports/Charts';
import { downloadReport, useSalesReport, type ReportFilters } from '../features/reports/useReports';
import { useSalespeople } from '../features/salespeople/useSalespeople';
import { cn } from '../lib/cn';
import { notifyError } from '../lib/notify';
import { formatMoney } from '../lib/format';

const CONTROL =
  'rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-base sm:text-sm text-zinc-200 outline-none transition focus:border-gold-500/70 focus:ring-4 focus:ring-gold-500/15 [&>option]:bg-ink-900';

const day = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function presets(): Array<{ label: string; from: string; to: string }> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const sevenAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const thirtyAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  return [
    { label: 'Today', from: day(now), to: day(now) },
    { label: 'Last 7 days', from: day(sevenAgo), to: day(now) },
    { label: 'This month', from: day(monthStart), to: day(now) },
    { label: 'Last month', from: day(lastMonthStart), to: day(lastMonthEnd) },
    { label: 'Last 30 days', from: day(thirtyAgo), to: day(now) },
  ];
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-ink-900 p-5">
      <h2 className="font-semibold text-zinc-100">{title}</h2>
      {hint && <p className="mb-3 text-xs text-zinc-500">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </section>
  );
}

function Kpi({ label, value, hint, tone = 'normal' }: { label: string; value: string; hint: string; tone?: 'normal' | 'good' | 'wait' | 'owe' }) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-ink-900 p-4',
        tone === 'wait' ? 'border-amber-500/40' : tone === 'owe' ? 'border-red-500/30' : tone === 'good' ? 'border-emerald-500/30' : 'border-white/10',
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold text-white">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';
  const quick = presets();

  const [filters, setFilters] = useState<ReportFilters>({ from: quick[2].from, to: quick[2].to, locationId: '', salespersonId: '' });
  const set = (patch: Partial<ReportFilters>) => setFilters((current) => ({ ...current, ...patch }));

  const { data: locations = [] } = useLocations();
  const showrooms = locations.filter((location) => location.type === 'SHOWROOM');
  const { data: people = [] } = useSalespeople({ includeInactive: true, ...(isOwner && filters.locationId && { showroomId: filters.locationId }) });

  const invalidRange = filters.from > filters.to;
  const { data, isPending, isFetching, error, refetch } = useSalesReport(filters, !invalidRange);

  const [downloading, setDownloading] = useState<'sales' | 'payments' | null>(null);
  const download = async (kind: 'sales' | 'payments') => {
    setDownloading(kind);
    try {
      await downloadReport(kind, filters);
      toast.success('File downloaded', { description: kind === 'sales' ? 'Sales, one row per sale.' : 'Payments recorded in this period.' });
    } catch (caught) {
      notifyError(caught, 'The file could not be created');
    } finally {
      setDownloading(null);
    }
  };

  const totals = data?.totals;

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Reports"
        description={isOwner ? 'How the business is doing, across every showroom.' : `How ${user?.locationName ?? 'your showroom'} is doing.`}
        actions={
          <>
            <Button variant="secondary" loading={downloading === 'sales'} disabled={invalidRange} icon={<Download className="h-4 w-4" aria-hidden="true" />} onClick={() => void download('sales')}>
              Sales (CSV)
            </Button>
            <Button variant="secondary" loading={downloading === 'payments'} disabled={invalidRange} icon={<Download className="h-4 w-4" aria-hidden="true" />} onClick={() => void download('payments')}>
              Payments (CSV)
            </Button>
          </>
        }
      />

      {/* ---------------------------------------------------------- filters */}
      <section className="space-y-4 rounded-2xl border border-white/10 bg-ink-900 p-5" aria-label="Filters">
        <div className="flex flex-wrap gap-2">
          {quick.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => set({ from: preset.from, to: preset.to })}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-medium transition',
                filters.from === preset.from && filters.to === preset.to ? 'border-gold-500/50 bg-gold-500/15 text-gold-300' : 'border-white/10 text-zinc-400 hover:text-zinc-200',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField label="From" type="date" value={filters.from} max={filters.to} onChange={(event) => set({ from: event.target.value })} />
          <TextField label="To" type="date" value={filters.to} min={filters.from} onChange={(event) => set({ to: event.target.value })} />
          {isOwner && (
            <div>
              <label htmlFor="report-showroom" className="mb-1.5 block text-sm font-medium text-zinc-300">
                Showroom
              </label>
              <select id="report-showroom" value={filters.locationId} onChange={(event) => set({ locationId: event.target.value, salespersonId: '' })} className={`${CONTROL} w-full`}>
                <option value="">All showrooms</option>
                {showrooms.map((showroom) => (
                  <option key={showroom.id} value={showroom.id}>
                    {showroom.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="report-person" className="mb-1.5 block text-sm font-medium text-zinc-300">
              Salesperson
            </label>
            <select id="report-person" value={filters.salespersonId} onChange={(event) => set({ salespersonId: event.target.value })} className={`${CONTROL} w-full`}>
              <option value="">Everyone</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName}
                  {isOwner && !filters.locationId ? ` (${person.showroom.name})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        {invalidRange && <p role="alert" className="text-sm text-red-400">The start date must not be after the end date.</p>}
      </section>

      {/* ---------------------------------------------------------- results */}
      {invalidRange ? null : isPending ? (
        <div className="space-y-4" aria-busy="true">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((n) => (
              <div key={n} className="h-28 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-2xl bg-white/5" />
        </div>
      ) : error || !data || !totals ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : totals.sales === 0 ? (
        <EmptyState icon={BarChart3} title="No sales in this period" text="Try a longer period, or clear the showroom and salesperson filters." />
      ) : (
        <div className={cn('space-y-6 transition', isFetching && 'opacity-70')}>
          {data.overdue.count > 0 && isOwner && (
            <FormAlert
              tone="warning"
              title={`${data.overdue.count} payment${data.overdue.count === 1 ? ' has' : 's have'} waited more than ${data.overdue.reminderHours} hours`}
              message={`${formatMoney(data.overdue.amount)} is still unchecked. Open the Payments page to verify or reject them.`}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Sold" value={formatMoney(totals.sold)} hint={`${totals.sales} sale${totals.sales === 1 ? '' : 's'} · ${totals.units} item${totals.units === 1 ? '' : 's'}`} />
            <Kpi label="Verified" value={formatMoney(totals.verified)} hint="payments the owner has checked" tone="good" />
            <Kpi label="Waiting for verification" value={formatMoney(totals.pending)} hint="paid, but not checked yet" tone={totals.pending > 0 ? 'wait' : 'normal'} />
            <Kpi label="Still to be paid" value={formatMoney(totals.balance)} hint="customers who owe money" tone={totals.balance > 0 ? 'owe' : 'normal'} />
          </div>
          <p className="-mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            <span>Discounts given: {formatMoney(totals.discount)}</span>
            <span>Rejected payments (not counted): {formatMoney(totals.rejected)}</span>
            {isOwner && data.overdue.count > 0 && (
              <Link to="/payments?overdue=1" className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200">
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                {data.overdue.count} overdue
              </Link>
            )}
          </p>

          <Panel title="Sales per day" hint={`${data.period.from} to ${data.period.to}`}>
            <DailyChart rows={data.daily.map((row) => ({ label: row.date, value: row.total, detail: `${row.count} sale${row.count === 1 ? '' : 's'}` }))} />
          </Panel>

          <div className="grid gap-6 xl:grid-cols-2">
            {isOwner && data.byShowroom.length > 1 && (
              <Panel title="By showroom">
                <RankChart label="Sales by showroom" rows={data.byShowroom.map((row) => ({ label: row.name, value: row.total, detail: `${row.count} sales` }))} />
              </Panel>
            )}
            <Panel title="By salesperson" hint="Based on the 'Sold by' chosen on each sale.">
              <RankChart label="Sales by salesperson" rows={data.bySalesperson.map((row) => ({ label: row.fullName, value: row.total, detail: `${row.count} sales${isOwner ? ` · ${row.showroom}` : ''}` }))} />
            </Panel>
            <Panel title="Best-selling products" hint="By value sold.">
              <RankChart label="Best-selling products" rows={data.topProducts.map((row) => ({ label: row.name, value: row.revenue, detail: `${row.units} sold · ${row.sku}` }))} />
            </Panel>
            <Panel title="By category">
              <RankChart label="Sales by category" rows={data.byCategory.map((row) => ({ label: row.name, value: row.revenue, detail: `${row.units} items` }))} />
            </Panel>
          </div>

          <Panel title="How customers paid" hint="Payments that were not rejected.">
            {data.paymentMethods.length === 0 ? (
              <p className="text-sm text-zinc-500">No payments recorded for these sales yet.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {data.paymentMethods.map((row) => (
                  <li key={row.method} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                    <span className="text-zinc-300">{METHOD_LABEL[row.method]}</span>
                    <span className="text-zinc-500">
                      {row.count} payment{row.count === 1 ? '' : 's'}
                    </span>
                    <span className="w-36 text-right font-medium text-zinc-100">{formatMoney(row.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
