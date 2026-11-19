import Badge from '../../components/ui/Badge';
import type { PaymentMethod, SalePaymentStatus, VerificationStatus } from '../../types/api';

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank transfer',
  TELEBIRR: 'Telebirr',
  CBE_BIRR: 'CBE Birr',
  OTHER: 'Other',
};

const SALE_STATUS: Record<SalePaymentStatus, { label: string; tone: 'red' | 'amber' | 'green' }> = {
  PENDING: { label: 'Unpaid', tone: 'red' },
  PARTIAL: { label: 'Partly paid', tone: 'amber' },
  PAID: { label: 'Paid', tone: 'green' },
};

export function SalePaymentBadge({ status }: { status: SalePaymentStatus }) {
  const { label, tone } = SALE_STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

const VERIFICATION: Record<VerificationStatus, { label: string; tone: 'amber' | 'green' | 'red'; hint: string }> = {
  UNVERIFIED: { label: 'Waiting for the owner', tone: 'amber', hint: 'The owner has not checked this payment yet.' },
  VERIFIED: { label: 'Verified', tone: 'green', hint: 'The owner checked the receipt and confirmed this payment.' },
  REJECTED: { label: 'Rejected', tone: 'red', hint: 'The owner did not accept this payment.' },
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const { label, tone, hint } = VERIFICATION[status];
  return (
    <span title={hint}>
      <Badge tone={tone}>{label}</Badge>
    </span>
  );
}
