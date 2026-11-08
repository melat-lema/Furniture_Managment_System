import { randomBytes } from 'node:crypto';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../common/constants';
import { assertLocationAccess } from '../common/location-scope';
import { canViewAllLocations } from '../common/permissions';
import type { AuthUser } from '../common/types/auth-user';
import type { LocationType } from '../common/types/roles';
import type { TransferStatus } from '../common/types/transfer';
import { fieldError, notFound, ruleError } from '../common/utils/field-error';
import { type Paginated, pageArgs } from '../common/utils/pagination';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockLedgerService } from '../stock/stock-ledger.service';
import { StorageService } from '../storage/storage.service';
import type { CreateTransferDto, TransferItemDto, UpdateTransferDto } from './dto/create-transfer.dto';
import type { ListTransfersQueryDto } from './dto/list-transfers-query.dto';
import type { CancelTransferDto, ReceiveTransferDto } from './dto/receive-transfer.dto';

/** The three allowed routes: workshop to store, workshop to showroom, store to showroom. */
const ALLOWED_ROUTES: Record<LocationType, LocationType[]> = {
  WORKSHOP: ['STORE', 'SHOWROOM'],
  STORE: ['SHOWROOM'],
  SHOWROOM: [],
};
const TYPE_LABEL: Record<LocationType, string> = { WORKSHOP: 'workshop', STORE: 'store', SHOWROOM: 'showroom' };

const LOCATION_CARD = { id: true, name: true, type: true } satisfies Prisma.LocationSelect;

const DETAIL_INCLUDE = {
  fromLocation: { select: LOCATION_CARD },
  toLocation: { select: LOCATION_CARD },
  createdBy: { select: { id: true, fullName: true } },
  receivedBy: { select: { id: true, fullName: true } },
  items: {
    include: { product: { select: { id: true, name: true, sku: true, imagePath: true } } },
    orderBy: { product: { name: 'asc' as const } },
  },
} satisfies Prisma.TransferInclude;
type TransferRow = Prisma.TransferGetPayload<{ include: typeof DETAIL_INCLUDE }>;

const LIST_INCLUDE = {
  fromLocation: { select: LOCATION_CARD },
  toLocation: { select: LOCATION_CARD },
  items: { select: { qtySent: true, qtyReceived: true } },
} satisfies Prisma.TransferInclude;

interface Ability {
  isSender: boolean;
  isReceiver: boolean;
  edit: boolean;
  send: boolean;
  cancel: boolean;
  receive: boolean;
}

