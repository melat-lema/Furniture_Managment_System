import {
  ArrowRightLeft,
  Hammer,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings,
  ShoppingBag,
  Store,
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
}

const dashboard: NavItem = { label: 'Dashboard', to: '/', icon: LayoutDashboard };

/** What each role sees in the sidebar. Turn "soon" off as each page is built. */
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  OWNER: [
    dashboard,
    { label: 'Products', to: '/products', icon: Package, soon: true },
    { label: 'Stock overview', to: '/stock', icon: Warehouse, soon: true },
    { label: 'Transfers', to: '/transfers', icon: ArrowRightLeft, soon: true },
    { label: 'Sales', to: '/sales', icon: ShoppingBag, soon: true },
    { label: 'Payments to verify', to: '/payments', icon: ReceiptText, soon: true },
    { label: 'Users & locations', to: '/admin', icon: Users, soon: true },
    { label: 'Settings', to: '/settings', icon: Settings, soon: true },
  ],
  WORKSHOP_MANAGER: [
    dashboard,
    { label: 'Record production', to: '/production', icon: Hammer, soon: true },
    { label: 'Transfers', to: '/transfers', icon: ArrowRightLeft, soon: true },
    { label: 'Workshop stock', to: '/stock', icon: Warehouse, soon: true },
  ],
  STORE_MANAGER: [
    dashboard,
    { label: 'Incoming transfers', to: '/incoming', icon: ArrowRightLeft, soon: true },
    { label: 'Send to showrooms', to: '/transfers', icon: Store, soon: true },
    { label: 'Store stock', to: '/stock', icon: Warehouse, soon: true },
  ],
  SHOWROOM: [
    dashboard,
    { label: 'New sale', to: '/sales/new', icon: ShoppingBag, soon: true },
    { label: 'My sales', to: '/sales', icon: ReceiptText, soon: true },
    { label: 'Showroom stock', to: '/stock', icon: Warehouse, soon: true },
    { label: 'Incoming transfers', to: '/incoming', icon: ArrowRightLeft, soon: true },
    { label: 'Salespeople', to: '/salespeople', icon: Users, soon: true },
  ],
};
