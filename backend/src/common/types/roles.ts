export const ROLES = ['OWNER', 'WORKSHOP_MANAGER', 'STORE_MANAGER', 'SHOWROOM'] as const;
export type Role = (typeof ROLES)[number];

export const LOCATION_TYPES = ['WORKSHOP', 'STORE', 'SHOWROOM'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];
