export interface ProductCard {
  id: string;
  name: string;
  category: string;
  description: string | null;
  material: string | null;
  dimensions: string | null;
  /** null when prices are not shown publicly */
  price: number | null;
  imageUrl: string | null;
}

export interface Showroom {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

export interface CategoryCard {
  id: string;
  name: string;
  count: number;
  imageUrl: string | null;
}

export interface SiteData {
  stats: { products: number; categories: number; showrooms: number };
  categories: CategoryCard[];
  featured: ProductCard[];
  showrooms: Showroom[];
  contact: { phone: string | null; whatsapp: string | null; hours: string | null };
  showPrices: boolean;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ChatAction {
  type: 'call' | 'whatsapp' | 'link';
  label: string;
  href: string;
}

export interface ChatReply {
  reply: string;
  products: ProductCard[];
  showrooms: Showroom[];
  suggestions: string[];
  actions: ChatAction[];
}
