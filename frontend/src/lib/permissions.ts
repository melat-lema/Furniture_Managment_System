import type { Role } from '../types/auth';

/** Owner and workshop manager can look at stock in every location. Everyone else sees their own. */
export function canViewAllLocations(role: Role | undefined): boolean {
  return role === 'OWNER' || role === 'WORKSHOP_MANAGER';
}

/** Owner and workshop manager manage the catalog (products, prices, categories). */
export function canManageCatalog(role: Role | undefined): boolean {
  return role === 'OWNER' || role === 'WORKSHOP_MANAGER';
}
