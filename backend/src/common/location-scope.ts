import { ForbiddenException } from '@nestjs/common';
import { ErrorCode } from './constants';
import type { AuthUser } from './types/auth-user';

/**
 * Call this in any endpoint that touches one location's data (stock, sales, transfers...).
 * The Owner can access every location; everyone else only their own.
 */
export function assertLocationAccess(user: AuthUser, locationId: string): void {
  if (user.role === 'OWNER') return;
  if (user.locationId !== locationId) {
    throw new ForbiddenException({
      code: ErrorCode.FORBIDDEN_LOCATION,
      message: "You can only access your own location's data.",
    });
  }
}
