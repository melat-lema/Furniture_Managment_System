import Badge from '../../components/ui/Badge';
import type { TransferStatus } from '../../types/api';

export const TRANSFER_STATUS_INFO: Record<
  TransferStatus,
  { label: string; tone: 'zinc' | 'blue' | 'green' | 'amber' | 'red'; meaning: string }
> = {
  DRAFT: {
    label: 'Draft',
    tone: 'zinc',
    meaning: 'Saved but not sent yet. No stock has moved. The sender must press Send.',
  },
  IN_TRANSIT: {
    label: 'In transit',
    tone: 'blue',
    meaning: 'Sent. The goods have left the sender and the receiving location has not confirmed them yet.',
  },
  RECEIVED: {
    label: 'Received',
    tone: 'green',
    meaning: 'The receiving location confirmed that everything arrived and added it to its stock.',
  },
  RECEIVED_WITH_DISCREPANCY: {
    label: 'Received with differences',
    tone: 'amber',
    meaning: 'Received, but some goods were missing or damaged. Only what arrived was added to the stock.',
  },
  CANCELLED: {
    label: 'Cancelled',
    tone: 'red',
    meaning: 'Stopped. If the goods had already left, they were put back into the sender stock.',
  },
};

export const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  DRAFT: TRANSFER_STATUS_INFO.DRAFT.label,
  IN_TRANSIT: TRANSFER_STATUS_INFO.IN_TRANSIT.label,
  RECEIVED: TRANSFER_STATUS_INFO.RECEIVED.label,
  RECEIVED_WITH_DISCREPANCY: TRANSFER_STATUS_INFO.RECEIVED_WITH_DISCREPANCY.label,
  CANCELLED: TRANSFER_STATUS_INFO.CANCELLED.label,
};

export default function TransferStatusBadge({ status }: { status: TransferStatus }) {
  const { label, tone, meaning } = TRANSFER_STATUS_INFO[status];
  return (
    <span title={meaning}>
      <Badge tone={tone}>{label}</Badge>
    </span>
  );
}
