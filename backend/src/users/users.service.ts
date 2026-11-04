import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../common/constants';
import type { AuthUser } from '../common/types/auth-user';
import type { LocationType, Role } from '../common/types/roles';
import { duplicateError, fieldError, notFound, ruleError } from '../common/utils/field-error';
import { type Paginated, pageArgs } from '../common/utils/pagination';
import { generateTempPassword } from '../common/utils/password';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { ListUsersQueryDto } from './dto/list-users-query.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 12;

/** Never select passwordHash or twoFactorSecret: they must not leave the server. */
const USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  locationId: true,
  telegramChatId: true,
  isActive: true,
  lockedUntil: true,
  lastLoginAt: true,
  createdAt: true,
  location: { select: { id: true, name: true, type: true } },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

const LOCATION_TYPE_FOR_ROLE: Record<Exclude<Role, 'OWNER'>, LocationType> = {
  WORKSHOP_MANAGER: 'WORKSHOP',
  STORE_MANAGER: 'STORE',
  SHOWROOM: 'SHOWROOM',
};

const ROLE_LABEL: Record<Role, string> = {
  OWNER: 'owner',
  WORKSHOP_MANAGER: 'workshop manager',
  STORE_MANAGER: 'store manager',
  SHOWROOM: 'showroom account',
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ----------------------------------------------------------------- list
  async list(query: ListUsersQueryDto): Promise<Paginated<UserRow & { activeSessions: number }>> {
    const where: Prisma.UserWhereInput = {
      ...(query.role && { role: query.role }),
      ...(query.locationId && { locationId: query.locationId }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.search && {
        OR: [
          { fullName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
        ...pageArgs(query),
      }),
      this.prisma.user.count({ where }),
    ]);

    const sessions = await this.prisma.session.groupBy({
      by: ['userId'],
      where: { userId: { in: rows.map((row) => row.id) }, revokedAt: null, expiresAt: { gt: new Date() } },
      _count: { _all: true },
    });
    const sessionCount = new Map(sessions.map((entry) => [entry.userId, entry._count._all]));

    return {
      items: rows.map((row) => ({ ...row, activeSessions: sessionCount.get(row.id) ?? 0 })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  // --------------------------------------------------------------- create
  async create(dto: CreateUserDto, actor: AuthUser, ip: string | null) {
    await this.assertEmailFree(dto.email);
    const locationId = await this.assertRoleAndLocation(dto.role, dto.locationId ?? null);

    const temporaryPassword = generateTempPassword();
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone ?? null,
        role: dto.role,
        locationId,
        telegramChatId: dto.telegramChatId ?? null,
        passwordHash: await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS),
      },
      select: USER_SELECT,
    });

    await this.audit.log({
      userId: actor.id,
      action: 'CREATE',
      tableName: 'User',
      recordId: user.id,
      newValue: { email: user.email, role: user.role, locationId: user.locationId },
      ipAddress: ip,
    });
    // The temporary password is returned this one time only.
    return { user: { ...user, activeSessions: 0 }, temporaryPassword };
  }

  // --------------------------------------------------------------- update
  async update(id: string, dto: UpdateUserDto, actor: AuthUser, ip: string | null) {
    const existing = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!existing) throw notFound('That user');

    if (dto.email !== undefined && dto.email !== existing.email) await this.assertEmailFree(dto.email, id);

    const role = dto.role ?? existing.role;
    if (id === actor.id && dto.role !== undefined && dto.role !== existing.role) {
      throw ruleError(ErrorCode.CANNOT_MODIFY_SELF, 'You cannot change your own role.');
    }
    if (existing.role === 'OWNER' && role !== 'OWNER') await this.assertAnotherActiveOwner(id);

    const changesAssignment = dto.role !== undefined || dto.locationId !== undefined;
    const locationId = changesAssignment
      ? await this.assertRoleAndLocation(role, dto.locationId !== undefined ? dto.locationId : existing.locationId, id)
      : existing.locationId;

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.telegramChatId !== undefined && { telegramChatId: dto.telegramChatId }),
        ...(changesAssignment && { role, locationId }),
      },
      select: USER_SELECT,
    });

    await this.audit.log({
      userId: actor.id,
      action: 'UPDATE',
      tableName: 'User',
      recordId: id,
      oldValue: { fullName: existing.fullName, email: existing.email, role: existing.role, locationId: existing.locationId },
      newValue: { fullName: user.fullName, email: user.email, role: user.role, locationId: user.locationId },
      ipAddress: ip,
    });
    return user;
  }

  // ------------------------------------------------- activate / deactivate
  async setActive(id: string, isActive: boolean, actor: AuthUser, ip: string | null) {
    const existing = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!existing) throw notFound('That user');

    if (!isActive) {
      if (id === actor.id) {
        throw ruleError(ErrorCode.CANNOT_MODIFY_SELF, 'You cannot deactivate your own account.');
      }
      if (existing.role === 'OWNER') await this.assertAnotherActiveOwner(id);
    } else if (existing.role === 'SHOWROOM' && existing.locationId) {
      await this.assertShowroomHasNoOtherLogin(existing.locationId, id);
    }

    const user = await this.prisma.user.update({ where: { id }, data: { isActive }, select: USER_SELECT });
    if (!isActive) await this.revokeAllSessions(id);

    await this.audit.log({
      userId: actor.id,
      action: isActive ? 'REACTIVATE' : 'DEACTIVATE',
      tableName: 'User',
      recordId: id,
      ipAddress: ip,
    });
    return user;
  }

  // ------------------------------------------------------ password & access
  async resetPassword(id: string, actor: AuthUser, ip: string | null) {
    if (id === actor.id) {
      throw ruleError(ErrorCode.CANNOT_MODIFY_SELF, 'Use the Account page to change your own password.');
    }
    const existing = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw notFound('That user');

    const temporaryPassword = generateTempPassword();
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await this.revokeAllSessions(id);

    await this.audit.log({ userId: actor.id, action: 'PASSWORD_RESET', tableName: 'User', recordId: id, ipAddress: ip });
    return { temporaryPassword };
  }

  async forceLogout(id: string, actor: AuthUser, ip: string | null): Promise<{ signedOut: number }> {
    if (id === actor.id) {
      throw ruleError(ErrorCode.CANNOT_MODIFY_SELF, 'Use the Sign out button to end your own session.');
    }
    const existing = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw notFound('That user');

    const signedOut = await this.revokeAllSessions(id);
    await this.audit.log({ userId: actor.id, action: 'FORCE_LOGOUT', tableName: 'User', recordId: id, ipAddress: ip });
    return { signedOut };
  }

  async unlock(id: string, actor: AuthUser, ip: string | null): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw notFound('That user');

    await this.prisma.user.update({ where: { id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    await this.audit.log({ userId: actor.id, action: 'UNLOCK', tableName: 'User', recordId: id, ipAddress: ip });
  }

  // ---------------------------------------------------------------- rules
  private async revokeAllSessions(userId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  private async assertEmailFree(email: string, excludeId?: string): Promise<void> {
    const clash = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, ...(excludeId && { id: { not: excludeId } }) },
      select: { id: true },
    });
    if (clash) throw duplicateError('email', 'Another account already uses this email address.');
  }

  private async assertAnotherActiveOwner(excludeId: string): Promise<void> {
    const others = await this.prisma.user.count({
      where: { role: 'OWNER', isActive: true, id: { not: excludeId } },
    });
    if (others === 0) {
      throw ruleError(ErrorCode.LAST_OWNER, 'There must always be at least one active owner account.');
    }
  }

  private async assertShowroomHasNoOtherLogin(locationId: string, excludeId?: string): Promise<void> {
    const other = await this.prisma.user.findFirst({
      where: { role: 'SHOWROOM', locationId, isActive: true, ...(excludeId && { id: { not: excludeId } }) },
      select: { fullName: true },
    });
    if (other) {
      throw ruleError(
        ErrorCode.LOCATION_ALREADY_HAS_LOGIN,
        `This showroom already has an active login (${other.fullName}). A showroom has one shared login.`,
      );
    }
  }

  /** Checks that the role and location belong together. Returns the location id to store (null for the owner). */
  private async assertRoleAndLocation(role: Role, locationId: string | null, excludeUserId?: string): Promise<string | null> {
    if (role === 'OWNER') {
      if (locationId) throw fieldError('locationId', 'The owner is not tied to a location. Leave it empty.');
      return null;
    }

    if (!locationId) throw fieldError('locationId', `Choose the location for this ${ROLE_LABEL[role]}.`);

    const location = await this.prisma.location.findUnique({ where: { id: locationId } });
    if (!location) throw fieldError('locationId', 'That location does not exist.');
    if (!location.isActive) throw fieldError('locationId', 'That location is inactive. Reactivate it first.');

    const expected = LOCATION_TYPE_FOR_ROLE[role];
    if (location.type !== expected) {
      throw fieldError(
        'locationId',
        `A ${ROLE_LABEL[role]} must belong to a ${expected.toLowerCase()}, but "${location.name}" is a ${location.type.toLowerCase()}.`,
      );
    }

    if (role === 'SHOWROOM') await this.assertShowroomHasNoOtherLogin(locationId, excludeUserId);
    return locationId;
  }
}
