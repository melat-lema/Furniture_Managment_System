export const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'TELEBIRR', 'CBE_BIRR', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SALE_PAYMENT_STATUSES = ['PENDING', 'PARTIAL', 'PAID'] as const;
export type SalePaymentStatus = (typeof SALE_PAYMENT_STATUSES)[number];

export const SALE_STATUSES = ['ACTIVE', 'VOIDED'] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];
