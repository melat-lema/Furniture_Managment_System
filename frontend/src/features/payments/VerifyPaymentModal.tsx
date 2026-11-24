import { Banknote, Check, ChevronRight, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import FormAlert from '../../components/FormAlert';
import { TextAreaField } from '../../components/form/Fields';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { toApiError } from '../../lib/errors';
import { formatDateTime, formatMoney } from '../../lib/format';
import type { PaymentRow } from '../../types/api';
import { METHOD_LABEL, VerificationBadge } from '../sales/PaymentBadges';
import ReceiptPreview from '../sales/ReceiptPreview';
import { useRejectPayment, useVerifyPayment } from './usePayments';

interface VerifyPaymentModalProps {
  open: boolean;
  onClose: () => void;
  payment: PaymentRow | null;
  /** another waiting payment exists after this one */
  hasNext: boolean;
  /** called after a decision when "and next" was used */
  onNext: () => void;
}

export default function VerifyPaymentModal({ open, onClose, payment, hasNext, onNext }: VerifyPaymentModalProps) {
  return (
    <Modal
      open={open && payment !== null}
      onClose={onClose}
      size="lg"
      title="Check this payment"
      description={payment ? `${payment.sale.code} · ${payment.location.name}` : undefined}
    >
      {payment && <Body key={payment.id} payment={payment} hasNext={hasNext} onClose={onClose} onNext={onNext} />}
    </Modal>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-200">{children}</dd>
    </div>
  );
}

function Body({ payment, hasNext, onClose, onNext }: Omit<VerifyPaymentModalProps, 'open'> & { payment: PaymentRow }) {
  const verify = useVerifyPayment();
  const reject = useRejectPayment();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const waiting = payment.verificationStatus === 'UNVERIFIED';
  const busy = verify.isPending || reject.isPending;

  const finish = (goNext: boolean) => {
    if (goNext && hasNext) onNext();
    else onClose();
  };

  const doVerify = async (goNext: boolean) => {
    setProblem(null);
    try {
      await verify.mutateAsync(payment.id);
      toast.success('Payment verified', { description: `${formatMoney(payment.amount)} · ${payment.sale.code}` });
      finish(goNext);
    } catch (error) {
      setProblem(toApiError(error).message);
    }
  };

  const doReject = async () => {
    setProblem(null);
    if (reason.trim().length < 3) {
      setReasonError('Please tell the showroom why the payment is rejected.');
      return;
    }
    try {
      await reject.mutateAsync({ id: payment.id, reason: reason.trim() });
      toast.warning('Payment rejected', { description: 'The showroom will see the reason and can record it again.' });
      finish(false);
    } catch (error) {
      setProblem(toApiError(error).message);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1.25fr_1fr]">
      {/* ---------------- the receipt */}
      <div>
        {payment.hasReceipt ? (
          <ReceiptPreview paymentId={payment.id} />
        ) : (
          <div className="flex h-[40vh] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 text-center text-zinc-500">
            <Banknote className="h-8 w-8" aria-hidden="true" />
            <p className="text-sm">
              Cash payment: there is no receipt to compare.
              <br />
              Check with the showroom if you are not sure.
            </p>
          </div>
        )}
      </div>

      {/* ---------------- what the showroom entered, and the decision */}
      <div className="flex flex-col">
        <div className="rounded-2xl border border-gold-500/30 bg-gold-500/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-400/90">Amount entered</p>
          <p className="mt-1 font-display text-4xl font-semibold text-white">{formatMoney(payment.amount)}</p>
          <p className="mt-1 text-xs text-zinc-400">Does the receipt show exactly this amount?</p>
        </div>

        <dl className="mt-4 divide-y divide-white/5">
          <Detail label="Method">{METHOD_LABEL[payment.method]}</Detail>
          <Detail label="Reference">{payment.referenceNo ?? <span className="text-zinc-600">none</span>}</Detail>
          <Detail label="Sale">
            <Link to={`/sales/${payment.sale.id}`} className="text-gold-300 hover:text-gold-200">
              {payment.sale.code}
            </Link>
            <span className="block text-xs text-zinc-500">total {formatMoney(payment.sale.total)}</span>
          </Detail>
          <Detail label="Sold by">{payment.salesperson.fullName}</Detail>
          <Detail label="Customer">{payment.sale.customerName ?? <span className="text-zinc-600">not recorded</span>}</Detail>
          <Detail label="Recorded">
            {formatDateTime(payment.createdAt)}
            <span className="block text-xs text-zinc-500">by {payment.recordedBy.fullName}</span>
          </Detail>
          <Detail label="Status">
            <span className="inline-flex items-center gap-2">
              <VerificationBadge status={payment.verificationStatus} />
              {payment.overdue && <Badge tone="red">Overdue</Badge>}
            </span>
          </Detail>
        </dl>

        {problem && <FormAlert className="mt-3" title="That did not work" message={problem} />}

        {!waiting ? (
          <div className="mt-4 rounded-xl bg-white/5 p-4 text-sm text-zinc-400">
            {payment.verificationStatus === 'VERIFIED' ? 'Verified' : 'Rejected'}
            {payment.verifiedBy && ` by ${payment.verifiedBy.fullName}`}
            {payment.verifiedAt && ` on ${formatDateTime(payment.verifiedAt)}`}.
            {payment.rejectReason && <span className="mt-1 block text-red-300">Reason: {payment.rejectReason}</span>}
          </div>
        ) : rejecting ? (
          <div className="mt-4 space-y-3">
            <TextAreaField
              label="Why is it rejected? (the showroom will see this)"
              rows={3}
              autoFocus
              value={reason}
              maxLength={200}
              onChange={(event) => {
                setReason(event.target.value);
                setReasonError(null);
              }}
              placeholder="For example: the receipt shows 4,500, not 5,000"
              error={reasonError ?? undefined}
            />
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setRejecting(false)} disabled={busy}>
                Back
              </Button>
              <Button variant="danger" loading={reject.isPending} onClick={() => void doReject()} icon={<X className="h-4 w-4" aria-hidden="true" />}>
                Reject payment
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <Button loading={verify.isPending} onClick={() => void doVerify(false)} icon={<Check className="h-4 w-4" aria-hidden="true" />}>
              Verify payment
            </Button>
            {hasNext && (
              <Button variant="secondary" disabled={busy} onClick={() => void doVerify(true)} icon={<ChevronRight className="h-4 w-4" aria-hidden="true" />}>
                Verify and open the next one
              </Button>
            )}
            <Button variant="ghost" disabled={busy} onClick={() => setRejecting(true)} icon={<X className="h-4 w-4" aria-hidden="true" />}>
              Reject…
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
