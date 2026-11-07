export const MOVEMENT_REASONS = [
  'PRODUCTION',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'SALE',
  'VOID',
  'RETURN',
  'ADJUSTMENT',
] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];

export const ADJUSTMENT_REASONS = ['DAMAGED', 'MISCOUNT', 'FOUND', 'OTHER'] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export const ADJUSTMENT_LABEL: Record<AdjustmentReason, string> = {
  DAMAGED: 'Damaged or lost',
  MISCOUNT: 'Counting correction',
  FOUND: 'Found',
  OTHER: 'Other',
};
