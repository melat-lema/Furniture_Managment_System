/**
 * Adds sample categories, products and opening stock (at the workshop) so every screen has
 * something to show. Run AFTER  npm run seed  (it needs the locations and the owner account).
 *
 *   npm run seed:demo
 *
 * Edit prisma/demo-data.ts first if you want the client's real product names and prices.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from './demo-data';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is missing in .env');

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to add demo data when NODE_ENV=production.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main(): Promise<void> {
  const owner = await prisma.user.findFirst({ where: { role: 'OWNER', isActive: true }, orderBy: { createdAt: 'asc' } });
  const workshop = await prisma.location.findFirst({ where: { type: 'WORKSHOP', isActive: true }, orderBy: { createdAt: 'asc' } });
  if (!owner || !workshop) {
    throw new Error('Run "npm run seed" first: the owner account and the workshop do not exist yet.');
  }

  // ---- categories
  const categoryIds = new Map<string, string>();
  for (const name of DEMO_CATEGORIES) {
    const existing = await prisma.category.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
    const category = existing ?? (await prisma.category.create({ data: { name } }));
    categoryIds.set(name, category.id);
  }

  // ---- products and opening stock
  let createdProducts = 0;
  let stockedProducts = 0;

  for (const demo of DEMO_PRODUCTS) {
    const categoryId = categoryIds.get(demo.category);
    if (!categoryId) throw new Error(`Unknown category "${demo.category}" for ${demo.sku}`);

    let product = await prisma.product.findUnique({ where: { sku: demo.sku } });
    if (!product) {
      product = await prisma.product.create({
        data: {
          sku: demo.sku,
          name: demo.name,
          categoryId,
          price: demo.price,
          material: demo.material,
          dimensions: demo.dimensions,
          description: demo.description,
          isPublished: demo.published ?? false,
        },
      });
      createdProducts += 1;
    }

    const alreadyStocked = await prisma.stockMovement.findFirst({
      where: { productId: product.id, locationId: workshop.id, refType: 'demo-seed' },
      select: { id: true },
    });
    if (!alreadyStocked && demo.stock > 0) {
      const productId = product.id;
      await prisma.$transaction(async (tx) => {
        await tx.stockLevel.upsert({
          where: { productId_locationId: { productId, locationId: workshop.id } },
          create: { productId, locationId: workshop.id, quantity: demo.stock },
          update: { quantity: { increment: demo.stock } },
        });
        await tx.stockMovement.create({
          data: {
            productId,
            locationId: workshop.id,
            qtyChange: demo.stock,
            reason: 'PRODUCTION',
            refType: 'demo-seed',
            note: 'Demo opening stock',
            createdById: owner.id,
          },
        });
      });
      stockedProducts += 1;
    }
  }

  console.log(`\nDemo data ready at "${workshop.name}":`);
  console.log(`  categories: ${DEMO_CATEGORIES.length}`);
  console.log(`  products created: ${createdProducts} (of ${DEMO_PRODUCTS.length})`);
  console.log(`  products given opening stock: ${stockedProducts}\n`);
}

main()
  .catch((error: unknown) => {
    console.error('Demo seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
