import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { assertLocationAccess } from '../common/location-scope';
import { canViewAllLocations } from '../common/permissions';
import type { AuthUser } from '../common/types/auth-user';
import { ADJUSTMENT_LABEL } from '../common/types/stock';
import { fieldError, notFound } from '../common/utils/field-error';
import { type Paginated, pageArgs } from '../common/utils/pagination';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { AdjustStockDto } from './dto/adjust-stock.dto';
import type { RecordProductionDto } from './dto/record-production.dto';
import type { StockLevelsQueryDto, StockMovementsQueryDto, StockOverviewQueryDto } from './dto/stock-queries.dto';
import { StockLedgerService } from './stock-ledger.service';

const PRODUCT_CARD = {
  id: true,
  name: true,
  sku: true,
  price: true,
  imagePath: true,
  category: { select: { id: true, name: true } },
} satisfies Prisma.ProductSelect;
type ProductCard = Prisma.ProductGetPayload<{ select: typeof PRODUCT_CARD }>;

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  private card(product: ProductCard) {
    const { imagePath, ...rest } = product;
    return { ...rest, imageUrl: this.storage.publicUrl(imagePath) };
  }

  private async lowStockThreshold(): Promise<number> {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'low_stock_threshold' } });
    const value = Number(setting?.value);
    return Number.isInteger(value) && value >= 0 ? value : 3;
  }

  // ------------------------------------------------------------ production
  /** Adds newly finished furniture to the workshop's stock. One submission can hold many products. */
  async recordProduction(dto: RecordProductionDto, user: AuthUser, ip: string | null) {
    // Production is always recorded at the workshop manager's own workshop.
    const locationId = await this.resolveLocation(user, undefined, 'WORKSHOP');
    const products = await this.loadProducts(dto.items.map((item) => item.productId), true);
    const batchId = randomUUID(); // lines recorded together share one reference

    const lines = await this.prisma.$transaction(async (tx) => {
      const done: Array<{ productId: string; name: string; added: number; newQuantity: number }> = [];
      for (const item of dto.items) {
        const product = products.get(item.productId);
        if (!product) throw fieldError('items', 'One of the products does not exist.');
        const newQuantity = await this.ledger.applyMovement(tx, {
          productId: item.productId,
          locationId,
          qtyChange: item.quantity,
          reason: 'PRODUCTION',
          refType: 'production',
          refId: batchId,
          note: dto.note ?? null,
          userId: user.id,
          productName: product.name,
        });
        done.push({ productId: item.productId, name: product.name, added: item.quantity, newQuantity });
      }
      return done;
    });

    await this.audit.log({
      userId: user.id,
      action: 'PRODUCTION',
      tableName: 'StockMovement',
      recordId: batchId,
      newValue: { locationId, lines: lines.map((line) => ({ productId: line.productId, added: line.added })) },
      ipAddress: ip,
    });
    return { locationId, batchId, lines };
  }

  // ------------------------------------------------------------ adjustment
  /** A correction (damaged, miscount, found). Always needs a reason and is always audited. */
  async adjust(dto: AdjustStockDto, user: AuthUser, ip: string | null) {
    const locationId = await this.resolveLocation(user, dto.locationId, null);
    const products = await this.loadProducts([dto.productId], false);
    const product = products.get(dto.productId);
    if (!product) throw fieldError('productId', 'That product does not exist.');

    if (dto.reason === 'OTHER' && !dto.note) {
      throw fieldError('note', 'Please explain what happened.');
    }
    const note = `${ADJUSTMENT_LABEL[dto.reason]}${dto.note ? `: ${dto.note}` : ''}`;

    const newQuantity = await this.prisma.$transaction((tx) =>
      this.ledger.applyMovement(tx, {
        productId: dto.productId,
        locationId,
        qtyChange: dto.quantity,
        reason: 'ADJUSTMENT',
        refType: 'adjustment',
        note,
        userId: user.id,
        productName: product.name,
      }),
    );

    await this.audit.log({
      userId: user.id,
      action: 'STOCK_ADJUSTMENT',
      tableName: 'StockLevel',
      recordId: `${dto.productId}:${locationId}`,
      newValue: { change: dto.quantity, newQuantity, note },
      ipAddress: ip,
    });
    return { productId: dto.productId, locationId, change: dto.quantity, newQuantity };
  }

  // ---------------------------------------------------------------- levels
  /** Stock at ONE location. The owner and workshop manager choose; everyone else gets their own. */
  async levels(query: StockLevelsQueryDto, user: AuthUser) {
    const locationId = this.scopeLocation(user, query.locationId);
    const threshold = await this.lowStockThreshold();

    const where: Prisma.StockLevelWhereInput = {
      locationId,
      ...(query.lowOnly ? { quantity: { lte: threshold } } : query.includeZero ? {} : { quantity: { gt: 0 } }),
      product: {
        ...(query.categoryId && { categoryId: query.categoryId }),
        ...(query.search && {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { sku: { contains: query.search, mode: 'insensitive' } },
          ],
        }),
      },
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockLevel.findMany({
        where,
        include: { product: { select: PRODUCT_CARD } },
        orderBy: { product: { name: 'asc' } },
        ...pageArgs(query),
      }),
      this.prisma.stockLevel.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({ product: this.card(row.product), quantity: row.quantity, updatedAt: row.updatedAt })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      lowStockThreshold: threshold,
    };
  }

  // -------------------------------------------------------------- overview
  /** Owner and workshop manager: every product against every location. */
  async overview(query: StockOverviewQueryDto) {
    const threshold = await this.lowStockThreshold();
    const locations = await this.prisma.location.findMany({
      where: { isActive: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, type: true },
    });

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { sku: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, select: PRODUCT_CARD, orderBy: { name: 'asc' }, ...pageArgs(query) }),
      this.prisma.product.count({ where }),
    ]);

    const levels = await this.prisma.stockLevel.findMany({
      where: { productId: { in: products.map((product) => product.id) } },
      select: { productId: true, locationId: true, quantity: true },
    });

    const byProduct = new Map<string, Record<string, number>>();
    for (const level of levels) {
      const row = byProduct.get(level.productId) ?? {};
      row[level.locationId] = level.quantity;
      byProduct.set(level.productId, row);
    }

    const items = products.map((product) => {
      const quantities = byProduct.get(product.id) ?? {};
      return {
        product: this.card(product),
        quantities,
        total: Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0),
      };
    });

    return { locations, items, total, page: query.page, pageSize: query.pageSize, lowStockThreshold: threshold };
  }

  // ------------------------------------------------------------- movements
  /** The ledger: every change, newest first. */
  async movements(query: StockMovementsQueryDto, user: AuthUser) {
    const locationId = canViewAllLocations(user.role) ? query.locationId : this.scopeLocation(user, query.locationId);

    const where: Prisma.StockMovementWhereInput = {
      ...(locationId && { locationId }),
      ...(query.productId && { productId: query.productId }),
      ...(query.reason && { reason: query.reason }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          location: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true } },
        },
        ...pageArgs(query),
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    const result: Paginated<(typeof rows)[number]> = { items: rows, total, page: query.page, pageSize: query.pageSize };
    return result;
  }

  // --------------------------------------------------------------- summary
  /** For the dashboards: totals per location (owner and workshop manager see all, others their own). */
  async summary(user: AuthUser) {
    const threshold = await this.lowStockThreshold();
    const locations = await this.prisma.location.findMany({
      where: { isActive: true, ...(!canViewAllLocations(user.role) && user.locationId ? { id: user.locationId } : {}) },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, type: true },
    });
    const ids = locations.map((location) => location.id);

    const [totals, lows] = await Promise.all([
      this.prisma.stockLevel.groupBy({
        by: ['locationId'],
        where: { locationId: { in: ids }, quantity: { gt: 0 } },
        _sum: { quantity: true },
        _count: { _all: true },
      }),
      this.prisma.stockLevel.groupBy({
        by: ['locationId'],
        where: { locationId: { in: ids }, quantity: { gt: 0, lte: threshold } },
        _count: { _all: true },
      }),
    ]);

    const totalMap = new Map(totals.map((row) => [row.locationId, row]));
    const lowMap = new Map(lows.map((row) => [row.locationId, row._count._all]));

    return {
      lowStockThreshold: threshold,
      locations: locations.map((location) => ({
        ...location,
        totalItems: totalMap.get(location.id)?._sum.quantity ?? 0,
        productCount: totalMap.get(location.id)?._count._all ?? 0,
        lowStockCount: lowMap.get(location.id) ?? 0,
      })),
    };
  }

  // --------------------------------------------------------------- helpers
  /** Only the owner and the workshop manager may look at other locations; everyone else is limited to their own. */
  private scopeLocation(user: AuthUser, requested?: string): string {
    if (canViewAllLocations(user.role)) {
      if (!requested) throw fieldError('locationId', 'Choose a location.');
      return requested;
    }
    if (!user.locationId) throw notFound('Your location');
    if (requested) assertLocationAccess(user, requested);
    return user.locationId;
  }

  /**
   * Works out which location an action applies to: the manager's own, or (for the owner) the one chosen.
   * `mustBeType` makes sure, for example, that production is only recorded at a workshop.
   */
  private async resolveLocation(
    user: AuthUser,
    requested: string | null | undefined,
    mustBeType: 'WORKSHOP' | null,
  ): Promise<string> {
    let locationId: string;
    if (user.role === 'OWNER') {
      if (!requested) throw fieldError('locationId', mustBeType === 'WORKSHOP' ? 'Choose the workshop.' : 'Choose a location.');
      locationId = requested;
    } else {
      if (!user.locationId) throw notFound('Your location');
      if (requested) assertLocationAccess(user, requested);
      locationId = user.locationId;
    }

    const location = await this.prisma.location.findUnique({ where: { id: locationId } });
    if (!location) throw fieldError('locationId', 'That location does not exist.');
    if (!location.isActive) throw fieldError('locationId', 'That location is inactive.');
    if (mustBeType && location.type !== mustBeType) {
      throw fieldError('locationId', 'Production can only be recorded at a workshop.');
    }
    return locationId;
  }

  private async loadProducts(ids: string[], mustBeActive: boolean) {
    const unique = [...new Set(ids)];
    const rows = await this.prisma.product.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, isActive: true },
    });
    const map = new Map(rows.map((row) => [row.id, row]));

    if (mustBeActive) {
      for (const id of unique) {
        const product = map.get(id);
        if (!product) throw fieldError('items', 'One of the products does not exist any more.');
        if (!product.isActive) {
          throw fieldError('items', `"${product.name}" is inactive. Reactivate it before recording production.`);
        }
      }
    }
    return map;
  }
}
