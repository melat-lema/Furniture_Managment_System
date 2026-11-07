import type { MovementReason } from '../types/api';

export const REASON_LABEL: Record<MovementReason, string> = {
  PRODUCTION: 'Production',
  TRANSFER_OUT: 'Sent out',
  TRANSFER_IN: 'Received',
  SALE: 'Sale',
  VOID: 'Sale cancelled',
  RETURN: 'Return',
  ADJUSTMENT: 'Adjustment',
};
