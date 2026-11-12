import { ChevronDown, Info } from 'lucide-react';
import type { Role } from '../../types/auth';
import TransferStatusBadge, { TRANSFER_STATUS_INFO } from './TransferStatusBadge';
import type { TransferStatus } from '../../types/api';

const ORDER: TransferStatus[] = ['DRAFT', 'IN_TRANSIT', 'RECEIVED', 'RECEIVED_WITH_DISCREPANCY', 'CANCELLED'];

function intro(role: Role): string {
  if (role === 'OWNER') {
    return 'The workshop and the store create and send transfers. You can follow every one here, and cancel one if it is not needed.';
  }
  if (role === 'WORKSHOP_MANAGER' || role === 'STORE_MANAGER') {
    return 'You create and send transfers. The receiving location confirms what arrives.';
  }
  return 'Transfers sent to you appear here. Confirm what arrives to add it to your stock.';
}

/** A short, always-available explanation of what each status means. */
export default function StatusLegend({ role }: { role: Role }) {
  return (
    <details className="group rounded-2xl border border-white/10 bg-ink-900">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 text-sm text-zinc-400 hover:text-zinc-200">
        <Info className="h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
        <span className="flex-1">{intro(role)}</span>
        <span className="hidden items-center gap-1 text-xs font-medium text-gold-300 sm:inline-flex">
          What do the statuses mean?
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <ul className="space-y-3 border-t border-white/5 px-5 py-4">
        {ORDER.map((status) => (
          <li key={status} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
            <span className="sm:w-52">
              <TransferStatusBadge status={status} />
            </span>
            <span className="text-sm text-zinc-400">{TRANSFER_STATUS_INFO[status].meaning}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
