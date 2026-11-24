import type { SalePaymentStatus } from '../common/types/sales';
import { Prisma } from '../generated/prisma/client';

export type Money = Prisma.Decimal;

/** What has been paid on a sale. Rejected payments do not count. */
export function paidOf(payments: Array<{ amount: Money; verificationStatus: string }>): Money {
  return payments
    .filter((payment) => payment.verificationStatus !== 'REJECTED')
    .reduce((sum, payment) => sum.add(payment.amount), new Prisma.Decimal(0));
}

export function statusFor(total: Money, paid: Money): SalePaymentStatus {
  if (paid.gte(total)) return 'PAID';
  if (paid.gt(0)) return 'PARTIAL';
  return 'PENDING';
}
