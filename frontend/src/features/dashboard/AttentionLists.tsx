import { ArrowRight, ClipboardList, PackageCheck, TriangleAlert, Truck, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDateTime } from '../../lib/format';
import type { TransferStatus } from '../../types/api';
import type { Role } from '../../types/auth';
import TransferStatusBadge from '../transfers/TransferStatusBadge';
import { useTransfers, type TransferFilters } from '../transfers/useTransfers';

interface MiniListProps {
  title: string;
  hint: string;
  icon: LucideIcon;
  status: TransferStatus;
  direction: TransferFilters['direction'];
  empty: string;
  /** highlight the card when there is something in it */
  attention?: boolean;
}

function MiniList({ title, hint, icon: Icon, status, direction, empty, attention = false }: MiniListProps) {
  const { data, isPending, error } = useTransfers({ status, direction, search: '', page: 1 });
  const items = data?.items.slice(0, 5) ?? [];
  const link = `/transfers?status=${status}${direction ? `&direction=${direction}` : ''}`;
  const hot = attention && (data?.total ?? 0) > 0;

  return (
    <section
      className={`rounded-2xl border bg-ink-900 p-5 ${hot ? 'border-amber-500/40' : 'border-white/10'}`}
      aria-label={title}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${hot ? 'bg-amber-500/10 text-amber-300 ring-amber-500/30' : 'bg-gold-500/10 text-gold-400 ring-gold-500/25'}`}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-zinc-100">
              {title}
              {data && data.total > 0 && <span className="ml-2 text-sm font-normal text-zinc-500">({data.total})</span>}
            </h2>
            <p className="text-xs text-zinc-500">{hint}</p>
          </div>
        </div>
        <Link to={link} className="inline-flex items-center gap-1 text-sm font-medium text-gold-300 hover:text-gold-200">
          All <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {isPending ? (
        <div className="h-24 animate-pulse rounded-xl bg-white/5" aria-busy="true" />
      ) : error || !data ? (
        <p role="alert" className="text-sm text-zinc-500">This list could not be loaded right now.</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {items.map((transfer) => (
            <li key={transfer.id}>
              <Link to={`/transfers/${transfer.id}`} className="flex items-center justify-between gap-3 py-3 transition hover:text-gold-200">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">{transfer.code}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {transfer.fromLocation.name} → {transfer.toLocation.name} · {transfer.unitsSent} item
                    {transfer.unitsSent === 1 ? '' : 's'} · {formatDateTime(transfer.receivedAt ?? transfer.sentAt ?? transfer.createdAt)}
                  </p>
                </div>
                <TransferStatusBadge status={transfer.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The transfers that need this person's attention, by role. */
export default function AttentionLists({ role }: { role: Role }) {
  const lists: MiniListProps[] = [];

  if (role === 'STORE_MANAGER' || role === 'SHOWROOM') {
    lists.push({
      title: 'Waiting for you',
      hint: 'Goods on their way to you. Confirm what arrives.',
      icon: PackageCheck,
      status: 'IN_TRANSIT',
      direction: 'incoming',
      empty: 'Nothing is waiting to be received.',
      attention: true,
    });
  }
  if (role === 'WORKSHOP_MANAGER' || role === 'STORE_MANAGER') {
    lists.push({
      title: 'Your drafts',
      hint: 'Saved but not sent yet.',
      icon: ClipboardList,
      status: 'DRAFT',
      direction: 'outgoing',
      empty: 'No drafts waiting.',
    });
    lists.push({
      title: 'You sent, on the road',
      hint: 'Waiting for the other side to confirm.',
      icon: Truck,
      status: 'IN_TRANSIT',
      direction: 'outgoing',
      empty: 'Nothing is on the road.',
    });
  }
  if (role === 'OWNER') {
    lists.push({
      title: 'On the road',
      hint: 'Goods that have left and are not confirmed yet.',
      icon: Truck,
      status: 'IN_TRANSIT',
      direction: '',
      empty: 'Nothing is on the road right now.',
    });
  }
  if (role === 'OWNER' || role === 'WORKSHOP_MANAGER') {
    lists.push({
      title: 'Recent differences',
      hint: 'Received, but something was missing or damaged.',
      icon: TriangleAlert,
      status: 'RECEIVED_WITH_DISCREPANCY',
      direction: '',
      empty: 'No differences found. 👍',
      attention: true,
    });
  }

  if (lists.length === 0) return null;
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {lists.map((list) => (
        <MiniList key={list.title} {...list} />
      ))}
    </div>
  );
}
