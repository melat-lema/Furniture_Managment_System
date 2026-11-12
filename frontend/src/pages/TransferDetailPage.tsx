import { ArrowLeft, ArrowRight, Armchair, PackageCheck, Pencil, Send, TriangleAlert, CircleX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import FormAlert from '../components/FormAlert';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import QueryError from '../components/ui/QueryError';
import CancelTransferModal from '../features/transfers/CancelTransferModal';
import ReceiveTransferModal from '../features/transfers/ReceiveTransferModal';
import TransferStatusBadge from '../features/transfers/TransferStatusBadge';
import { useSendTransfer, useTransfer } from '../features/transfers/useTransfers';
import { cn } from '../lib/cn';
import { formatDateTime } from '../lib/format';
import type { TransferDetail } from '../types/api';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-900 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <div className="mt-1.5 text-sm text-zinc-200">{children}</div>
    </div>
  );
}


/** One plain sentence about where this transfer is and who has to act next. */
function whatNext(transfer: TransferDetail): { title: string; text: string; tone: 'info' | 'warning' } | null {
  const sender = transfer.createdBy.fullName;
  switch (transfer.status) {
    case 'DRAFT':
      return transfer.can.send
        ? {
            title: 'This is a draft: it has not been sent yet',
            text: `No stock has moved. Check the products and quantities, then press Send when the goods leave ${transfer.fromLocation.name}. You can still edit or cancel it.`,
            tone: 'info',
          }
        : {
            title: 'Draft: not sent yet',
            text: `${sender} saved this transfer but has not sent it. No stock has moved. It becomes "In transit" when ${sender} presses Send.`,
            tone: 'info',
          };
    case 'IN_TRANSIT':
      return transfer.can.receive
        ? null
        : {
            title: 'On the road',
            text: `The goods have left ${transfer.fromLocation.name}. ${transfer.toLocation.name} must confirm what arrived before it is added to their stock.`,
            tone: 'info',
          };
    case 'CANCELLED':
      return {
        title: 'Cancelled',
        text: 'This transfer was stopped. If the goods had already left, they were put back into the sender stock.',
        tone: 'warning',
      };
    default:
      return null;
  }
}

