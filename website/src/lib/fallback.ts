import type { Page, ProductCard, SiteData } from './types';

const make = (id: string, name: string, category: string, price: number, material: string, description: string): ProductCard => ({
  id,
  name,
  category,
  description,
  material,
  dimensions: null,
  price,
  imageUrl: null,
});

export const DEMO_PRODUCTS: ProductCard[] = [
  make('d1', 'Crown Lounge Chair', 'Chairs', 18500, 'Velvet, gold-finished steel', 'A deep, generous lounge chair with gold legs and a button-tufted back.'),
  make('d2', 'Royal Three-Seater Sofa', 'Sofas', 62000, 'Velvet, solid wood frame', 'Wide, soft and built to last, for living rooms that welcome guests.'),
  make('d3', 'Marquis Dining Table', 'Dining', 48000, 'Solid wood, gold detailing', 'Seats six comfortably, finished by hand in our workshop.'),
  make('d4', 'Aurora Bed Frame', 'Beds', 54000, 'Upholstered headboard, hardwood', 'A tall padded headboard and a sturdy frame, made to your mattress size.'),
  make('d5', 'Heritage Wardrobe', 'Wardrobes', 72000, 'Hardwood, brass handles', 'Three doors, deep shelving and a mirror, finished in a warm walnut tone.'),
  make('d6', 'Sable Coffee Table', 'Dining', 14500, 'Wood and tempered glass', 'A low centre table with a gold frame and a smoked glass top.'),
  make('d7', 'Regent Office Desk', 'Office', 33000, 'Engineered wood, steel', 'A roomy desk with cable access and two drawers.'),
  make('d8', 'Noble Accent Chair', 'Chairs', 12500, 'Fabric, solid wood', 'A compact chair that brings a touch of gold to any corner.'),
];

export const DEMO_SITE: SiteData = {
  stats: { products: 24, categories: 6, showrooms: 3 },
  categories: ['Sofas', 'Beds', 'Dining', 'Chairs', 'Wardrobes', 'Office'].map((name, index) => ({
    id: `demo-${index}`,
    name,
    count: DEMO_PRODUCTS.filter((product) => product.category === name).length,
    imageUrl: null,
  })),
  featured: DEMO_PRODUCTS,
  showrooms: [
    { id: 's1', name: 'Bole Showroom', address: 'Bole, Addis Ababa', phone: null },
    { id: 's2', name: 'Piassa Showroom', address: 'Piassa, Addis Ababa', phone: null },
    { id: 's3', name: 'CMC Showroom', address: 'CMC, Addis Ababa', phone: null },
  ],
  contact: { phone: null, whatsapp: null, hours: null },
  showPrices: true,
};

/** A filtered, paged copy of the demo products, shaped like the real API answer. */
export function demoProducts(category: string, search: string, page: number, pageSize: number): Page<ProductCard> {
  const categoryName = DEMO_SITE.categories.find((item) => item.id === category)?.name;
  const term = search.trim().toLowerCase();
  const matches = DEMO_PRODUCTS.filter(
    (product) =>
      (!categoryName || product.category.toLowerCase() === categoryName.toLowerCase()) &&
      (!term || `${product.name} ${product.category} ${product.material ?? ''}`.toLowerCase().includes(term)),
  );
  const start = (page - 1) * pageSize;
  return { items: matches.slice(start, start + pageSize), total: matches.length, page, pageSize };
}
