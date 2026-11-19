import { ArrowLeft, Armchair, Banknote, Eye, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import FormAlert from '../components/FormAlert';
import Button from '../components/ui/Button';
import QueryError from '../components/ui/QueryError';
import AddPaymentModal from '../features/sales/AddPaymentModal';
import { METHOD_LABEL, SalePaymentBadge, VerificationBadge } from '../features/sales/PaymentBadges';
import ReceiptViewerModal from '../features/sales/ReceiptViewerModal';
import { useSale } from '../features/sales/useSales';
import { formatDateTime, formatMoney } from '../lib/format';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-900 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <div className="mt-1.5 text-sm text-zinc-200">{children}</div>
    </div>
  );
}

export default function SaleDetailPage() {
  const { id } = useParams();
  const { data: sale, isPending, error, refetch } = useSale(id);

  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<{ id: string; title: string } | null>(null);

  if (isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-10 w-72 animate-pulse rounded-xl bg-white/5" />
        <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }
  if (error || !sale) {
    return (
      <div className="space-y-4">
        <Link to="/sales" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-gold-300">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All sales
        </Link>
        <QueryError error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  const unverified = sale.payments.filter((payment) => payment.verificationStatus === 'UNVERIFIED').length;

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <Link to="/sales" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-gold-300">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All sales
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-4xl font-semibold text-white">{sale.code}</h1>
              <SalePaymentBadge status={sale.paymentStatus} />
            </div>
            <p className="mt-2 text-zinc-400">
              {sale.location.name} · {formatDateTime(sale.soldAt)}
            </p>
          </div>
          {sale.can.addPayment && (
            <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setAdding(true)}>
              Record a payment
            </Button>
          )}
        </div>
      </div>

      {sale.paymentStatus !== 'PAID' && (
        <FormAlert
          tone="warning"
          title={sale.paymentStatus === 'PENDING' ? 'Nothing has been paid yet' : 'Partly paid'}
          message={`Balance still to pay: ${formatMoney(sale.balance)}.${sale.can.addPayment ? ' Press "Record a payment" when the customer pays.' : ''}`}
        />
      )}
      {unverified > 0 && (
        <FormAlert
          tone="info"
          title={`${unverified} payment${unverified === 1 ? ' is' : 's are'} waiting for the owner`}
          message="The owner checks each payment against its receipt. You will see it marked as Verified here."
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Sold by">
          {sale.salesperson.fullName}
          <span className="block text-xs text-zinc-500">recorded by {sale.recordedBy.fullName}</span>
        </Fact>
        <Fact label="Customer">
          {sale.customerName ?? <span className="text-zinc-500">Not recorded</span>}
          {sale.customerPhone && <span className="block text-xs text-zinc-500">{sale.customerPhone}</span>}
        </Fact>
        <Fact label="Total">{formatMoney(sale.total)}</Fact>
        <Fact label="Paid so far">
          {formatMoney(sale.paid)}
          <span className="block text-xs text-zinc-500">counts every payment that was not rejected</span>
        </Fact>
      </div>

      <section aria-label="Products sold" className="overflow-x-auto rounded-2xl border border-white/10 bg-ink-900">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th scope="col" className="px-5 py-3.5 font-semibold">Product</th>
              <th scope="col" className="px-5 py-3.5 text-center font-semibold">Qty</th>
              <th scope="col" className="px-5 py-3.5 text-right font-semibold">Price</th>
              <th scope="col" className="px-5 py-3.5 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sale.items.map((item) => (
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
                <td className="px-5 py-3.5 text-center text-zinc-200">{item.quantity}</td>
                <td className="px-5 py-3.5 text-right text-zinc-400">{formatMoney(item.unitPrice)}</td>
                <td className="px-5 py-3.5 text-right font-medium text-zinc-100">{formatMoney(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-white/10 text-sm">
            <tr>
              <td colSpan={3} className="px-5 py-2.5 text-right text-zinc-500">Subtotal</td>
              <td className="px-5 py-2.5 text-right text-zinc-300">{formatMoney(sale.subtotal)}</td>
            </tr>
            {Number(sale.discount) > 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-2.5 text-right text-zinc-500">
                  Discount{sale.discountReason ? ` (${sale.discountReason})` : ''}
                </td>
                <td className="px-5 py-2.5 text-right text-zinc-300">- {formatMoney(sale.discount)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={3} className="px-5 py-3 text-right font-semibold text-zinc-300">Total</td>
              <td className="px-5 py-3 text-right text-base font-semibold text-gold-300">{formatMoney(sale.total)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section aria-label="Payments" className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          <Banknote className="h-4 w-4" aria-hidden="true" />
          Payments
        </h2>

        {sale.payments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">No payment has been recorded yet.</p>
        ) : (
          <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-ink-900">
            {sale.payments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-zinc-100">
                    {formatMoney(payment.amount)} <span className="font-normal text-zinc-400">· {METHOD_LABEL[payment.method]}</span>
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatDateTime(payment.createdAt)} · recorded by {payment.recordedBy.fullName}
                    {payment.referenceNo && ` · Ref: ${payment.referenceNo}`}
                  </p>
                  {payment.verificationStatus === 'REJECTED' && payment.rejectReason && (
                    <p className="mt-1 text-xs text-red-300">Reason: {payment.rejectReason}</p>
                  )}
                </div>
                <VerificationBadge status={payment.verificationStatus} />
                {payment.hasReceipt ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                    onClick={() => setViewing({ id: payment.id, title: `${sale.code}: ${formatMoney(payment.amount)}` })}
                  >
                    View receipt
                  </Button>
                ) : (
                  <span className="text-xs text-zinc-600">No receipt (cash)</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {sale.can.addPayment && <AddPaymentModal open={adding} onClose={() => setAdding(false)} sale={sale} />}
      <ReceiptViewerModal open={viewing !== null} onClose={() => setViewing(null)} paymentId={viewing?.id ?? null} title={viewing?.title ?? ''} />
    </div>
  );
}
