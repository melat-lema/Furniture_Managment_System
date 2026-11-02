import type { Role } from './roles';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  locationId: string | null;
  sid: string;
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  jti: string;
}
