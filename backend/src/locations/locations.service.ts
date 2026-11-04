import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../common/constants';
import type { AuthUser } from '../common/types/auth-user';
import { duplicateError, notFound, ruleError } from '../common/utils/field-error';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateLocationDto } from './dto/create-location.dto';
import type { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** The owner sees everything. Everyone else only gets the short list needed for dropdowns. */
  async list(user: AuthUser) {
    const orderBy = [{ type: 'asc' as const }, { name: 'asc' as const }];

    if (user.role === 'OWNER') {
      const rows = await this.prisma.location.findMany({
        orderBy,
        include: { _count: { select: { users: true } } },
      });
      return rows.map(({ _count, ...location }) => ({ ...location, userCount: _count.users }));
    }

    return this.prisma.location.findMany({
      where: { isActive: true },
      orderBy,
      select: { id: true, name: true, type: true },
    });
  }

  async create(dto: CreateLocationDto, actor: AuthUser, ip: string | null) {
    await this.assertNameFree(dto.name);

    const location = await this.prisma.location.create({
      data: { name: dto.name, type: dto.type, address: dto.address ?? null, phone: dto.phone ?? null },
    });

    await this.audit.log({
      userId: actor.id,
      action: 'CREATE',
      tableName: 'Location',
      recordId: location.id,
      newValue: { name: location.name, type: location.type },
      ipAddress: ip,
    });
    return location;
  }

  async update(id: string, dto: UpdateLocationDto, actor: AuthUser, ip: string | null) {
    const existing = await this.prisma.location.findUnique({ where: { id } });
    if (!existing) throw notFound('That location');

    if (dto.name !== undefined && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
      await this.assertNameFree(dto.name, id);
    }
    if (dto.isActive === false && existing.isActive) {
      await this.assertCanDeactivate(id);
    }

    const location = await this.prisma.location.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.audit.log({
      userId: actor.id,
      action: dto.isActive === undefined ? 'UPDATE' : dto.isActive ? 'REACTIVATE' : 'DEACTIVATE',
      tableName: 'Location',
      recordId: id,
      oldValue: { name: existing.name, address: existing.address, phone: existing.phone, isActive: existing.isActive },
      newValue: { name: location.name, address: location.address, phone: location.phone, isActive: location.isActive },
      ipAddress: ip,
    });
    return location;
  }

  // ---------------------------------------------------------------- rules
  private async assertNameFree(name: string, excludeId?: string): Promise<void> {
    const clash = await this.prisma.location.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    if (clash) throw duplicateError('name', 'A location with this name already exists.');
  }

  /** A location that still holds goods, or has transfers on the road, cannot be switched off. */
  private async assertCanDeactivate(id: string): Promise<void> {
    const stock = await this.prisma.stockLevel.aggregate({
      where: { locationId: id },
      _sum: { quantity: true },
    });
    const items = stock._sum.quantity ?? 0;
    if (items > 0) {
      throw ruleError(
        ErrorCode.LOCATION_HAS_STOCK,
        `This location still holds ${items} item${items === 1 ? '' : 's'}. Move or sell them before deactivating it.`,
      );
    }

    const inTransit = await this.prisma.transfer.count({
      where: { status: 'IN_TRANSIT', OR: [{ fromLocationId: id }, { toLocationId: id }] },
    });
    if (inTransit > 0) {
      throw ruleError(
        ErrorCode.LOCATION_IN_TRANSIT,
        `${inTransit} transfer${inTransit === 1 ? ' is' : 's are'} still in transit to or from this location. Wait until they are received.`,
      );
    }
  }
}