export default function TransferDetailPage() {
  const { id } = useParams();
  const { data: transfer, isPending, isFetching, error, refetch } = useTransfer(id);
  const send = useSendTransfer();

  const [confirmSend, setConfirmSend] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-10 w-72 animate-pulse rounded-xl bg-white/5" />
        <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }
  if (error || !transfer) {
    return (
      <div className="space-y-4">
        <Link to="/transfers" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-gold-300">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All transfers
        </Link>
        <QueryError error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  const closed = transfer.status === 'RECEIVED' || transfer.status === 'RECEIVED_WITH_DISCREPANCY';
  const shortLines = transfer.items.filter((item) => item.qtyReceived !== null && item.qtyReceived !== item.qtySent);

  return (
    <div className={cn('space-y-8 animate-fade-up', isFetching && 'opacity-90')}>
      <div>
        <Link to="/transfers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-gold-300">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All transfers
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-4xl font-semibold text-white">{transfer.code}</h1>
              <TransferStatusBadge status={transfer.status} />
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-zinc-400">
              {transfer.fromLocation.name}
              <ArrowRight className="h-4 w-4 text-zinc-600" aria-hidden="true" />
              {transfer.toLocation.name}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {transfer.can.edit && (
              <Link to={`/transfers/${transfer.id}/edit`}>
                <Button variant="secondary" icon={<Pencil className="h-4 w-4" aria-hidden="true" />}>
                  Edit
                </Button>
              </Link>
            )}
            {transfer.can.send && (
              <Button icon={<Send className="h-4 w-4" aria-hidden="true" />} onClick={() => setConfirmSend(true)}>
                Send
              </Button>
            )}
            {transfer.can.receive && (
              <Button icon={<PackageCheck className="h-4 w-4" aria-hidden="true" />} onClick={() => setReceiving(true)}>
                Confirm what arrived
              </Button>
            )}
            {transfer.can.cancel && (
              <Button variant="ghost" icon={<CircleX className="h-4 w-4" aria-hidden="true" />} onClick={() => setCancelling(true)}>
                Cancel transfer
              </Button>
            )}
          </div>
        </div>
      </div>

      {(() => {
        const next = whatNext(transfer);
        return next ? <FormAlert tone={next.tone} title={next.title} message={next.text} /> : null;
      })()}

      {transfer.status === 'IN_TRANSIT' && transfer.can.receive && (
        <FormAlert
          tone="warning"
          title="This transfer is waiting for you"
          message="When the goods arrive, count them and press Confirm what arrived. Only what you confirm is added to your stock."
        />
      )}

      {transfer.status === 'RECEIVED_WITH_DISCREPANCY' && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5" aria-label="Differences found">
          <div className="flex items-center gap-2 text-amber-300">
            <TriangleAlert className="h-5 w-5" aria-hidden="true" />
            <h2 className="font-semibold">Received with differences</h2>
          </div>
          {transfer.discrepancyNote && <p className="mt-2 text-sm text-amber-100/90">“{transfer.discrepancyNote}”</p>}
          <ul className="mt-3 space-y-1 text-sm text-zinc-300">
            {shortLines.map((item) => (
              <li key={item.productId}>
                {item.product.name}: sent {item.qtySent}, received {item.qtyReceived}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Created">
          {formatDateTime(transfer.createdAt)}
          <span className="block text-xs text-zinc-500">by {transfer.createdBy.fullName}</span>
        </Fact>
        <Fact label="Sent">
          {transfer.sentAt ? (
            formatDateTime(transfer.sentAt)
          ) : (
            <>
              <span className="text-zinc-500">{transfer.status === 'CANCELLED' ? 'Never sent' : 'Not sent yet'}</span>
              {transfer.status === 'DRAFT' && (
                <span className="block text-xs text-zinc-500">{transfer.can.send ? 'Press Send to move the goods' : 'Waiting for the sender'}</span>
              )}
            </>
          )}
        </Fact>
        <Fact label="Received">
          {transfer.receivedAt ? (
            <>
              {formatDateTime(transfer.receivedAt)}
              {transfer.receivedBy && <span className="block text-xs text-zinc-500">by {transfer.receivedBy.fullName}</span>}
            </>
          ) : (
            <span className="text-zinc-500">{transfer.status === 'CANCELLED' ? 'Cancelled' : 'Not yet'}</span>
          )}
        </Fact>
        <Fact label="Goods">
          {transfer.unitsSent} item{transfer.unitsSent === 1 ? '' : 's'} · {transfer.lines} product{transfer.lines === 1 ? '' : 's'}
          {closed && transfer.unitsReceived !== null && (
            <span className="block text-xs text-zinc-500">{transfer.unitsReceived} received</span>
          )}
        </Fact>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-ink-900">
        <table className="w-full min-w-[30rem] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th scope="col" className="px-5 py-3.5 font-semibold">Product</th>
              <th scope="col" className="px-5 py-3.5 text-center font-semibold">Sent</th>
              {closed && <th scope="col" className="px-5 py-3.5 text-center font-semibold">Received</th>}
              {closed && <th scope="col" className="px-5 py-3.5 text-center font-semibold">Difference</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {transfer.items.map((item) => {
              const difference = item.qtyReceived === null ? 0 : item.qtyReceived - item.qtySent;
              return (
                <tr key={item.productId}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {item.product.imageUrl ? (
                        <img src={item.product.imageUrl} alt="" loading="lazy" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-zinc-600">
                          <Armchair className="h-5 w-5" aria-hidden="true" />
                        </span>
                      )}
                      <div>
                        <p className="font-medium text-zinc-100">{item.product.name}</p>
                        <p className="text-xs text-zinc-500">{item.product.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-center font-semibold text-zinc-200">{item.qtySent}</td>
                  {closed && <td className="px-5 py-3.5 text-center text-zinc-200">{item.qtyReceived ?? 0}</td>}
                  {closed && (
                    <td className={cn('px-5 py-3.5 text-center font-semibold', difference === 0 ? 'text-zinc-600' : 'text-amber-300')}>
                      {difference === 0 ? '-' : difference}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {transfer.note && (
        <p className="rounded-2xl border border-white/10 bg-ink-900 p-4 text-sm text-zinc-400">
          <span className="font-semibold text-zinc-300">Note: </span>
          {transfer.note}
        </p>
      )}

      <ConfirmDialog
        open={confirmSend}
        onClose={() => setConfirmSend(false)}
        title="Send this transfer?"
        message={`${transfer.unitsSent} item${transfer.unitsSent === 1 ? '' : 's'} will leave the stock of ${transfer.fromLocation.name} now and go to ${transfer.toLocation.name}. ${transfer.toLocation.name} must confirm what arrives.`}
        confirmLabel="Send"
        onConfirm={async () => {
          await send.mutateAsync(transfer.id);
          toast.success('Transfer sent', { description: `${transfer.code} is on its way to ${transfer.toLocation.name}.` });
        }}
      />
      {transfer.can.receive && <ReceiveTransferModal open={receiving} onClose={() => setReceiving(false)} transfer={transfer} />}
      {transfer.can.cancel && <CancelTransferModal open={cancelling} onClose={() => setCancelling(false)} transfer={transfer} />}
    </div>
  );
}
