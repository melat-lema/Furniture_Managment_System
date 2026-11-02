import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '../constants';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthedRequest } from '../types/auth-user';
import type { Role } from '../types/roles';

/** Runs after JwtAuthGuard. Enforces @Roles(...) when a route has it. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<AuthedRequest>();
    if (!user) {
      throw new UnauthorizedException({ code: ErrorCode.UNAUTHENTICATED, message: 'Please sign in to continue.' });
    }
    if (!required.includes(user.role)) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN_ROLE,
        message: "You don't have permission to do this.",
      });
    }
    return true;
  }
}
