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

// ------------------------------------------------------------------ Day 5: stock
export type MovementReason =
  | 'PRODUCTION'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'SALE'
  | 'VOID'
  | 'RETURN'
  | 'ADJUSTMENT';

export interface StockProduct {
  id: string;
  name: string;
  sku: string;
  price: string;
  imageUrl: string | null;
  category: { id: string; name: string };
}

export interface StockLevelRow {
  product: StockProduct;
  quantity: number;
  updatedAt: string;
}

export interface StockLevelsPage extends Paginated<StockLevelRow> {
  lowStockThreshold: number;
}

export interface StockOverviewRow {
  product: StockProduct;
  /** quantity per location id */
  quantities: Record<string, number>;
  total: number;
}

export interface StockOverviewPage extends Paginated<StockOverviewRow> {
  locations: LocationSummary[];
  lowStockThreshold: number;
}

export interface MovementRow {
  id: string;
  createdAt: string;
  qtyChange: number;
  reason: MovementReason;
  note: string | null;
  refType: string | null;
  product: { id: string; name: string; sku: string };
  location: { id: string; name: string };
  createdBy: { id: string; fullName: string };
}

export interface StockSummary {
  lowStockThreshold: number;
  locations: Array<LocationSummary & { totalItems: number; productCount: number; lowStockCount: number }>;
}

export interface ProductionResult {
  locationId: string;
  batchId: string;
  lines: Array<{ productId: string; name: string; added: number; newQuantity: number }>;
}

export interface PriceChange {
  id: string;
  productId: string;
  name: string | null;
  oldPrice: string;
  newPrice: string;
  changedBy: string;
  at: string;
}

// ------------------------------------------------------------------ Day 7 and 8: transfers
export type TransferStatus = 'DRAFT' | 'IN_TRANSIT' | 'RECEIVED' | 'RECEIVED_WITH_DISCREPANCY' | 'CANCELLED';

export interface TransferListRow {
  id: string;
  code: string;
  status: TransferStatus;
  note: string | null;
  createdAt: string;
  sentAt: string | null;
  receivedAt: string | null;
  fromLocation: LocationSummary;
  toLocation: LocationSummary;
  lines: number;
  unitsSent: number;
  unitsReceived: number | null;
}

export interface TransferItemView {
  productId: string;
  product: { id: string; name: string; sku: string; imageUrl: string | null };
  qtySent: number;
  qtyReceived: number | null;
}

export interface TransferDetail extends TransferListRow {
  discrepancyNote: string | null;
  createdBy: { id: string; fullName: string };
  receivedBy: { id: string; fullName: string } | null;
  items: TransferItemView[];
  /** what the signed-in person may do with it right now */
  can: { edit: boolean; send: boolean; cancel: boolean; receive: boolean };
}

export interface TransferSummary {
  inTransit: number;
  incomingWaiting: number;
  outgoingDrafts: number;
  recentDiscrepancies: number;
}

// ------------------------------------------------------------------ Week 2 finish: low stock
export interface LowStockRow {
  product: StockProduct;
  location: LocationSummary;
  quantity: number;
}

export interface LowStockPage {
  lowStockThreshold: number;
  total: number;
  items: LowStockRow[];
}

// ------------------------------------------------------------------ Week 3: salespeople, sales, payments
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'TELEBIRR' | 'CBE_BIRR' | 'OTHER';
export type SalePaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID';
export type VerificationStatus = 'UNVERIFIED' | 'VERIFIED' | 'REJECTED';

export interface SalespersonRecord {
  id: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  showroomId: string;
  showroom: { id: string; name: string };
  salesCount: number;
  createdAt: string;
}

export interface SaleListRow {
  id: string;
  code: string;
  status: 'ACTIVE' | 'VOIDED';
  paymentStatus: SalePaymentStatus;
  soldAt: string;
  customerName: string | null;
  location: { id: string; name: string };
  salesperson: { id: string; fullName: string };
  units: number;
  discount: string;
  total: string;
  paid: string;
  balance: string;
}

export interface PaymentView {
  id: string;
  amount: string;
  method: PaymentMethod;
  referenceNo: string | null;
  hasReceipt: boolean;
  verificationStatus: VerificationStatus;
  rejectReason: string | null;
  createdAt: string;
  verifiedAt: string | null;
  recordedBy: { id: string; fullName: string };
  verifiedBy: { id: string; fullName: string } | null;
}

export interface SaleDetail {
  id: string;
  code: string;
  status: 'ACTIVE' | 'VOIDED';
  paymentStatus: SalePaymentStatus;
  soldAt: string;
  customerName: string | null;
  customerPhone: string | null;
  subtotal: string;
  discount: string;
  discountReason: string | null;
  total: string;
  paid: string;
  balance: string;
  voidedAt: string | null;
  voidReason: string | null;
  location: { id: string; name: string };
  salesperson: { id: string; fullName: string; isActive: boolean };
  recordedBy: { id: string; fullName: string };
  items: Array<{
    productId: string;
    product: { id: string; name: string; sku: string; imageUrl: string | null };
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  payments: PaymentView[];
  can: { addPayment: boolean };
}

export interface SalesSummary {
  today: { count: number; total: string };
  month: { count: number; total: string };
  unpaid: { count: number; balance: string };
}

export interface SettingRecord {
  key: 'low_stock_threshold' | 'max_discount_percent';
  label: string;
  description: string;
  unit: string;
  min: number;
  max: number;
  fallback: number;
  value: number;
}

export interface ReceiptLink {
  url: string;
  expiresInSeconds: number;
  kind: 'pdf' | 'image';
}
