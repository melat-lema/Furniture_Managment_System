import type { Role } from './types/roles';

/** Who may add and edit products and categories: the workshop manager (day to day) and the owner (full control). */
export const PRODUCT_MANAGERS: Role[] = ['OWNER', 'WORKSHOP_MANAGER'];

/**
 * Who may look at stock in EVERY location. The owner oversees the whole company; the workshop
 * manager is in charge of stock and needs to see where products are. Store and showroom
 * accounts only see their own location.
 */
export const STOCK_VIEWERS: Role[] = ['OWNER', 'WORKSHOP_MANAGER'];

export function canManageProducts(role: Role): boolean {
  return PRODUCT_MANAGERS.includes(role);
}

export function canViewAllLocations(role: Role): boolean {
  return STOCK_VIEWERS.includes(role);
}
