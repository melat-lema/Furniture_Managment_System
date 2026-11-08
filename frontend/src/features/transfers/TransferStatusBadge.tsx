import Badge from '../../components/ui/Badge';
import type { TransferStatus } from '../../types/api';

const META: Record<TransferStatus, { label: string; tone: 'zinc' | 'blue' | 'green' | 'amber' | 'red' }> = {
  DRAFT: { label: 'Draft', tone: 'zinc' },
  IN_TRANSIT: { label: 'In transit', tone: 'blue' },
  RECEIVED: { label: 'Received', tone: 'green' },
  RECEIVED_WITH_DISCREPANCY: { label: 'Received with differences', tone: 'amber' },
  CANCELLED: { label: 'Cancelled', tone: 'red' },
};

export const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  DRAFT: META.DRAFT.label,
  IN_TRANSIT: META.IN_TRANSIT.label,
  RECEIVED: META.RECEIVED.label,
  RECEIVED_WITH_DISCREPANCY: META.RECEIVED_WITH_DISCREPANCY.label,
  CANCELLED: META.CANCELLED.label,
};

export default function TransferStatusBadge({ status }: { status: TransferStatus }) {
  const { label, tone } = META[status];
  return <Badge tone={tone}>{label}</Badge>;
}
