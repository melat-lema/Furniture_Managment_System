import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../common/constants';
import type { AuthUser } from '../common/types/auth-user';
import { duplicateError, notFound, ruleError } from '../common/utils/field-error';
import { PrismaService } from '../prisma/prisma.service';
import type { CategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const rows = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return rows.map(({ _count, ...category }) => ({ ...category, productCount: _count.products }));
  }

  async create(dto: CategoryDto, actor: AuthUser, ip: string | null) {
    await this.assertNameFree(dto.name);
    const category = await this.prisma.category.create({ data: { name: dto.name } });
    await this.audit.log({
      userId: actor.id,
      action: 'CREATE',
      tableName: 'Category',
      recordId: category.id,
      newValue: { name: category.name },
      ipAddress: ip,
    });
    return { ...category, productCount: 0 };
  }

  async update(id: string, dto: CategoryDto, actor: AuthUser, ip: string | null) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw notFound('That category');
    if (dto.name.toLowerCase() !== existing.name.toLowerCase()) await this.assertNameFree(dto.name, id);

    const category = await this.prisma.category.update({ where: { id }, data: { name: dto.name } });
    await this.audit.log({
      userId: actor.id,
      action: 'UPDATE',
      tableName: 'Category',
      recordId: id,
      oldValue: { name: existing.name },
      newValue: { name: category.name },
      ipAddress: ip,
    });
    return category;
  }

  async remove(id: string, actor: AuthUser, ip: string | null): Promise<void> {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) throw notFound('That category');

    const count = existing._count.products;
    if (count > 0) {
      throw ruleError(
        ErrorCode.CATEGORY_IN_USE,
        `This category still has ${count} product${count === 1 ? '' : 's'}. Move them to another category first.`,
      );
    }

    await this.prisma.category.delete({ where: { id } });
    await this.audit.log({
      userId: actor.id,
      action: 'DELETE',
      tableName: 'Category',
      recordId: id,
      oldValue: { name: existing.name },
      ipAddress: ip,
    });
  }

  private async assertNameFree(name: string, excludeId?: string): Promise<void> {
    const clash = await this.prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, ...(excludeId && { id: { not: excludeId } }) },
      select: { id: true },
    });
    if (clash) throw duplicateError('name', 'A category with this name already exists.');
  }
}
