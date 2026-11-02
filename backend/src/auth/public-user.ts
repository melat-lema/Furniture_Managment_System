import type { AuthUser } from '../common/types/auth-user';
import type { LocationType, Role } from '../common/types/roles';

/** What the frontend is allowed to know about the logged-in user. */
export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  locationId: string | null;
  locationName: string | null;
  locationType: LocationType | null;
}

export function publicUserFromAuth(user: AuthUser): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    locationId: user.locationId,
    locationName: user.locationName,
    locationType: user.locationType,
  };
}
