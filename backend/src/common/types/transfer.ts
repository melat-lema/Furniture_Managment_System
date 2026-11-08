export const TRANSFER_STATUSES = ['DRAFT', 'IN_TRANSIT', 'RECEIVED', 'RECEIVED_WITH_DISCREPANCY', 'CANCELLED'] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];
