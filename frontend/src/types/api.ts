import type { LocationType, Role } from './auth';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LocationSummary {
  id: string;
  name: string;
  type: LocationType;
}

/** The owner receives all of these; other roles only get id, name and type. */
export interface LocationRecord extends LocationSummary {
  address: string | null;
  phone: string | null;
  isActive: boolean;
  userCount: number;
  createdAt: string;
}

export interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: Role;
  locationId: string | null;
  telegramChatId: string | null;
  isActive: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  location: LocationSummary | null;
  activeSessions: number;
}

export interface CategoryRecord {
  id: string;
  name: string;
  productCount: number;
}

export interface ProductRecord {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  category: { id: string; name: string };
  description: string | null;
  material: string | null;
  dimensions: string | null;
  /** Money arrives as text, for example "12500.00" */
  price: string;
  imagePath: string | null;
  imageUrl: string | null;
  isPublished: boolean;
  isActive: boolean;
  createdAt: string;
}
