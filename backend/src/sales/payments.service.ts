import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../common/constants';
import type { AuthUser } from '../common/types/auth-user';
import { startOfBusinessMonth } from '../common/utils/dates';
import { notFound, ruleError } from '../common/utils/field-error';
import { type Paginated, pageArgs } from '../common/utils/pagination';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { BulkVerifyDto, ListPaymentsQueryDto, RejectPaymentDto } from './dto/payments.dto';
import { paidOf, statusFor } from './sale-money';

const ROW_INCLUDE = {
  sale: {
    select: {
      id: true,
      code: true,
      total: true,
      status: true,
      customerName: true,
      location: { select: { id: true, name: true } },
      salesperson: { select: { id: true, fullName: true } },
    },
  },
  recordedBy: { select: { id: true, fullName: true } },
  verifiedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.PaymentInclude;
type Row = Prisma.PaymentGetPayload<{ include: typeof ROW_INCLUDE }>;

const HOUR = 3_600_000;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  // ------------------------------------------------------------------ read
  /** The queue. Owner: every showroom. A showroom sees only its own (to find rejected payments to fix). */
  async list(query: ListPaymentsQueryDto, user: AuthUser): Promise<Paginated<ReturnType<typeof present>>> {
    const reminderHours = await this.settings.getNumber('payment_reminder_hours');
    const and: Prisma.PaymentWhereInput[] = [this.scope(user, query.locationId)];

    if (query.status) and.push({ verificationStatus: query.status });
    if (query.method) and.push({ method: query.method });
    if (query.overdue) {
      and.push({ verificationStatus: 'UNVERIFIED', createdAt: { lte: new Date(Date.now() - reminderHours * HOUR) } });
    }
    if (query.search) {
      and.push({
        OR: [
          { referenceNo: { contains: query.search, mode: 'insensitive' } },
          { sale: { code: { contains: query.search, mode: 'insensitive' } } },
          { sale: { customerName: { contains: query.search, mode: 'insensitive' } } },
        ],
      });
    }
    const where: Prisma.PaymentWhereInput = { AND: and };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: ROW_INCLUDE,
        // the waiting queue is oldest first, so nothing sits forgotten at the bottom
        orderBy: { createdAt: query.status === 'UNVERIFIED' ? 'asc' : 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.payment.count({ where }),
    ]);

    const now = Date.now();
    return { items: rows.map((row) => present(row, now, reminderHours)), total, page: query.page, pageSize: query.pageSize };
  }

  /** Numbers for the dashboards and the sidebar badge. */
  async summary(user: AuthUser) {
    const reminderHours = await this.settings.getNumber('payment_reminder_hours');
    const scope = this.scope(user);
    const waiting: Prisma.PaymentWhereInput = { AND: [scope, { verificationStatus: 'UNVERIFIED', sale: { status: 'ACTIVE' } }] };

    const [unverified, overdue, rejected, verified] = await Promise.all([
      this.prisma.payment.aggregate({ where: waiting, _count: { _all: true }, _sum: { amount: true }, _min: { createdAt: true } }),
      this.prisma.payment.count({
        where: { AND: [waiting, { createdAt: { lte: new Date(Date.now() - reminderHours * HOUR) } }] },
      }),
      // rejected payments that still leave something to pay: the showroom has to record them again
      this.prisma.payment.count({
        where: { AND: [scope, { verificationStatus: 'REJECTED', sale: { status: 'ACTIVE', paymentStatus: { not: 'PAID' } } }] },
      }),
      this.prisma.payment.aggregate({
        where: { AND: [scope, { verificationStatus: 'VERIFIED', verifiedAt: { gte: startOfBusinessMonth() } }] },
        _sum: { amount: true },
      }),
    ]);

    const oldest = unverified._min.createdAt;
    return {
      reminderHours,
      unverified: {
        count: unverified._count._all,
        amount: (unverified._sum.amount ?? new Prisma.Decimal(0)).toString(),
        oldestHours: oldest ? Math.floor((Date.now() - oldest.getTime()) / HOUR) : null,
      },
      overdue,
      rejected,
      verifiedThisMonth: (verified._sum.amount ?? new Prisma.Decimal(0)).toString(),
    };
  }

  // ---------------------------------------------------------------- decide
  async verify(id: string, user: AuthUser, ip: string | null) {
    const payment = await this.find(id);
    this.assertCanDecide(payment);

    const changed = await this.prisma.payment.updateMany({
      where: { id, verificationStatus: 'UNVERIFIED' },
      data: { verificationStatus: 'VERIFIED', verifiedById: user.id, verifiedAt: new Date(), rejectReason: null },
    });
    if (changed.count !== 1) throw ruleError(ErrorCode.PAYMENT_STATE, 'This payment was checked a moment ago.');

    await this.audit.log({
      userId: user.id,
      action: 'PAYMENT_VERIFY',
      tableName: 'Payment',
      recordId: id,
      newValue: { sale: payment.sale.code, amount: payment.amount.toString() },
      ipAddress: ip,
    });
    return this.one(id);
  }

  /** A rejected payment no longer counts as paid, so the sale shows its balance again and the showroom records it again. */
  async reject(id: string, dto: RejectPaymentDto, user: AuthUser, ip: string | null) {
    const payment = await this.find(id);
    this.assertCanDecide(payment);

    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.payment.updateMany({
        where: { id, verificationStatus: 'UNVERIFIED' },
        data: { verificationStatus: 'REJECTED', verifiedById: user.id, verifiedAt: new Date(), rejectReason: dto.reason },
      });
      if (changed.count !== 1) throw ruleError(ErrorCode.PAYMENT_STATE, 'This payment was checked a moment ago.');

      const sale = await tx.sale.findUniqueOrThrow({
        where: { id: payment.saleId },
        select: { total: true, payments: { select: { amount: true, verificationStatus: true } } },
      });
      await tx.sale.update({ where: { id: payment.saleId }, data: { paymentStatus: statusFor(sale.total, paidOf(sale.payments)) } });
    });

    await this.audit.log({
      userId: user.id,
      action: 'PAYMENT_REJECT',
      tableName: 'Payment',
      recordId: id,
      newValue: { sale: payment.sale.code, amount: payment.amount.toString(), reason: dto.reason },
      ipAddress: ip,
    });
    return this.one(id);
  }

  /** Confirms many payments at once. Anything already checked, or on a cancelled sale, is skipped. */
  async bulkVerify(dto: BulkVerifyDto, user: AuthUser, ip: string | null) {
    const ids = [...new Set(dto.ids)];
    const changed = await this.prisma.payment.updateMany({
      where: { id: { in: ids }, verificationStatus: 'UNVERIFIED', sale: { status: 'ACTIVE' } },
      data: { verificationStatus: 'VERIFIED', verifiedById: user.id, verifiedAt: new Date(), rejectReason: null },
    });

    await this.audit.log({
      userId: user.id,
      action: 'PAYMENT_BULK_VERIFY',
      tableName: 'Payment',
      recordId: 'bulk',
      newValue: { requested: ids.length, verified: changed.count },
      ipAddress: ip,
    });
    return { verified: changed.count, skipped: ids.length - changed.count };
  }

  // --------------------------------------------------------------- helpers
  private scope(user: AuthUser, locationId?: string): Prisma.PaymentWhereInput {
    if (user.role === 'OWNER') return locationId ? { sale: { locationId } } : {};
    return { sale: { locationId: user.locationId ?? '__none__' } };
  }

  private async find(id: string): Promise<Row> {
    const payment = await this.prisma.payment.findUnique({ where: { id }, include: ROW_INCLUDE });
    if (!payment) throw notFound('That payment');
    return payment;
  }

  private async one(id: string) {
    const reminderHours = await this.settings.getNumber('payment_reminder_hours');
    return present(await this.find(id), Date.now(), reminderHours);
  }

  private assertCanDecide(payment: Row): void {
    if (payment.verificationStatus !== 'UNVERIFIED') {
      throw ruleError(ErrorCode.PAYMENT_STATE, 'This payment has already been checked.');
    }
    if (payment.sale.status !== 'ACTIVE') {
      throw ruleError(ErrorCode.PAYMENT_STATE, 'This sale was cancelled, so its payments cannot be checked.');
    }
  }
}

function present(row: Row, now: number, reminderHours: number) {
  const ageHours = Math.floor((now - row.createdAt.getTime()) / HOUR);
  return {
    id: row.id,
    amount: row.amount.toString(),
    method: row.method,
    referenceNo: row.referenceNo,
    hasReceipt: row.receiptPath !== null,
    verificationStatus: row.verificationStatus,
    rejectReason: row.rejectReason,
    createdAt: row.createdAt,
    verifiedAt: row.verifiedAt,
    ageHours,
    overdue: row.verificationStatus === 'UNVERIFIED' && ageHours >= reminderHours,
    sale: {
      id: row.sale.id,
      code: row.sale.code,
      total: row.sale.total.toString(),
      status: row.sale.status,
      customerName: row.sale.customerName,
    },
    location: row.sale.location,
    salesperson: row.sale.salesperson,
    recordedBy: row.recordedBy,
    verifiedBy: row.verifiedBy,
  };
}
