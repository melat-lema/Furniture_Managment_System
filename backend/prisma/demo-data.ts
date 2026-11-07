/**
 * Sample catalog for demos and testing. Edit this file freely: replace the products with the
 * client's real ones (names, codes, prices, materials, sizes), then run:  npm run seed:demo
 * It is safe to run again: products that already exist (same SKU) are left alone.
 */
export const DEMO_CATEGORIES = ['Sofas', 'Beds', 'Dining sets', 'Chairs', 'Wardrobes', 'Office furniture'];

export interface DemoProduct {
  sku: string;
  name: string;
  category: string;
  price: number;
  material: string;
  dimensions: string;
  description: string;
  /** Opening stock recorded at the workshop */
  stock: number;
  published?: boolean;
}

export const DEMO_PRODUCTS: DemoProduct[] = [
  { sku: 'SOFA-001', name: 'Royal 3-Seater Sofa', category: 'Sofas', price: 38500, material: 'Velvet, hardwood frame', dimensions: '220 x 95 x 85 cm', description: 'Deep, comfortable three-seater with carved wooden legs.', stock: 8, published: true },
  { sku: 'SOFA-002', name: 'Corner Sectional Sofa', category: 'Sofas', price: 62000, material: 'Leather', dimensions: '300 x 200 x 90 cm', description: 'L-shaped sofa for large living rooms.', stock: 4, published: true },
  { sku: 'SOFA-003', name: 'Classic 2-Seater Loveseat', category: 'Sofas', price: 24500, material: 'Fabric, hardwood frame', dimensions: '150 x 90 x 85 cm', description: 'Compact seating for smaller spaces.', stock: 10 },
  { sku: 'BED-001', name: 'King Size Bed with Headboard', category: 'Beds', price: 45000, material: 'Oak, upholstered headboard', dimensions: '200 x 180 x 120 cm', description: 'Solid oak frame with a padded headboard.', stock: 6, published: true },
  { sku: 'BED-002', name: 'Queen Size Bed', category: 'Beds', price: 36000, material: 'Oak', dimensions: '200 x 160 x 110 cm', description: 'Simple, sturdy queen bed.', stock: 7 },
  { sku: 'BED-003', name: 'Kids Bunk Bed', category: 'Beds', price: 21500, material: 'Pine', dimensions: '200 x 100 x 170 cm', description: 'Two beds with a safety rail and ladder.', stock: 5 },
  { sku: 'DIN-001', name: '6-Seater Dining Set', category: 'Dining sets', price: 52000, material: 'Solid wood, glass top', dimensions: '180 x 90 x 76 cm', description: 'Table with six cushioned chairs.', stock: 5, published: true },
  { sku: 'DIN-002', name: '4-Seater Dining Set', category: 'Dining sets', price: 31000, material: 'Solid wood', dimensions: '120 x 80 x 76 cm', description: 'Table with four chairs.', stock: 9 },
  { sku: 'CHR-001', name: 'Upholstered Dining Chair', category: 'Chairs', price: 3800, material: 'Fabric, beech legs', dimensions: '45 x 52 x 95 cm', description: 'Sold individually.', stock: 40 },
  { sku: 'CHR-002', name: 'Wooden Rocking Chair', category: 'Chairs', price: 7200, material: 'Hardwood', dimensions: '65 x 90 x 100 cm', description: 'Traditional rocking chair.', stock: 12 },
  { sku: 'WAR-001', name: '3-Door Wardrobe', category: 'Wardrobes', price: 33500, material: 'MDF, mirror', dimensions: '150 x 55 x 200 cm', description: 'Three doors with a central mirror.', stock: 6 },
  { sku: 'WAR-002', name: 'Sliding Door Wardrobe', category: 'Wardrobes', price: 48500, material: 'Wood, mirror', dimensions: '200 x 60 x 220 cm', description: 'Space-saving sliding doors.', stock: 3 },
  { sku: 'OFF-001', name: 'Executive Office Desk', category: 'Office furniture', price: 27500, material: 'Walnut veneer', dimensions: '160 x 80 x 75 cm', description: 'Large desk with three drawers.', stock: 7 },
  { sku: 'OFF-002', name: 'Ergonomic Office Chair', category: 'Office furniture', price: 9800, material: 'Mesh, steel base', dimensions: '65 x 65 x 115 cm', description: 'Adjustable height and back support.', stock: 2 },
];