/** What the signed-in person may do with a transfer right now. */
function abilitiesOf(
  user: AuthUser,
  transfer: { status: TransferStatus; fromLocationId: string; toLocationId: string },
): Ability {
  const mine = user.locationId;
  const isSender = !!mine && mine === transfer.fromLocationId && (user.role === 'WORKSHOP_MANAGER' || user.role === 'STORE_MANAGER');
  const isReceiver = !!mine && mine === transfer.toLocationId && (user.role === 'STORE_MANAGER' || user.role === 'SHOWROOM');
  const open = transfer.status === 'DRAFT' || transfer.status === 'IN_TRANSIT';
  return {
    isSender,
    isReceiver,
    edit: isSender && transfer.status === 'DRAFT',
    send: isSender && transfer.status === 'DRAFT',
    cancel: (isSender || user.role === 'OWNER') && open,
    receive: isReceiver && transfer.status === 'IN_TRANSIT',
  };
}

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  // ------------------------------------------------------------------ read
  async list(query: ListTransfersQueryDto, user: AuthUser) {
    const mine = user.locationId;
    const seesAll = canViewAllLocations(user.role);
    const and: Prisma.TransferWhereInput[] = [];

    if (!seesAll) {
      if (!mine) throw notFound('Your location');
      and.push({ OR: [{ fromLocationId: mine }, { toLocationId: mine }] });
      // other people's drafts are private to the sender
      and.push({ NOT: { status: 'DRAFT', fromLocationId: { not: mine } } });
    }
    if (query.direction && mine) {
      and.push(query.direction === 'incoming' ? { toLocationId: mine } : { fromLocationId: mine });
    }
    if (query.locationId) {
      if (!seesAll) assertLocationAccess(user, query.locationId);
      and.push({ OR: [{ fromLocationId: query.locationId }, { toLocationId: query.locationId }] });
    }
    if (query.status) and.push({ status: query.status });
    if (query.search) and.push({ code: { contains: query.search, mode: 'insensitive' } });

    const where: Prisma.TransferWhereInput = and.length > 0 ? { AND: and } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.transfer.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.transfer.count({ where }),
    ]);

    const result: Paginated<ReturnType<typeof listRow>> = {
      items: rows.map(listRow),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
    return result;
  }

  async get(id: string, user: AuthUser) {
    return this.present(await this.load(id, user), user);
  }

  /** Counts for the dashboards and the sidebar badge. */
  async summary(user: AuthUser) {
    const mine = user.locationId;
    const visible: Prisma.TransferWhereInput = canViewAllLocations(user.role)
      ? {}
      : { OR: [{ fromLocationId: mine ?? '__none__' }, { toLocationId: mine ?? '__none__' }] };
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

    const [inTransit, incomingWaiting, outgoingDrafts, recentDiscrepancies] = await Promise.all([
      this.prisma.transfer.count({ where: { ...visible, status: 'IN_TRANSIT' } }),
      mine ? this.prisma.transfer.count({ where: { toLocationId: mine, status: 'IN_TRANSIT' } }) : 0,
      mine ? this.prisma.transfer.count({ where: { fromLocationId: mine, status: 'DRAFT' } }) : 0,
      this.prisma.transfer.count({
        where: { ...visible, status: 'RECEIVED_WITH_DISCREPANCY', receivedAt: { gte: thirtyDaysAgo } },
      }),
    ]);
    return { inTransit, incomingWaiting, outgoingDrafts, recentDiscrepancies };
  }

  // ---------------------------------------------------------------- create
  async create(dto: CreateTransferDto, user: AuthUser, ip: string | null) {
    const from = await this.ownLocation(user);
    const to = await this.checkDestination(from, dto.toLocationId);
    await this.checkLines(dto.items, from);

    const transfer = await this.prisma.transfer.create({
      data: {
        code: await this.newCode(),
        fromLocationId: from.id,
        toLocationId: to.id,
        createdById: user.id,
        note: dto.note ?? null,
        items: { create: dto.items.map((item) => ({ productId: item.productId, qtySent: item.quantity })) },
      },
      select: { id: true, code: true },
    });

    await this.audit.log({
      userId: user.id,
      action: 'CREATE',
      tableName: 'Transfer',
      recordId: transfer.id,
      newValue: { code: transfer.code, from: from.name, to: to.name, lines: dto.items.length },
      ipAddress: ip,
    });

    if (dto.sendNow) return this.send(transfer.id, user, ip);
    return this.get(transfer.id, user);
  }

  // ---------------------------------------------------------------- update
  /** Only a draft can be changed. Once it is sent, it is cancelled and recreated instead. */
  async update(id: string, dto: UpdateTransferDto, user: AuthUser, ip: string | null) {
    const transfer = await this.load(id, user);
    const can = abilitiesOf(user, transfer);
    if (!can.isSender) throw this.notYours('edit');
    if (!can.edit) throw ruleError(ErrorCode.TRANSFER_STATE, 'Only a draft can be edited. This transfer has already been sent or closed.');

    const from = transfer.fromLocation;
    const toLocationId = dto.toLocationId ?? transfer.toLocationId;
    await this.checkDestination(from, toLocationId);
    if (dto.items) await this.checkLines(dto.items, from);

    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.transfer.updateMany({
        where: { id, status: 'DRAFT' },
        data: { toLocationId, ...(dto.note !== undefined && { note: dto.note }) },
      });
      if (changed.count !== 1) throw ruleError(ErrorCode.TRANSFER_STATE, 'This transfer was sent or cancelled while you were editing it.');

      if (dto.items) {
        await tx.transferItem.deleteMany({ where: { transferId: id } });
        await tx.transferItem.createMany({
          data: dto.items.map((item) => ({ transferId: id, productId: item.productId, qtySent: item.quantity })),
        });
      }
    });

    await this.audit.log({ userId: user.id, action: 'UPDATE', tableName: 'Transfer', recordId: id, ipAddress: ip });
    return this.get(id, user);
  }

  // ------------------------------------------------------------------ send
  /** Stock leaves the sender NOW and the transfer becomes "in transit". */
  async send(id: string, user: AuthUser, ip: string | null) {
    const transfer = await this.load(id, user);
    const can = abilitiesOf(user, transfer);
    if (!can.isSender) throw this.notYours('send');
    if (!can.send) throw ruleError(ErrorCode.TRANSFER_STATE, 'This transfer has already been sent or cancelled.');

    // the route and the destination are checked again, in case something changed since the draft was saved
    await this.checkDestination(transfer.fromLocation, transfer.toLocationId);

    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.transfer.updateMany({
        where: { id, status: 'DRAFT' },
        data: { status: 'IN_TRANSIT', sentAt: new Date() },
      });
      if (moved.count !== 1) throw ruleError(ErrorCode.TRANSFER_STATE, 'This transfer has already been sent or cancelled.');

      for (const item of transfer.items) {
        await this.ledger.applyMovement(tx, {
          productId: item.productId,
          locationId: transfer.fromLocationId,
          qtyChange: -item.qtySent,
          reason: 'TRANSFER_OUT',
          refType: 'transfer',
          refId: transfer.id,
          note: `Transfer ${transfer.code} to ${transfer.toLocation.name}`,
          userId: user.id,
          productName: item.product.name,
        });
      }
    });

    await this.audit.log({
      userId: user.id,
      action: 'SEND',
      tableName: 'Transfer',
      recordId: id,
      newValue: { code: transfer.code, to: transfer.toLocation.name },
      ipAddress: ip,
    });
    return this.get(id, user);
  }

  // --------------------------------------------------------------- receive
  /**
   * The receiving location confirms what actually arrived, line by line.
   * Only what arrived is added to its stock. If anything differs, a note is required and the
   * transfer is marked "received with differences" so the owner can see it.
   */
  async receive(id: string, dto: ReceiveTransferDto, user: AuthUser, ip: string | null) {
    const transfer = await this.load(id, user);
    const can = abilitiesOf(user, transfer);
    if (!can.isReceiver) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN_LOCATION,
        message: 'Only the receiving location can confirm this transfer.',
      });
    }
    if (transfer.status !== 'IN_TRANSIT') {
      throw ruleError(ErrorCode.TRANSFER_STATE, 'This transfer is not waiting to be received.');
    }

    const received = new Map<string, number>();
    for (const item of dto.items) {
      if (received.has(item.productId)) throw fieldError('items', 'Each product can only appear once.');
      received.set(item.productId, item.quantityReceived);
    }
    if (received.size !== transfer.items.length || transfer.items.some((item) => !received.has(item.productId))) {
      throw fieldError('items', 'Confirm every product in this transfer.');
    }

    let differs = false;
    for (const item of transfer.items) {
      const quantity = received.get(item.productId) ?? 0;
      if (quantity > item.qtySent) {
        throw fieldError(
          'items',
          `You cannot receive more than was sent for "${item.product.name}" (${item.qtySent} sent). If more arrived, tell the sender.`,
        );
      }
      if (quantity !== item.qtySent) differs = true;
    }
    if (differs && !dto.note) {
      throw fieldError('note', 'Please explain the difference, for example: 2 arrived damaged, 1 is missing.');
    }

    const status: TransferStatus = differs ? 'RECEIVED_WITH_DISCREPANCY' : 'RECEIVED';

    await this.prisma.$transaction(async (tx) => {
      const closed = await tx.transfer.updateMany({
        where: { id, status: 'IN_TRANSIT' },
        data: {
          status,
          receivedAt: new Date(),
          receivedById: user.id,
          discrepancyNote: differs ? (dto.note ?? null) : null,
        },
      });
      if (closed.count !== 1) throw ruleError(ErrorCode.TRANSFER_STATE, 'This transfer was already received or cancelled.');

      for (const item of transfer.items) {
        const quantity = received.get(item.productId) ?? 0;
        await tx.transferItem.update({
          where: { transferId_productId: { transferId: id, productId: item.productId } },
          data: { qtyReceived: quantity },
        });
        if (quantity > 0) {
          await this.ledger.applyMovement(tx, {
            productId: item.productId,
            locationId: transfer.toLocationId,
            qtyChange: quantity,
            reason: 'TRANSFER_IN',
            refType: 'transfer',
            refId: transfer.id,
            note: `Transfer ${transfer.code} from ${transfer.fromLocation.name}`,
            userId: user.id,
            productName: item.product.name,
          });
        }
      }
    });

    await this.audit.log({
      userId: user.id,
      action: differs ? 'RECEIVE_WITH_DIFFERENCES' : 'RECEIVE',
      tableName: 'Transfer',
      recordId: id,
      newValue: { code: transfer.code, differs, note: differs ? (dto.note ?? null) : null },
      ipAddress: ip,
    });
    return this.get(id, user);
  }

  // ---------------------------------------------------------------- cancel
  /** A draft is simply closed. A transfer already on the road is cancelled and its stock goes back to the sender. */
  async cancel(id: string, dto: CancelTransferDto, user: AuthUser, ip: string | null) {
    const transfer = await this.load(id, user);
    const can = abilitiesOf(user, transfer);
    if (transfer.status !== 'DRAFT' && transfer.status !== 'IN_TRANSIT') {
      throw ruleError(ErrorCode.TRANSFER_STATE, 'This transfer is already closed and cannot be cancelled.');
    }
    if (!can.cancel) throw this.notYours('cancel');

    const wasInTransit = transfer.status === 'IN_TRANSIT';
    const reasonText = dto.reason ? `Cancelled: ${dto.reason}` : 'Cancelled';
    const note = transfer.note ? `${transfer.note} | ${reasonText}` : reasonText;

    await this.prisma.$transaction(async (tx) => {
      const closed = await tx.transfer.updateMany({
        where: { id, status: transfer.status },
        data: { status: 'CANCELLED', note },
      });
      if (closed.count !== 1) throw ruleError(ErrorCode.TRANSFER_STATE, 'This transfer changed while you were cancelling it. Please refresh.');

      if (wasInTransit) {
        for (const item of transfer.items) {
          await this.ledger.applyMovement(tx, {
            productId: item.productId,
            locationId: transfer.fromLocationId,
            qtyChange: item.qtySent,
            reason: 'TRANSFER_IN',
            refType: 'transfer',
            refId: transfer.id,
            note: `Transfer ${transfer.code} cancelled: stock returned`,
            userId: user.id,
            productName: item.product.name,
          });
        }
      }
    });

    await this.audit.log({
      userId: user.id,
      action: 'CANCEL',
      tableName: 'Transfer',
      recordId: id,
      newValue: { code: transfer.code, wasInTransit, reason: dto.reason ?? null },
      ipAddress: ip,
    });
    return this.get(id, user);
  }

  // --------------------------------------------------------------- helpers
  private notYours(action: string): ForbiddenException {
    return new ForbiddenException({
      code: ErrorCode.FORBIDDEN_LOCATION,
      message: `You can only ${action} transfers that belong to your location.`,
    });
  }

  /** Loads a transfer, or 404 if the person has no right to see it (also hides other people's drafts). */
  private async load(id: string, user: AuthUser): Promise<TransferRow> {
    const row = await this.prisma.transfer.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!row) throw notFound('That transfer');

    if (!canViewAllLocations(user.role)) {
      const mine = user.locationId;
      const involved = !!mine && (row.fromLocationId === mine || row.toLocationId === mine);
      const hiddenDraft = row.status === 'DRAFT' && row.fromLocationId !== mine;
      if (!involved || hiddenDraft) throw notFound('That transfer');
    }
    return row;
  }

  private present(row: TransferRow, user: AuthUser) {
    const can = abilitiesOf(user, row);
    const closed = row.status === 'RECEIVED' || row.status === 'RECEIVED_WITH_DISCREPANCY';
    return {
      id: row.id,
      code: row.code,
      status: row.status,
      note: row.note,
      discrepancyNote: row.discrepancyNote,
      createdAt: row.createdAt,
      sentAt: row.sentAt,
      receivedAt: row.receivedAt,
      fromLocation: row.fromLocation,
      toLocation: row.toLocation,
      createdBy: row.createdBy,
      receivedBy: row.receivedBy,
      items: row.items.map((item) => ({
        productId: item.productId,
        product: {
          id: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          imageUrl: this.storage.publicUrl(item.product.imagePath),
        },
        qtySent: item.qtySent,
        qtyReceived: item.qtyReceived,
      })),
      lines: row.items.length,
      unitsSent: row.items.reduce((sum, item) => sum + item.qtySent, 0),
      unitsReceived: closed ? row.items.reduce((sum, item) => sum + (item.qtyReceived ?? 0), 0) : null,
      can: { edit: can.edit, send: can.send, cancel: can.cancel, receive: can.receive },
    };
  }

  /** The sender is always the signed-in manager's own location (a workshop or a store). */
  private async ownLocation(user: AuthUser) {
    if (!user.locationId) throw notFound('Your location');
    const location = await this.prisma.location.findUnique({ where: { id: user.locationId } });
    if (!location || !location.isActive) throw ruleError(ErrorCode.TRANSFER_STATE, 'Your location is not active.');
    return location;
  }

  /** Enforces the three allowed routes. */
  private async checkDestination(from: { id: string; name: string; type: LocationType }, toLocationId: string) {
    const to = await this.prisma.location.findUnique({ where: { id: toLocationId } });
    if (!to) throw fieldError('toLocationId', 'That destination does not exist.');
    if (!to.isActive) throw fieldError('toLocationId', `"${to.name}" is inactive.`);
    if (to.id === from.id) throw fieldError('toLocationId', 'You cannot send goods to the same place they are in.');

    const allowed = ALLOWED_ROUTES[from.type];
    if (!allowed.includes(to.type)) {
      const canSend =
        allowed.length === 0
          ? 'A showroom cannot send goods.'
          : `A ${TYPE_LABEL[from.type]} can send to a ${allowed.map((type) => TYPE_LABEL[type]).join(' or a ')}.`;
      throw fieldError('toLocationId', `Goods cannot go from a ${TYPE_LABEL[from.type]} to a ${TYPE_LABEL[to.type]}. ${canSend}`);
    }
    return to;
  }

  /** Every product exists and is active, appears once, and the sender has enough of it. */
  private async checkLines(items: TransferItemDto[], from: { id: string; name: string }): Promise<void> {
    const ids = items.map((item) => item.productId);
    if (new Set(ids).size !== ids.length) {
      throw fieldError('items', 'Each product can only appear once. Combine the quantities into one line.');
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, isActive: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));

    const levels = await this.prisma.stockLevel.findMany({
      where: { locationId: from.id, productId: { in: ids } },
      select: { productId: true, quantity: true },
    });
    const available = new Map(levels.map((level) => [level.productId, level.quantity]));

    for (const item of items) {
      const product = byId.get(item.productId);
      if (!product) throw fieldError('items', 'One of the products does not exist any more.');
      if (!product.isActive) throw fieldError('items', `"${product.name}" is inactive and cannot be sent.`);

      const have = available.get(item.productId) ?? 0;
      if (item.quantity > have) {
        throw ruleError(
          ErrorCode.INSUFFICIENT_STOCK,
          `Not enough stock of "${product.name}": ${have} available at ${from.name}, but you asked for ${item.quantity}.`,
        );
      }
    }
  }

  private async newCode(): Promise<string> {
    const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, ''); // yymmdd
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = `TR-${stamp}-${randomBytes(2).toString('hex').toUpperCase()}`;
      const clash = await this.prisma.transfer.findUnique({ where: { code }, select: { id: true } });
      if (!clash) return code;
    }
    throw new Error('Could not generate a unique transfer code');
  }
}

type ListRow = Prisma.TransferGetPayload<{ include: typeof LIST_INCLUDE }>;

function listRow(row: ListRow) {
  const closed = row.status === 'RECEIVED' || row.status === 'RECEIVED_WITH_DISCREPANCY';
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    note: row.note,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
    receivedAt: row.receivedAt,
    fromLocation: row.fromLocation,
    toLocation: row.toLocation,
    lines: row.items.length,
    unitsSent: row.items.reduce((sum, item) => sum + item.qtySent, 0),
    unitsReceived: closed ? row.items.reduce((sum, item) => sum + (item.qtyReceived ?? 0), 0) : null,
  };
}
