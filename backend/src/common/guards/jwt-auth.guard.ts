import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ACCESS_COOKIE, ErrorCode } from '../constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthedRequest } from '../types/auth-user';
import type { AccessTokenPayload } from '../types/token-payload';

/**
 * Runs before every route (registered globally in AppModule).
 * 1. Reads the access token from the httpOnly cookie (or an Authorization header, handy for testing).
 * 2. Verifies the signature and expiry.
 * 3. Checks the database: the session must still be active and the user and location enabled.
 *    This is what lets the owner log somebody out or disable an account instantly.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException({ code: ErrorCode.UNAUTHENTICATED, message: 'Please sign in to continue.' });
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          code: ErrorCode.TOKEN_EXPIRED,
          message: 'Your session needs to be refreshed.',
        });
      }
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Your session is not valid. Please sign in again.',
      });
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: { include: { location: true } } },
    });

    if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException({
        code: ErrorCode.SESSION_REVOKED,
        message: 'You have been signed out. Please sign in again.',
      });
    }

    const { user } = session;
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

    (request as AuthedRequest).user = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      locationId: user.locationId,
      locationName: user.location?.name ?? null,
      locationType: user.location?.type ?? null,
      sessionId: session.id,
    };
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    const fromCookie = cookies?.[ACCESS_COOKIE];
    if (fromCookie) return fromCookie;

    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }
}
