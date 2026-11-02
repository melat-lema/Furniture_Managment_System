import type { Request } from 'express';
import type { LocationType, Role } from './roles';

/** The logged-in user, attached to every authenticated request by JwtAuthGuard. */
export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  locationId: string | null;
  locationName: string | null;
  locationType: LocationType | null;
  sessionId: string;
}

export type AuthedRequest = Request & { user: AuthUser };
