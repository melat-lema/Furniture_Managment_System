import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../common/constants';
import type { AuthUser } from '../common/types/auth-user';
import type { Role } from '../common/types/roles';
import type { AccessTokenPayload, RefreshTokenPayload } from '../common/types/token-payload';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { PublicUser } from './public-user';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

/** Compared against when the email does not exist, so unknown emails take as long as real ones. */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

type UserWithLocation = Prisma.UserGetPayload<{ include: { location: true } }>;

export interface SessionMeta {
  ip: string | null;
  userAgent: string | null;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: PublicUser;
  tokens: IssuedTokens;
}

function toPublicUser(user: UserWithLocation): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    locationId: user.locationId,
    locationName: user.location?.name ?? null,
    locationType: user.location?.type ?? null,
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.accessTtlSeconds = Number(config.get<string>('ACCESS_TOKEN_TTL_SECONDS') ?? 900);
    this.refreshTtlSeconds = Number(config.get<string>('REFRESH_TOKEN_TTL_DAYS') ?? 7) * 86_400;
  }

  // ---------------------------------------------------------------- login
  async login(dto: LoginDto, meta: SessionMeta): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { location: true },
    });

    // 1. Locked accounts are refused before any password check.
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000));
      await this.audit.log({
        userId: user.id,
        action: 'LOGIN_BLOCKED_LOCKED',
        tableName: 'User',
        recordId: user.id,
        ipAddress: meta.ip,
      });
      throw new HttpException(
        {
          code: ErrorCode.ACCOUNT_LOCKED,
          message: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 2. Always run one password comparison, even for unknown emails (prevents timing leaks).
    const passwordOk = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !passwordOk) {
      const nowLocked = user ? await this.registerFailedAttempt(user.id, user.failedLoginAttempts) : false;
      await this.audit.log({
        userId: user?.id ?? null,
        action: 'LOGIN_FAILED',
        tableName: 'User',
        recordId: user?.id ?? 'unknown',
        newValue: { email: dto.email },
        ipAddress: meta.ip,
      });
      if (nowLocked) {
        throw new HttpException(
          {
            code: ErrorCode.ACCOUNT_LOCKED,
            message: `Too many failed attempts. This account is locked for ${LOCK_MINUTES} minutes.`,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      // Same message for "no such email" and "wrong password" on purpose.
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_CREDENTIALS,
        message: 'Incorrect email or password.',
      });
    }

    // 3. Only people who proved they know the password learn the account state.
    if (!user.isActive) {
      throw new ForbiddenException({
        code: ErrorCode.ACCOUNT_DISABLED,
        message: 'This account has been disabled. Please contact the owner.',
      });
    }
    if (user.location && !user.location.isActive) {
      throw new ForbiddenException({
        code: ErrorCode.LOCATION_DISABLED,
        message: 'This location is no longer active. Please contact the owner.',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const tokens = await this.createSession(user, meta);
    await this.audit.log({
      userId: user.id,
      action: 'LOGIN',
      tableName: 'User',
      recordId: user.id,
      ipAddress: meta.ip,
    });
    return { user: toPublicUser(user), tokens };
  }

  // -------------------------------------------------------------- refresh
  async refresh(token: string | undefined, meta: SessionMeta): Promise<AuthResult> {
    const expired = () =>
      new UnauthorizedException({
        code: ErrorCode.SESSION_EXPIRED,
        message: 'Your session has expired. Please sign in again.',
      });

    if (!token) throw expired();

    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, { secret: this.refreshSecret });
    } catch {
      throw expired();
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: { include: { location: true } } },
    });

    if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= new Date()) {
      throw expired();
    }

    // The token must be the latest one issued for this session (tokens rotate on every refresh).
    if (session.refreshTokenHash !== sha256(token)) {
      await this.audit.log({
        userId: session.userId,
        action: 'REFRESH_TOKEN_MISMATCH',
        tableName: 'Session',
        recordId: session.id,
        ipAddress: meta.ip,
      });
      throw expired();
    }

    const { user } = session;
    if (!user.isActive || (user.location && !user.location.isActive)) {
      await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      throw new ForbiddenException({
        code: ErrorCode.ACCOUNT_DISABLED,
        message: 'This account has been disabled. Please contact the owner.',
      });
    }

    const tokens = await this.signTokens(user, session.id);
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: sha256(tokens.refreshToken),
        // Sliding expiry: a device that keeps being used stays signed in.
        expiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1000),
        userAgent: meta.userAgent ?? session.userAgent,
        ipAddress: meta.ip ?? session.ipAddress,
      },
    });
    return { user: toPublicUser(user), tokens };
  }

  // --------------------------------------------------------------- logout
  /** Idempotent: signing out twice, or with a bad token, is not an error. */
  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, { secret: this.refreshSecret });
      const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
      if (session && !session.revokedAt) {
        await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
        await this.audit.log({
          userId: session.userId,
          action: 'LOGOUT',
          tableName: 'Session',
          recordId: session.id,
        });
      }
    } catch (error) {
      this.logger.debug(`Logout ignored: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ------------------------------------------------------ change password
  async changePassword(user: AuthUser, dto: ChangePasswordDto, meta: SessionMeta): Promise<void> {
    const record = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    const currentOk = await bcrypt.compare(dto.currentPassword, record.passwordHash);
    if (!currentOk) {
      throw new BadRequestException({
        code: ErrorCode.WRONG_PASSWORD,
        message: 'Your current password is incorrect.',
        errors: [{ field: 'currentPassword', message: 'This is not your current password.' }],
      });
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Choose a password you are not already using.',
        errors: [{ field: 'newPassword', message: 'Pick a password different from your current one.' }],
      });
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      // Every other device is signed out; this one stays.
      this.prisma.session.updateMany({
        where: { userId: user.id, id: { not: user.sessionId }, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.log({
      userId: user.id,
      action: 'PASSWORD_CHANGED',
      tableName: 'User',
      recordId: user.id,
      ipAddress: meta.ip,
    });
  }

  // -------------------------------------------------------------- helpers
  private async registerFailedAttempt(userId: string, current: number): Promise<boolean> {
    const attempts = current + 1;
    const lock = attempts >= MAX_FAILED_LOGINS;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: lock ? 0 : attempts,
        lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    return lock;
  }

  private async createSession(user: UserWithLocation, meta: SessionMeta): Promise<IssuedTokens> {
    const sessionId = randomUUID();
    const tokens = await this.signTokens(user, sessionId);
    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: sha256(tokens.refreshToken),
        userAgent: meta.userAgent,
        ipAddress: meta.ip,
        expiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1000),
      },
    });
    void this.cleanupOldSessions(user.id);
    return tokens;
  }

  private async cleanupOldSessions(userId: string): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - 30 * 86_400_000);
      await this.prisma.session.deleteMany({
        where: { userId, OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: cutoff } }] },
      });
    } catch (error) {
      this.logger.warn(`Session cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async signTokens(
    user: { id: string; role: Role; locationId: string | null },
    sessionId: string,
  ): Promise<IssuedTokens> {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      role: user.role,
      locationId: user.locationId,
      sid: sessionId,
    };
    // jti makes every refresh token unique, even if two are issued in the same second.
    const refreshPayload: RefreshTokenPayload = { sub: user.id, sid: sessionId, jti: randomUUID() };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, { secret: this.accessSecret, expiresIn: this.accessTtlSeconds }),
      this.jwt.signAsync(refreshPayload, { secret: this.refreshSecret, expiresIn: this.refreshTtlSeconds }),
    ]);
    return { accessToken, refreshToken };
  }
}
