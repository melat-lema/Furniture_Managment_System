import { randomBytes } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../common/constants';
import type { AuthUser } from '../common/types/auth-user';
import { businessDayStart, startOfBusinessDay, startOfBusinessMonth } from '../common/utils/dates';
import { fieldError, notFound, ruleError } from '../common/utils/field-error';
import { type Paginated, pageArgs } from '../common/utils/pagination';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { StockLedgerService } from '../stock/stock-ledger.service';
import { detectReceiptType } from '../storage/image-type';
import { StorageService } from '../storage/storage.service';
import type { AddPaymentDto, CreateSaleDto, LeaderboardQueryDto, ListSalesQueryDto, UpdateSaleDto, VoidSaleDto } from './dto/sales.dto';
import { paidOf, statusFor } from './sale-money';

const D = Prisma.Decimal;

const LIST_INCLUDE = {
  location: { select: { id: true, name: true } },
  salesperson: { select: { id: true, fullName: true } },
  items: { select: { quantity: true } },
  payments: { select: { amount: true, verificationStatus: true } },
} satisfies Prisma.SaleInclude;
type ListRow = Prisma.SaleGetPayload<{ include: typeof LIST_INCLUDE }>;

const DETAIL_INCLUDE = {
  location: { select: { id: true, name: true } },
  salesperson: { select: { id: true, fullName: true, isActive: true } },
  recordedBy: { select: { id: true, fullName: true } },
  items: {
    include: { product: { select: { id: true, name: true, sku: true, imagePath: true } } },
    orderBy: { product: { name: 'asc' as const } },
  },
  payments: {
    include: {
      recordedBy: { select: { id: true, fullName: true } },
      verifiedBy: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.SaleInclude;
type DetailRow = Prisma.SaleGetPayload<{ include: typeof DETAIL_INCLUDE }>;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
  ) {}

  // ------------------------------------------------------------------ read
  async list(query: ListSalesQueryDto, user: AuthUser): Promise<Paginated<ReturnType<typeof listRow>>> {
    const and: Prisma.SaleWhereInput[] = [];
    if (user.role !== 'OWNER') and.push({ locationId: user.locationId ?? '__none__' });
    else if (query.locationId) and.push({ locationId: query.locationId });

    if (query.status) and.push({ status: query.status });
    if (query.paymentStatus) and.push({ paymentStatus: query.paymentStatus });
    if (query.unpaid) and.push({ status: 'ACTIVE', paymentStatus: { not: 'PAID' } });
    if (query.salespersonId) and.push({ salespersonId: query.salespersonId });
    if (query.from) and.push({ soldAt: { gte: businessDayStart(query.from) } });
    if (query.to) and.push({ soldAt: { lt: new Date(businessDayStart(query.to).getTime() + 86_400_000) } });
    if (query.search) {
      and.push({
        OR: [
          { code: { contains: query.search, mode: 'insensitive' } },
          { customerName: { contains: query.search, mode: 'insensitive' } },
          { customerPhone: { contains: query.search } },
        ],
      });
    }

    const where: Prisma.SaleWhereInput = and.length > 0 ? { AND: and } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({ where, include: LIST_INCLUDE, orderBy: { soldAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.sale.count({ where }),
    ]);
    return { items: rows.map(listRow), total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: string, user: AuthUser) {
    const windowHours = await this.settings.getNumber('sale_void_window_hours');
    return this.present(await this.load(id, user), user, windowHours);
  }

  /** Numbers for the dashboards (the showroom sees its own, the owner sees everything). */
  async summary(user: AuthUser) {
    const scope: Prisma.SaleWhereInput = {
      status: 'ACTIVE',
      ...(user.role === 'OWNER' ? {} : { locationId: user.locationId ?? '__none__' }),
    };
    const todayStart = startOfBusinessDay();
    const monthStart = startOfBusinessMonth();

    const [today, month, unpaid] = await Promise.all([
      this.prisma.sale.aggregate({ where: { ...scope, soldAt: { gte: todayStart } }, _sum: { total: true }, _count: { _all: true } }),
      this.prisma.sale.aggregate({ where: { ...scope, soldAt: { gte: monthStart } }, _sum: { total: true }, _count: { _all: true } }),
      this.prisma.sale.findMany({
        where: { ...scope, paymentStatus: { not: 'PAID' } },
        select: { total: true, payments: { select: { amount: true, verificationStatus: true } } },
        take: 500,
      }),
    ]);

    const balance = unpaid.reduce((sum, sale) => sum.add(sale.total.sub(paidOf(sale.payments))), new D(0));
    return {
      today: { count: today._count._all, total: (today._sum.total ?? new D(0)).toString() },
      month: { count: month._count._all, total: (month._sum.total ?? new D(0)).toString() },
      unpaid: { count: unpaid.length, balance: balance.toString() },
    };
  }

  // ---------------------------------------------------------------- create
  async create(dto: CreateSaleDto, user: AuthUser, ip: string | null) {
    const showroom = await this.ownShowroom(user);

    // who sold it
    const salesperson = await this.prisma.salesperson.findFirst({ where: { id: dto.salespersonId, showroomId: showroom.id } });
    if (!salesperson) throw fieldError('salespersonId', 'Choose a salesperson from your showroom list.');
    if (!salesperson.isActive) throw fieldError('salespersonId', `${salesperson.fullName} is not active. Choose someone else.`);

    // what was sold: prices always come from the catalog, never from the screen
    const ids = dto.items.map((item) => item.productId);
    if (new Set(ids).size !== ids.length) {
      throw fieldError('items', 'Each product can only appear once. Combine the quantities into one line.');
    }
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, price: true, isActive: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));

    const lines = dto.items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) throw fieldError('items', 'One of the products does not exist any more.');
      if (!product.isActive) throw fieldError('items', `"${product.name}" is inactive and cannot be sold.`);
      return { productId: product.id, name: product.name, quantity: item.quantity, unitPrice: product.price };
    });

    // enough in the showroom? (checked again, safely, when the stock is actually taken below)
    const levels = await this.prisma.stockLevel.findMany({
      where: { locationId: showroom.id, productId: { in: ids } },
      select: { productId: true, quantity: true },
    });
    const available = new Map(levels.map((level) => [level.productId, level.quantity]));
    for (const line of lines) {
      const have = available.get(line.productId) ?? 0;
      if (line.quantity > have) {
        throw ruleError(
          ErrorCode.INSUFFICIENT_STOCK,
          `Not enough stock of "${line.name}": ${have} available in ${showroom.name}, but you are selling ${line.quantity}.`,
        );
      }
    }

    // the money
    const subtotal = lines.reduce((sum, line) => sum.add(line.unitPrice.mul(line.quantity)), new D(0));
    const discount = new D(dto.discount ?? 0);
    if (discount.gt(0)) {
      if (!dto.discountReason || dto.discountReason.length < 3) {
        throw fieldError('discountReason', 'Please give a reason for the discount.');
      }
      if (discount.gte(subtotal)) throw fieldError('discount', 'The discount must be less than the total price.');

      const limit = await this.settings.getNumber('max_discount_percent');
      if (discount.div(subtotal).mul(100).gt(limit)) {
        const message = `A discount of more than ${limit}% is not allowed. Ask the owner if a bigger discount is needed.`;
        throw new ConflictException({ code: ErrorCode.DISCOUNT_LIMIT, message, errors: [{ field: 'discount', message }] });
      }
    }
    const total = subtotal.sub(discount);
    const code = await this.newCode();

    const saleId = await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          code,
          locationId: showroom.id,
          salespersonId: salesperson.id,
          recordedById: user.id,
          customerName: dto.customerName ?? null,
          customerPhone: dto.customerPhone ?? null,
          subtotal,
          discount,
          discountReason: discount.gt(0) ? (dto.discountReason ?? null) : null,
          total,
          items: { create: lines.map((line) => ({ productId: line.productId, quantity: line.quantity, unitPrice: line.unitPrice })) },
        },
        select: { id: true },
      });

      // stock leaves the showroom, through the same ledger as everything else
      for (const line of lines) {
        await this.ledger.applyMovement(tx, {
          productId: line.productId,
          locationId: showroom.id,
          qtyChange: -line.quantity,
          reason: 'SALE',
          refType: 'sale',
          refId: sale.id,
          note: `Sale ${code}`,
          userId: user.id,
          productName: line.name,
        });
      }
      return sale.id;
    });

    await this.audit.log({
      userId: user.id,
      action: 'CREATE',
      tableName: 'Sale',
      recordId: saleId,
      newValue: {
        code,
        total: total.toString(),
        discount: discount.toString(),
        salesperson: salesperson.fullName,
        lines: lines.length,
      },
      ipAddress: ip,
    });
    return this.get(saleId, user);
  }

  // --------------------------------------------------------------- payment
  /** Adds a payment (and its receipt) to a sale. Cash needs no receipt; everything else needs a reference and a receipt. */
  async addPayment(saleId: string, dto: AddPaymentDto, file: Express.Multer.File | undefined, user: AuthUser, ip: string | null) {
    const sale = await this.load(saleId, user);
    if (user.role !== 'SHOWROOM') throw notFound('That sale');
    if (sale.status !== 'ACTIVE') throw ruleError(ErrorCode.SALE_CLOSED, 'This sale was cancelled, so it cannot take payments.');

    const paid = paidOf(sale.payments);
    const balance = sale.total.sub(paid);
    const amount = new D(dto.amount);
    if (balance.lte(0)) throw ruleError(ErrorCode.OVERPAYMENT, 'This sale is already fully paid.');
    if (amount.gt(balance)) {
      const message = `The balance still to pay is ${balance.toString()} birr. A payment cannot be more than that.`;
      throw new ConflictException({ code: ErrorCode.OVERPAYMENT, message, errors: [{ field: 'amount', message }] });
    }

    if (dto.method !== 'CASH') {
      if (!dto.referenceNo) throw fieldError('referenceNo', 'Enter the transaction or reference number from the receipt.');
      if (!file) {
        throw new ConflictException({
          code: ErrorCode.RECEIPT_REQUIRED,
          message: 'Upload the receipt (a photo or a PDF) for this payment.',
          errors: [{ field: 'receipt', message: 'A receipt is required for this payment method.' }],
        });
      }
    }

    let receiptPath: string | null = null;
    if (file) {
      const type = detectReceiptType(file.buffer);
      if (!type) {
        throw fieldError('receipt', 'That file is not a supported receipt. Use a JPEG, PNG or WebP photo, or a PDF.');
      }
      receiptPath = await this.storage.uploadReceipt(sale.id, file.buffer, type);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.create({
          data: {
            saleId: sale.id,
            amount,
            method: dto.method,
            referenceNo: dto.referenceNo ?? null,
            receiptPath,
            recordedById: user.id,
          },
        });
        await tx.sale.update({ where: { id: sale.id }, data: { paymentStatus: statusFor(sale.total, paid.add(amount)) } });
      });
    } catch (error) {
      if (receiptPath) await this.storage.deleteReceipt(receiptPath); // do not leave a loose file behind
      throw error;
    }

    await this.audit.log({
      userId: user.id,
      action: 'PAYMENT_ADD',
      tableName: 'Sale',
      recordId: sale.id,
      newValue: { code: sale.code, amount: amount.toString(), method: dto.method, hasReceipt: receiptPath !== null },
      ipAddress: ip,
    });
    return this.get(sale.id, user);
  }

  /** A short-lived link to open a receipt. Only the owner and the showroom that made the sale may ask for it. */
  async receiptLink(paymentId: string, user: AuthUser, ip: string | null) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { sale: { select: { id: true, code: true, locationId: true } } },
    });
    const allowed = payment && (user.role === 'OWNER' || payment.sale.locationId === user.locationId);
    if (!payment || !allowed || !payment.receiptPath) throw notFound('That receipt');

    const url = await this.storage.signedReceiptUrl(payment.receiptPath, 300);
    await this.audit.log({
      userId: user.id,
      action: 'RECEIPT_VIEW',
      tableName: 'Payment',
      recordId: payment.id,
      newValue: { sale: payment.sale.code },
      ipAddress: ip,
    });
    return { url, expiresInSeconds: 300, kind: payment.receiptPath.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image' };
  }

  // ---------------------------------------------------------------- cancel
  /**
   * Cancels a sale: the goods go back into the showroom stock and its payments stop counting.
   * A showroom can do this for a short time and only while the owner has not verified a payment.
   * After that, only the owner can.
   */
  async void(id: string, dto: VoidSaleDto, user: AuthUser, ip: string | null) {
    const sale = await this.load(id, user);
    const windowHours = await this.settings.getNumber('sale_void_window_hours');
    const blocked = this.voidGate(sale, user, windowHours);
    if (blocked) throw ruleError(sale.status !== 'ACTIVE' ? ErrorCode.SALE_CLOSED : ErrorCode.SALE_LOCKED, blocked);

    await this.prisma.$transaction(async (tx) => {
      const closed = await tx.sale.updateMany({
        where: { id, status: 'ACTIVE' },
        data: { status: 'VOIDED', voidedAt: new Date(), voidedById: user.id, voidReason: dto.reason },
      });
      if (closed.count !== 1) throw ruleError(ErrorCode.SALE_CLOSED, 'This sale was cancelled a moment ago.');

      // money that was recorded no longer counts
      await tx.payment.updateMany({
        where: { saleId: id, verificationStatus: { not: 'REJECTED' } },
        data: { verificationStatus: 'REJECTED', rejectReason: `Sale cancelled: ${dto.reason}` },
      });

      // the goods are back on the showroom shelf
      for (const item of sale.items) {
        await this.ledger.applyMovement(tx, {
          productId: item.productId,
          locationId: sale.locationId,
          qtyChange: item.quantity,
          reason: 'VOID',
          refType: 'sale',
          refId: sale.id,
          note: `Sale ${sale.code} cancelled`,
          userId: user.id,
          productName: item.product.name,
        });
      }
    });

    await this.audit.log({
      userId: user.id,
      action: 'VOID',
      tableName: 'Sale',
      recordId: id,
      newValue: { code: sale.code, reason: dto.reason, total: sale.total.toString() },
      ipAddress: ip,
    });
    return this.get(id, user);
  }

  // ------------------------------------------------------------ correction
  /** Fixes a typo in the customer details, or the person who made the sale. Products and prices never change: cancel and record again. */
  async update(id: string, dto: UpdateSaleDto, user: AuthUser, ip: string | null) {
    const sale = await this.load(id, user);
    const windowHours = await this.settings.getNumber('sale_void_window_hours');
    const blocked = this.editGate(sale, user, windowHours);
    if (blocked) throw ruleError(ErrorCode.SALE_LOCKED, blocked);

    let newPerson: string | null = null;
    if (dto.salespersonId !== undefined && dto.salespersonId !== sale.salesperson.id) {
      const person = await this.prisma.salesperson.findFirst({ where: { id: dto.salespersonId, showroomId: sale.locationId } });
      if (!person) throw fieldError('salespersonId', 'Choose a salesperson from this showroom.');
      if (!person.isActive) throw fieldError('salespersonId', `${person.fullName} is not active. Choose someone else.`);
      newPerson = person.fullName;
    }

    await this.prisma.sale.update({
      where: { id },
      data: {
        ...(dto.customerName !== undefined && { customerName: dto.customerName }),
        ...(dto.customerPhone !== undefined && { customerPhone: dto.customerPhone }),
        ...(dto.salespersonId !== undefined && { salespersonId: dto.salespersonId }),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'UPDATE',
      tableName: 'Sale',
      recordId: id,
      oldValue: { customerName: sale.customerName, customerPhone: sale.customerPhone, salesperson: sale.salesperson.fullName },
      newValue: {
        customerName: dto.customerName ?? sale.customerName,
        customerPhone: dto.customerPhone ?? sale.customerPhone,
        salesperson: newPerson ?? sale.salesperson.fullName,
      },
      ipAddress: ip,
    });
    return this.get(id, user);
  }

  // ----------------------------------------------------------- leaderboard
  /** Sales per salesperson (cancelled sales are left out). The showroom sees its own people; the owner sees everyone. */
  async leaderboard(query: LeaderboardQueryDto, user: AuthUser) {
    const since =
      query.period === 'today' ? startOfBusinessDay() : query.period === 'all' ? undefined : startOfBusinessMonth();
    const where: Prisma.SaleWhereInput = {
      status: 'ACTIVE',
      ...(since && { soldAt: { gte: since } }),
      ...(user.role === 'OWNER' ? (query.locationId ? { locationId: query.locationId } : {}) : { locationId: user.locationId ?? '__none__' }),
    };

    const grouped = await this.prisma.sale.groupBy({
      by: ['salespersonId'],
      where,
      _count: { _all: true },
      _sum: { total: true },
    });
    const people = await this.prisma.salesperson.findMany({
      where: { id: { in: grouped.map((row) => row.salespersonId) } },
      select: { id: true, fullName: true, isActive: true, showroom: { select: { id: true, name: true } } },
    });
    const byId = new Map(people.map((person) => [person.id, person]));

    return grouped
      .flatMap((row) => {
        const person = byId.get(row.salespersonId);
        return person ? [{ salesperson: person, count: row._count._all, total: (row._sum.total ?? new D(0)).toString() }] : [];
      })
      .sort((a, b) => Number(b.total) - Number(a.total));
  }

  // --------------------------------------------------------------- helpers
  private async load(id: string, user: AuthUser): Promise<DetailRow> {
    const row = await this.prisma.sale.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!row || (user.role !== 'OWNER' && row.locationId !== user.locationId)) throw notFound('That sale');
    return row;
  }

  private present(row: DetailRow, user: AuthUser, windowHours: number) {
    const voidBlocked = this.voidGate(row, user, windowHours);
    const editBlocked = this.editGate(row, user, windowHours);
    const paid = paidOf(row.payments);
    const balance = row.total.sub(paid);
    return {
      id: row.id,
      code: row.code,
      status: row.status,
      paymentStatus: row.paymentStatus,
      soldAt: row.soldAt,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      subtotal: row.subtotal.toString(),
      discount: row.discount.toString(),
      discountReason: row.discountReason,
      total: row.total.toString(),
      paid: paid.toString(),
      balance: balance.toString(),
      voidedAt: row.voidedAt,
      voidReason: row.voidReason,
      location: row.location,
      salesperson: row.salesperson,
      recordedBy: row.recordedBy,
      items: row.items.map((item) => ({
        productId: item.productId,
        product: {
          id: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          imageUrl: this.storage.publicUrl(item.product.imagePath),
        },
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        lineTotal: item.unitPrice.mul(item.quantity).toString(),
      })),
      payments: row.payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount.toString(),
        method: payment.method,
        referenceNo: payment.referenceNo,
        hasReceipt: payment.receiptPath !== null,
        verificationStatus: payment.verificationStatus,
        rejectReason: payment.rejectReason,
        createdAt: payment.createdAt,
        verifiedAt: payment.verifiedAt,
        recordedBy: payment.recordedBy,
        verifiedBy: payment.verifiedBy,
      })),
      can: {
        addPayment: user.role === 'SHOWROOM' && row.status === 'ACTIVE' && balance.gt(0),
        void: voidBlocked === null,
        edit: editBlocked === null,
      },
      /** Why this sale cannot be cancelled by this person (null when it can). Shown to the user. */
      voidBlockedReason: row.status === 'ACTIVE' ? voidBlocked : null,
      editBlockedReason: row.status === 'ACTIVE' ? editBlocked : null,
    };
  }

  /** null = allowed. Otherwise the reason in plain words. */
  private voidGate(row: DetailRow, user: AuthUser, windowHours: number): string | null {
    if (row.status !== 'ACTIVE') return 'This sale is already cancelled.';
    if (user.role === 'OWNER') return null;
    const ageHours = (Date.now() - row.soldAt.getTime()) / 3_600_000;
    if (ageHours > windowHours) {
      return `A showroom can only cancel a sale within ${windowHours} hours. Ask the owner to cancel it.`;
    }
    if (row.payments.some((payment) => payment.verificationStatus === 'VERIFIED')) {
      return 'The owner has already verified a payment on this sale, so only the owner can cancel it.';
    }
    return null;
  }

  private editGate(row: DetailRow, user: AuthUser, windowHours: number): string | null {
    if (row.status !== 'ACTIVE') return 'A cancelled sale cannot be changed.';
    if (user.role === 'OWNER') return null;
    const ageHours = (Date.now() - row.soldAt.getTime()) / 3_600_000;
    if (ageHours > windowHours) return `A showroom can only correct a sale within ${windowHours} hours. Ask the owner.`;
    return null;
  }

  private async ownShowroom(user: AuthUser) {
    if (!user.locationId) throw notFound('Your showroom');
    const location = await this.prisma.location.findUnique({ where: { id: user.locationId } });
    if (!location || location.type !== 'SHOWROOM' || !location.isActive) {
      throw ruleError(ErrorCode.SALE_CLOSED, 'Sales can only be recorded at an active showroom.');
    }
    return location;
  }

  private async newCode(): Promise<string> {
    const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = `S-${stamp}-${randomBytes(2).toString('hex').toUpperCase()}`;
      const clash = await this.prisma.sale.findUnique({ where: { code }, select: { id: true } });
      if (!clash) return code;
    }
    throw new Error('Could not generate a unique sale code');
  }
}

function listRow(row: ListRow) {
  const paid = paidOf(row.payments);
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    paymentStatus: row.paymentStatus,
    soldAt: row.soldAt,
    customerName: row.customerName,
    location: row.location,
    salesperson: row.salesperson,
    units: row.items.reduce((sum, item) => sum + item.quantity, 0),
    discount: row.discount.toString(),
    total: row.total.toString(),
    paid: paid.toString(),
    balance: row.total.sub(paid).toString(),
  };
}
