/**
 * Creates the starting data: 4 locations, 5 accounts (one per role / showroom), a few
 * salespeople and the default settings. Safe to run more than once: it never overwrites
 * existing users or passwords.
 *
 * Run:  npm run seed
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is missing in .env');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const makePassword = (): string => randomBytes(12).toString('base64url'); // 16 random characters

interface SeedUser {
  email: string;
  fullName: string;
  role: 'OWNER' | 'WORKSHOP_MANAGER' | 'STORE_MANAGER' | 'SHOWROOM';
  locationName: string | null;
}

async function main(): Promise<void> {
  // ---- Locations (rename them later from the owner dashboard)
  const locationDefs = [
    { name: 'Main Workshop', type: 'WORKSHOP' },
    { name: 'Main Store', type: 'STORE' },
    { name: 'Showroom 1', type: 'SHOWROOM' },
    { name: 'Showroom 2', type: 'SHOWROOM' },
  ] as const;

  const locations = new Map<string, string>();
  for (const def of locationDefs) {
    const location = await prisma.location.upsert({
      where: { name: def.name },
      update: {},
      create: { name: def.name, type: def.type },
    });
    locations.set(def.name, location.id);
  }

  // ---- Users
  const users: SeedUser[] = [
    {
      email: process.env.SEED_OWNER_EMAIL ?? 'owner@gmail.com',
      fullName: process.env.SEED_OWNER_NAME ?? 'Owner',
      role: 'OWNER',
      locationName: null,
    },
    { email: 'workshop@gmail.com', fullName: 'Workshop Manager', role: 'WORKSHOP_MANAGER', locationName: 'Main Workshop' },
    { email: 'store@gmail.com', fullName: 'Store Manager', role: 'STORE_MANAGER', locationName: 'Main Store' },
    { email: 'showroom1@gmail.com', fullName: 'Showroom 1', role: 'SHOWROOM', locationName: 'Showroom 1' },
    { email: 'showroom2@gmail.com', fullName: 'Showroom 2', role: 'SHOWROOM', locationName: 'Showroom 2' },
  ];

  const report: Array<{ email: string; role: string; password: string }> = [];
  for (const user of users) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    if (existing) {
      report.push({ email: user.email, role: user.role, password: '(already exists, unchanged)' });
      continue;
    }
    const password = makePassword();
    await prisma.user.create({
      data: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        passwordHash: await bcrypt.hash(password, 12),
        locationId: user.locationName ? locations.get(user.locationName) : null,
      },
    });
    report.push({ email: user.email, role: user.role, password });
  }

  // ---- A few salespeople per showroom (for testing the "Sold by" dropdown later)
  for (const showroom of ['Showroom 1', 'Showroom 2']) {
    const showroomId = locations.get(showroom);
    if (!showroomId) continue;
    for (const fullName of ['Salesperson A', 'Salesperson B']) {
      await prisma.salesperson.upsert({
        where: { showroomId_fullName: { showroomId, fullName } },
        update: {},
        create: { showroomId, fullName },
      });
    }
  }

  // ---- Default settings
  const settings = [
    { key: 'reminder_hours', value: '24' },
    { key: 'escalation_hours', value: '48' },
    { key: 'low_stock_threshold', value: '3' },
  ];
  for (const setting of settings) {
    await prisma.setting.upsert({ where: { key: setting.key }, update: {}, create: setting });
  }

  console.log('\nSeed finished. SAVE THESE PASSWORDS NOW. They are shown only once:\n');
  console.table(report);
  console.log('Change them after the first login. Never commit them anywhere.\n');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
