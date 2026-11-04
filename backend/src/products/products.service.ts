import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../common/constants';
import type { AuthUser } from '../common/types/auth-user';
import { duplicateError, fieldError, notFound } from '../common/utils/field-error';
import { type Paginated, pageArgs } from '../common/utils/pagination';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { detectImageType } from '../storage/image-type';
import { StorageService } from '../storage/storage.service';
import type { CreateProductDto } from './dto/create-product.dto';
import type { ListProductsQueryDto } from './dto/list-products-query.dto';
import type { UpdateProductDto } from './dto/update-product.dto';

const PRODUCT_INCLUDE = { category: { select: { id: true, name: true } } } satisfies Prisma.ProductInclude;
type ProductRow = Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>;
type ProductView = ProductRow & { imageUrl: string | null };

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  private present(row: ProductRow): ProductView {
    return { ...row, imageUrl: this.storage.publicUrl(row.imagePath) };
  }

  // ----------------------------------------------------------------- read
  async list(query: ListProductsQueryDto, user: AuthUser): Promise<Paginated<ProductView>> {
    // Only the owner can see inactive products.
    const activeFilter: Prisma.ProductWhereInput =
      user.role !== 'OWNER' ? { isActive: true } : query.isActive !== undefined ? { isActive: query.isActive } : {};

    const where: Prisma.ProductWhereInput = {
      ...activeFilter,
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.isPublished !== undefined && { isPublished: query.isPublished }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { sku: { contains: query.search, mode: 'insensitive' } },
          { material: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: query.sort === 'newest' ? { createdAt: 'desc' } : { name: 'asc' },
        ...pageArgs(query),
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items: rows.map((row) => this.present(row)), total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: string, user: AuthUser) {
    const row = await this.prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
    if (!row || (!row.isActive && user.role !== 'OWNER')) throw notFound('That product');
    return this.present(row);
  }

  // ---------------------------------------------------------------- write
  async create(dto: CreateProductDto, actor: AuthUser, ip: string | null) {
    await this.assertSkuFree(dto.sku);
    await this.assertCategoryExists(dto.categoryId);

    const row = await this.prisma.product.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        categoryId: dto.categoryId,
        price: dto.price,
        material: dto.material ?? null,
        dimensions: dto.dimensions ?? null,
        description: dto.description ?? null,
        isPublished: dto.isPublished ?? false,
        isActive: dto.isActive ?? true,
      },
      include: PRODUCT_INCLUDE,
    });

    await this.audit.log({
      userId: actor.id,
      action: 'CREATE',
      tableName: 'Product',
      recordId: row.id,
      newValue: { sku: row.sku, name: row.name, price: row.price.toString() },
      ipAddress: ip,
    });
    return this.present(row);
  }

  async update(id: string, dto: UpdateProductDto, actor: AuthUser, ip: string | null) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw notFound('That product');

    if (dto.sku !== undefined && dto.sku !== existing.sku) await this.assertSkuFree(dto.sku, id);
    if (dto.categoryId !== undefined && dto.categoryId !== existing.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }

    const row = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.material !== undefined && { material: dto.material }),
        ...(dto.dimensions !== undefined && { dimensions: dto.dimensions }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isPublished !== undefined && { isPublished: dto.isPublished }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: PRODUCT_INCLUDE,
    });

    await this.audit.log({
      userId: actor.id,
      action: 'UPDATE',
      tableName: 'Product',
      recordId: id,
      oldValue: {
        sku: existing.sku,
        name: existing.name,
        price: existing.price.toString(),
        isPublished: existing.isPublished,
        isActive: existing.isActive,
      },
      newValue: {
        sku: row.sku,
        name: row.name,
        price: row.price.toString(),
        isPublished: row.isPublished,
        isActive: row.isActive,
      },
      ipAddress: ip,
    });
    return this.present(row);
  }

  // ---------------------------------------------------------------- image
  async setImage(id: string, file: Express.Multer.File | undefined, actor: AuthUser, ip: string | null) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw notFound('That product');
    if (!file) throw fieldError('file', 'Choose an image to upload.');

    const type = detectImageType(file.buffer);
    if (!type) {
      throw new BadRequestException({
        code: ErrorCode.INVALID_FILE,
        message: 'That file is not a supported image. Use a JPEG, PNG or WebP photo.',
        errors: [{ field: 'file', message: 'Unsupported image type.' }],
      });
    }

    const path = await this.storage.uploadProductImage(id, file.buffer, type);

    let row: ProductRow;
    try {
      row = await this.prisma.product.update({ where: { id }, data: { imagePath: path }, include: PRODUCT_INCLUDE });
    } catch (error) {
      await this.storage.deleteProductImage(path); // do not leave an orphan file behind
      throw error;
    }

    if (product.imagePath) await this.storage.deleteProductImage(product.imagePath);

    await this.audit.log({
      userId: actor.id,
      action: 'IMAGE_SET',
      tableName: 'Product',
      recordId: id,
      newValue: { imagePath: path },
      ipAddress: ip,
    });
    return this.present(row);
  }

  async removeImage(id: string, actor: AuthUser, ip: string | null) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw notFound('That product');

    const row = await this.prisma.product.update({ where: { id }, data: { imagePath: null }, include: PRODUCT_INCLUDE });
    if (product.imagePath) await this.storage.deleteProductImage(product.imagePath);

    await this.audit.log({ userId: actor.id, action: 'IMAGE_REMOVED', tableName: 'Product', recordId: id, ipAddress: ip });
    return this.present(row);
  }

  // ---------------------------------------------------------------- rules
  private async assertSkuFree(sku: string, excludeId?: string): Promise<void> {
    const clash = await this.prisma.product.findFirst({
      where: { sku: { equals: sku, mode: 'insensitive' }, ...(excludeId && { id: { not: excludeId } }) },
      select: { id: true },
    });
    if (clash) throw duplicateError('sku', 'Another product already uses this code (SKU).');
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) throw fieldError('categoryId', 'That category does not exist. Choose one from the list.');
  }
}
