import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/types/auth-user';
import { duplicateError, fieldError, notFound } from '../common/utils/field-error';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSalespersonDto, ListSalespeopleQueryDto, UpdateSalespersonDto } from './dto/salesperson.dto';

const INCLUDE = {
  showroom: { select: { id: true, name: true } },
  _count: { select: { sales: true } },
} satisfies Prisma.SalespersonInclude;
type Row = Prisma.SalespersonGetPayload<{ include: typeof INCLUDE }>;

function present(row: Row) {
  const { _count, pinHash, ...rest } = row;
  void pinHash; // never sent to the browser
  return { ...rest, salesCount: _count.sales };
}

/**
 * The names a showroom picks from in "Sold by". They are NOT logins: the showroom has one shared login,
 * and each sale records who among these people made it.
 */
@Injectable()
export class SalespeopleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListSalespeopleQueryDto, user: AuthUser) {
    const scope: Prisma.SalespersonWhereInput =
      user.role === 'OWNER'
        ? query.showroomId
          ? { showroomId: query.showroomId }
          : {}
        : { showroomId: user.locationId ?? '__none__' };

    const rows = await this.prisma.salesperson.findMany({
      where: { ...scope, ...(query.includeInactive ? {} : { isActive: true }) },
      include: INCLUDE,
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
    });
    return rows.map(present);
  }

  async create(dto: CreateSalespersonDto, user: AuthUser, ip: string | null) {
    const showroomId = await this.resolveShowroom(user, dto.showroomId);
    await this.assertNameFree(showroomId, dto.fullName);

    const row = await this.prisma.salesperson.create({
      data: { showroomId, fullName: dto.fullName, phone: dto.phone ?? null },
      include: INCLUDE,
    });
    await this.audit.log({
      userId: user.id,
      action: 'CREATE',
      tableName: 'Salesperson',
      recordId: row.id,
      newValue: { fullName: row.fullName, showroomId },
      ipAddress: ip,
    });
    return present(row);
  }

  async update(id: string, dto: UpdateSalespersonDto, user: AuthUser, ip: string | null) {
    const existing = await this.prisma.salesperson.findUnique({ where: { id } });
    // another showroom's person looks like "does not exist"
    if (!existing || (user.role !== 'OWNER' && existing.showroomId !== user.locationId)) {
      throw notFound('That salesperson');
    }
    if (dto.fullName !== undefined && dto.fullName.toLowerCase() !== existing.fullName.toLowerCase()) {
      await this.assertNameFree(existing.showroomId, dto.fullName, id);
    }

    const row = await this.prisma.salesperson.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: INCLUDE,
    });
    await this.audit.log({
      userId: user.id,
      action: dto.isActive === undefined ? 'UPDATE' : dto.isActive ? 'REACTIVATE' : 'DEACTIVATE',
      tableName: 'Salesperson',
      recordId: id,
      oldValue: { fullName: existing.fullName, isActive: existing.isActive },
      newValue: { fullName: row.fullName, isActive: row.isActive },
      ipAddress: ip,
    });
    return present(row);
  }

  // ---------------------------------------------------------------- rules
  private async resolveShowroom(user: AuthUser, requested?: string): Promise<string> {
    const id = user.role === 'OWNER' ? requested : user.locationId;
    if (!id) throw fieldError('showroomId', 'Choose a showroom.');

    const showroom = await this.prisma.location.findUnique({ where: { id } });
    if (!showroom || showroom.type !== 'SHOWROOM') throw fieldError('showroomId', 'That is not a showroom.');
    if (!showroom.isActive) throw fieldError('showroomId', 'That showroom is inactive.');
    return showroom.id;
  }

  private async assertNameFree(showroomId: string, fullName: string, excludeId?: string): Promise<void> {
    const clash = await this.prisma.salesperson.findFirst({
      where: { showroomId, fullName: { equals: fullName, mode: 'insensitive' }, ...(excludeId && { id: { not: excludeId } }) },
      select: { id: true },
    });
    if (clash) throw duplicateError('fullName', 'Someone with this name is already on the list.');
  }
}
