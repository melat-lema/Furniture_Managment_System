export type Role = 'OWNER' | 'WORKSHOP_MANAGER' | 'STORE_MANAGER' | 'SHOWROOM';
export type LocationType = 'WORKSHOP' | 'STORE' | 'SHOWROOM';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  locationId: string | null;
  locationName: string | null;
  locationType: LocationType | null;
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Owner',
  WORKSHOP_MANAGER: 'Workshop Manager',
  STORE_MANAGER: 'Store Manager',
  SHOWROOM: 'Showroom',
};
