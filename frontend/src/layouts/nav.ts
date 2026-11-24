import {
  ArrowRightLeft,
  Building2,
  Hammer,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings,
  ShoppingBag,
  Tags,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '../types/auth';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** true = not built yet; shown greyed out with a "Soon" badge */
  soon?: boolean;
  /** shows a live number next to the label */
  badge?: 'incomingWaiting' | 'paymentsWaiting';
}

const dashboard: NavItem = { label: 'Dashboard', to: '/', icon: LayoutDashboard };
const products: NavItem = { label: 'Products', to: '/products', icon: Package };
const categories: NavItem = { label: 'Categories', to: '/categories', icon: Tags };
const stock: NavItem = { label: 'Stock', to: '/stock', icon: Warehouse };
const production: NavItem = { label: 'Record production', to: '/production', icon: Hammer };
const transfers: NavItem = { label: 'Transfers', to: '/transfers', icon: ArrowRightLeft, badge: 'incomingWaiting' };

/** What each role sees in the sidebar. Turn "soon" off as each page is built. */
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  OWNER: [
    dashboard,
    products,
    categories,
    stock,
    transfers,
    { label: 'Locations', to: '/locations', icon: Building2 },
    { label: 'Users', to: '/users', icon: Users },
    { label: 'Sales', to: '/sales', icon: ShoppingBag },
    { label: 'Salespeople', to: '/salespeople', icon: Users },
    { label: 'Payments to verify', to: '/payments', icon: ReceiptText, badge: 'paymentsWaiting' },
    { label: 'Settings', to: '/settings', icon: Settings },
  ],
  WORKSHOP_MANAGER: [dashboard, products, categories, production, stock, transfers],
  STORE_MANAGER: [dashboard, products, stock, transfers],
  SHOWROOM: [
    dashboard,
    products,
    stock,
    transfers,
    { label: 'New sale', to: '/sales/new', icon: ShoppingBag },
    { label: 'My sales', to: '/sales', icon: ReceiptText },
    { label: 'Salespeople', to: '/salespeople', icon: Users },
  ],
};
