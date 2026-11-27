import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../common/constants';
import type { AuthUser } from '../common/types/auth-user';
import { toCsv } from '../common/utils/csv';
import {
  businessDayStart,
  formatBusinessDateTime,
  formatBusinessDay,
  startOfBusinessMonth,
} from '../common/utils/dates';
import { fieldError, ruleError } from '../common/utils/field-error';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { ReportQueryDto } from './dto/report-query.dto';

const DAY_MS = 86_400_000;
const MAX_DAYS = 366;
const MAX_ROWS = 20_000;

/** Money is added up in whole cents so totals never drift by a fraction. */
const cents = (value: { toString(): string } | number): number => Math.round(Number(value.toString()) * 100);
const birr = (value: number): number => value / 100;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  // ----------------------------------------------------------------- scope
  private range(query: ReportQueryDto) {
    const from = query.from ?? formatBusinessDay(startOfBusinessMonth());
    const to = query.to ?? formatBusinessDay(new Date());
    if (from > to) throw fieldError('from', 'The start date must not be after the end date.');

    const start = businessDayStart(from);
    const end = new Date(businessDayStart(to).getTime() + DAY_MS);
    const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
    if (days > MAX_DAYS) throw fieldError('to', 'Choose a period of one year or less.');
    return { from, to, start, end, days };
  }

  /** The owner may look at one showroom or all; a showroom always sees only itself. */
  private locationOf(user: AuthUser, query: ReportQueryDto): string | undefined {
    return user.role === 'OWNER' ? query.locationId : (user.locationId ?? '__none__');
  }

  private saleWhere(user: AuthUser, query: ReportQueryDto, start: Date, end: Date): Prisma.SaleWhereInput {
    const location = this.locationOf(user, query);
    return {
      status: 'ACTIVE',
      soldAt: { gte: start, lt: end },
      ...(location && { locationId: location }),
      ...(query.salespersonId && { salespersonId: query.salespersonId }),
    };
  }

  // ---------------------------------------------------------------- report
  async sales(query: ReportQueryDto, user: AuthUser) {
    const range = this.range(query);
    const where = this.saleWhere(user, query, range.start, range.end);

    const count = await this.prisma.sale.count({ where });
    if (count > MAX_ROWS) {
      throw ruleError(ErrorCode.CONFLICT, 'There are too many sales for one report. Choose a shorter period.');
    }

    const sales = await this.prisma.sale.findMany({
      where,
      select: {
        soldAt: true,
        subtotal: true,
        discount: true,
        total: true,
        locationId: true,
        salespersonId: true,
        items: { select: { productId: true, quantity: true, unitPrice: true } },
        payments: { select: { amount: true, method: true, verificationStatus: true } },
      },
    });

    const totals = { sales: sales.length, units: 0, subtotal: 0, discount: 0, sold: 0, verified: 0, pending: 0, rejected: 0, balance: 0 };
    const daily = new Map<string, { count: number; total: number }>();
    for (let i = 0; i < range.days; i += 1) {
      daily.set(formatBusinessDay(new Date(range.start.getTime() + i * DAY_MS)), { count: 0, total: 0 });
    }
    const byShowroom = new Map<string, { count: number; total: number }>();
    const byPerson = new Map<string, { count: number; total: number }>();
    const byProduct = new Map<string, { units: number; revenue: number }>();
    const byMethod = new Map<string, { count: number; amount: number }>();

    for (const sale of sales) {
      const total = cents(sale.total);
      totals.subtotal += cents(sale.subtotal);
      totals.discount += cents(sale.discount);
      totals.sold += total;

      let paid = 0;
      for (const payment of sale.payments) {
        const amount = cents(payment.amount);
        if (payment.verificationStatus === 'REJECTED') {
          totals.rejected += amount;
          continue;
        }
        paid += amount;
        if (payment.verificationStatus === 'VERIFIED') totals.verified += amount;
        else totals.pending += amount;
        const method = byMethod.get(payment.method) ?? { count: 0, amount: 0 };
        method.count += 1;
        method.amount += amount;
        byMethod.set(payment.method, method);
      }
      totals.balance += total - paid;

      const day = daily.get(formatBusinessDay(sale.soldAt));
      if (day) {
        day.count += 1;
        day.total += total;
      }
      const showroom = byShowroom.get(sale.locationId) ?? { count: 0, total: 0 };
      showroom.count += 1;
      showroom.total += total;
      byShowroom.set(sale.locationId, showroom);
      const person = byPerson.get(sale.salespersonId) ?? { count: 0, total: 0 };
      person.count += 1;
      person.total += total;
      byPerson.set(sale.salespersonId, person);

      for (const item of sale.items) {
        totals.units += item.quantity;
        const product = byProduct.get(item.productId) ?? { units: 0, revenue: 0 };
        product.units += item.quantity;
        product.revenue += cents(item.unitPrice) * item.quantity;
        byProduct.set(item.productId, product);
      }
    }

    // names for the ids
    const [locations, people, products] = await Promise.all([
      this.prisma.location.findMany({ where: { id: { in: [...byShowroom.keys()] } }, select: { id: true, name: true } }),
      this.prisma.salesperson.findMany({
        where: { id: { in: [...byPerson.keys()] } },
        select: { id: true, fullName: true, showroom: { select: { name: true } } },
      }),
      this.prisma.product.findMany({
        where: { id: { in: [...byProduct.keys()] } },
        select: { id: true, name: true, sku: true, category: { select: { name: true } } },
      }),
    ]);
    const locationName = new Map(locations.map((row) => [row.id, row.name]));
    const personById = new Map(people.map((row) => [row.id, row]));
    const productById = new Map(products.map((row) => [row.id, row]));

    const byCategory = new Map<string, { units: number; revenue: number }>();
    for (const [productId, figures] of byProduct) {
      const name = productById.get(productId)?.category.name ?? 'Other';
      const entry = byCategory.get(name) ?? { units: 0, revenue: 0 };
      entry.units += figures.units;
      entry.revenue += figures.revenue;
      byCategory.set(name, entry);
    }

    // payments that have waited too long (not limited to the chosen dates: it is always "right now")
    const reminderHours = await this.settings.getNumber('payment_reminder_hours');
    const location = this.locationOf(user, query);
    const overdue = await this.prisma.payment.aggregate({
      where: {
        verificationStatus: 'UNVERIFIED',
        createdAt: { lte: new Date(Date.now() - reminderHours * 3_600_000) },
        sale: { status: 'ACTIVE', ...(location && { locationId: location }) },
      },
      _count: { _all: true },
      _sum: { amount: true },
    });

    return {
      period: { from: range.from, to: range.to, days: range.days },
      totals: {
        sales: totals.sales,
        units: totals.units,
        subtotal: birr(totals.subtotal),
        discount: birr(totals.discount),
        sold: birr(totals.sold),
        verified: birr(totals.verified),
        pending: birr(totals.pending),
        rejected: birr(totals.rejected),
        balance: birr(totals.balance),
      },
      daily: [...daily].map(([date, figures]) => ({ date, count: figures.count, total: birr(figures.total) })),
      byShowroom: [...byShowroom]
        .map(([id, figures]) => ({ id, name: locationName.get(id) ?? 'Unknown', count: figures.count, total: birr(figures.total) }))
        .sort((a, b) => b.total - a.total),
      bySalesperson: [...byPerson]
        .map(([id, figures]) => ({
          id,
          fullName: personById.get(id)?.fullName ?? 'Unknown',
          showroom: personById.get(id)?.showroom.name ?? '',
          count: figures.count,
          total: birr(figures.total),
        }))
        .sort((a, b) => b.total - a.total),
      topProducts: [...byProduct]
        .map(([id, figures]) => ({
          id,
          name: productById.get(id)?.name ?? 'Unknown',
          sku: productById.get(id)?.sku ?? '',
          units: figures.units,
          revenue: birr(figures.revenue),
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
      byCategory: [...byCategory].map(([name, figures]) => ({ name, units: figures.units, revenue: birr(figures.revenue) })).sort((a, b) => b.revenue - a.revenue),
      paymentMethods: [...byMethod].map(([method, figures]) => ({ method, count: figures.count, amount: birr(figures.amount) })).sort((a, b) => b.amount - a.amount),
      overdue: {
        count: overdue._count._all,
        amount: Number((overdue._sum.amount ?? 0).toString()),
        reminderHours,
      },
    };
  }

  // ------------------------------------------------------------------ CSV
  async salesCsv(query: ReportQueryDto, user: AuthUser, ip: string | null) {
    const range = this.range(query);
    const where = this.saleWhere(user, query, range.start, range.end);
    if ((await this.prisma.sale.count({ where })) > MAX_ROWS) {
      throw ruleError(ErrorCode.CONFLICT, 'There are too many sales for one file. Choose a shorter period.');
    }

    const sales = await this.prisma.sale.findMany({
      where,
      orderBy: { soldAt: 'asc' },
      select: {
        code: true,
        soldAt: true,
        status: true,
        paymentStatus: true,
        customerName: true,
        customerPhone: true,
        subtotal: true,
        discount: true,
        discountReason: true,
        total: true,
        location: { select: { name: true } },
        salesperson: { select: { fullName: true } },
        items: { select: { quantity: true } },
        payments: { select: { amount: true, verificationStatus: true } },
      },
    });

    const rows: Array<Array<string | number | null>> = [
      ['Sale code', 'Date', 'Showroom', 'Sold by', 'Customer', 'Phone', 'Items', 'Subtotal', 'Discount', 'Discount reason', 'Total', 'Verified', 'Waiting for verification', 'Still to pay', 'Payment status'],
    ];
    for (const sale of sales) {
      const total = cents(sale.total);
      const verified = sale.payments.filter((p) => p.verificationStatus === 'VERIFIED').reduce((sum, p) => sum + cents(p.amount), 0);
      const pending = sale.payments.filter((p) => p.verificationStatus === 'UNVERIFIED').reduce((sum, p) => sum + cents(p.amount), 0);
      rows.push([
        sale.code,
        formatBusinessDateTime(sale.soldAt),
        sale.location.name,
        sale.salesperson.fullName,
        sale.customerName,
        sale.customerPhone,
        sale.items.reduce((sum, item) => sum + item.quantity, 0),
        birr(cents(sale.subtotal)),
        birr(cents(sale.discount)),
        sale.discountReason,
        birr(total),
        birr(verified),
        birr(pending),
        birr(total - verified - pending),
        sale.paymentStatus,
      ]);
    }

    await this.audit.log({ userId: user.id, action: 'EXPORT', tableName: 'Sale', recordId: 'csv', newValue: { from: range.from, to: range.to, rows: sales.length }, ipAddress: ip });
    return { filename: `sales_${range.from}_to_${range.to}.csv`, body: toCsv(rows) };
  }

  /** Payments RECORDED in the period (by the day they were entered). */
  async paymentsCsv(query: ReportQueryDto, user: AuthUser, ip: string | null) {
    const range = this.range(query);
    const location = this.locationOf(user, query);
    const where: Prisma.PaymentWhereInput = {
      createdAt: { gte: range.start, lt: range.end },
      sale: { ...(location && { locationId: location }), ...(query.salespersonId && { salespersonId: query.salespersonId }) },
    };
    if ((await this.prisma.payment.count({ where })) > MAX_ROWS) {
      throw ruleError(ErrorCode.CONFLICT, 'There are too many payments for one file. Choose a shorter period.');
    }

    const payments = await this.prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        createdAt: true,
        amount: true,
        method: true,
        referenceNo: true,
        verificationStatus: true,
        verifiedAt: true,
        rejectReason: true,
        recordedBy: { select: { fullName: true } },
        verifiedBy: { select: { fullName: true } },
        sale: { select: { code: true, status: true, location: { select: { name: true } }, salesperson: { select: { fullName: true } } } },
      },
    });

    const rows: Array<Array<string | number | null>> = [
      ['Date recorded', 'Sale code', 'Showroom', 'Sold by', 'Method', 'Reference', 'Amount', 'Status', 'Checked by', 'Checked on', 'Rejection reason', 'Recorded by', 'Sale status'],
    ];
    for (const payment of payments) {
      rows.push([
        formatBusinessDateTime(payment.createdAt),
        payment.sale.code,
        payment.sale.location.name,
        payment.sale.salesperson.fullName,
        payment.method,
        payment.referenceNo,
        birr(cents(payment.amount)),
        payment.verificationStatus,
        payment.verifiedBy?.fullName ?? null,
        payment.verifiedAt ? formatBusinessDateTime(payment.verifiedAt) : null,
        payment.rejectReason,
        payment.recordedBy.fullName,
        payment.sale.status,
      ]);
    }

    await this.audit.log({ userId: user.id, action: 'EXPORT', tableName: 'Payment', recordId: 'csv', newValue: { from: range.from, to: range.to, rows: payments.length }, ipAddress: ip });
    return { filename: `payments_${range.from}_to_${range.to}.csv`, body: toCsv(rows) };
  }
}
