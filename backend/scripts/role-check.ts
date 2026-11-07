/**
 * ROLE ACCESS TEST. Proves that every role can do what it should, and is refused everything else.
 *
 *   1. start the backend:   npm run start:dev
 *   2. in another terminal: npm run role-check
 *
 * It creates temporary locations, accounts, categories and products (all named ZZRC...), runs
 * about 70 checks against the REAL API, prints PASS/FAIL for each, and then deletes everything
 * it created. It never touches your real data.
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';

type RoleKey = 'OWNER' | 'WORKSHOP_MANAGER' | 'STORE_MANAGER' | 'SHOWROOM';
const ROLES: RoleKey[] = ['OWNER', 'WORKSHOP_MANAGER', 'STORE_MANAGER', 'SHOWROOM'];

const API = process.env.ROLE_CHECK_API ?? `http://localhost:${process.env.PORT ?? 3000}/api`;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is missing in .env');
if (process.env.NODE_ENV === 'production') throw new Error('Do not run the role check in production.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const tag = `ZZRC${Date.now().toString(36).toUpperCase()}`;

interface Account {
  role: RoleKey;
  id: string;
  email: string;
  password: string;
  locationId: string | null;
  token: string;
}
interface ApiResponse {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

const accounts = {} as Record<RoleKey, Account>;
const results: Array<{ name: string; ok: boolean; detail: string }> = [];

// ------------------------------------------------------------------ helpers
async function call(who: Account | null, method: string, path: string, body?: unknown): Promise<ApiResponse> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (who) headers.Authorization = `Bearer ${who.token}`;

  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, body: json };
}

function record(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `   -> ${detail}`}`);
}

/** Checks the HTTP status (and optionally the error code). */
function expectStatus(name: string, res: ApiResponse, status: number, code?: string): void {
  const codeOk = code === undefined || res.body?.code === code;
  record(
    name,
    res.status === status && codeOk,
    `expected ${status}${code ? ` ${code}` : ''}, got ${res.status}${res.body?.code ? ` ${res.body.code}` : ''}${res.body?.message ? ` (${res.body.message})` : ''}`,
  );
}

async function login(account: Account): Promise<void> {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  if (!response.ok) throw new Error(`Login failed for ${account.role}: ${response.status} ${await response.text()}`);

  const cookies = (response.headers as unknown as { getSetCookie(): string[] }).getSetCookie();
  const access = cookies.find((cookie) => cookie.startsWith('gf_access='));
  if (!access) throw new Error(`No access cookie returned for ${account.role}`);
  account.token = access.split(';')[0].slice('gf_access='.length);
}

// ------------------------------------------------------------------ setup & cleanup
async function setup() {
  const workshop = await prisma.location.create({ data: { name: `${tag} Workshop`, type: 'WORKSHOP' } });
  const store = await prisma.location.create({ data: { name: `${tag} Store`, type: 'STORE' } });
  const showroom = await prisma.location.create({ data: { name: `${tag} Showroom`, type: 'SHOWROOM' } });

  const placement: Record<RoleKey, string | null> = {
    OWNER: null,
    WORKSHOP_MANAGER: workshop.id,
    STORE_MANAGER: store.id,
    SHOWROOM: showroom.id,
  };

  for (const role of ROLES) {
    const password = randomBytes(9).toString('base64url');
    const email = `${tag.toLowerCase()}-${role.toLowerCase()}@rolecheck.test`;
    const user = await prisma.user.create({
      data: {
        fullName: `${tag} ${role}`,
        email,
        role,
        locationId: placement[role],
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    accounts[role] = { role, id: user.id, email, password, locationId: placement[role], token: '' };
  }
  for (const role of ROLES) await login(accounts[role]);

  return { workshop, store, showroom };
}

async function cleanup(): Promise<void> {
  const products = await prisma.product.findMany({ where: { sku: { startsWith: tag } }, select: { id: true } });
  const productIds = products.map((product) => product.id);
  await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.stockLevel.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.category.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: tag.toLowerCase() } } });
  await prisma.location.deleteMany({ where: { name: { startsWith: tag } } });
}

// ------------------------------------------------------------------ the checks
async function run(): Promise<void> {
  const { workshop, store, showroom } = await setup();
  const owner = accounts.OWNER;
  const workshopMgr = accounts.WORKSHOP_MANAGER;
  const storeMgr = accounts.STORE_MANAGER;
  const showroomAcc = accounts.SHOWROOM;

  console.log(`\nRole check against ${API} (test data tag: ${tag})\n`);

  // ---- signed-out
  expectStatus('Signed-out visitor cannot read products', await call(null, 'GET', '/products'), 401, 'UNAUTHENTICATED');
  expectStatus('Signed-out visitor cannot read stock', await call(null, 'GET', '/stock/summary'), 401);

  // ---- reading: allowed for every signed-in role
  for (const role of ROLES) {
    const who = accounts[role];
    const levelsPath = role === 'OWNER' || role === 'WORKSHOP_MANAGER' ? `/stock/levels?locationId=${workshop.id}` : '/stock/levels';
    expectStatus(`${role}: can read locations`, await call(who, 'GET', '/locations'), 200);
    expectStatus(`${role}: can read categories`, await call(who, 'GET', '/categories'), 200);
    expectStatus(`${role}: can read products`, await call(who, 'GET', '/products'), 200);
    expectStatus(`${role}: can read own stock`, await call(who, 'GET', levelsPath), 200);
    expectStatus(`${role}: can read the stock history`, await call(who, 'GET', '/stock/movements'), 200);
    expectStatus(`${role}: can read the dashboard summary`, await call(who, 'GET', '/stock/summary'), 200);
  }

  // ---- owner-only reads, and reads for the owner and workshop manager
  for (const role of ROLES) {
    const who = accounts[role];
    const ownerOnly = role === 'OWNER' ? 200 : 403;
    const seesAll = role === 'OWNER' || role === 'WORKSHOP_MANAGER' ? 200 : 403;
    expectStatus(`${role}: users list ${ownerOnly === 200 ? 'allowed' : 'refused'}`, await call(who, 'GET', '/users'), ownerOnly);
    expectStatus(`${role}: price-change feed ${ownerOnly === 200 ? 'allowed' : 'refused'}`, await call(who, 'GET', '/products/price-changes'), ownerOnly);
    expectStatus(`${role}: all-location stock overview ${seesAll === 200 ? 'allowed' : 'refused'}`, await call(who, 'GET', '/stock/overview'), seesAll);
  }
  expectStatus('WORKSHOP_MANAGER: can read the store stock', await call(workshopMgr, 'GET', `/stock/levels?locationId=${store.id}`), 200);
  expectStatus('WORKSHOP_MANAGER: can read the store history', await call(workshopMgr, 'GET', `/stock/movements?locationId=${store.id}`), 200);
  expectStatus('WORKSHOP_MANAGER must choose a location for stock levels', await call(workshopMgr, 'GET', '/stock/levels'), 400);
  expectStatus('STORE_MANAGER cannot read the showroom stock', await call(storeMgr, 'GET', `/stock/levels?locationId=${showroom.id}`), 403, 'FORBIDDEN_LOCATION');

  // ---- locations
  expectStatus('OWNER: can create a location', await call(owner, 'POST', '/locations', { name: `${tag} Extra`, type: 'STORE' }), 201);
  for (const who of [workshopMgr, storeMgr, showroomAcc]) {
    expectStatus(`${who.role}: cannot create a location`, await call(who, 'POST', '/locations', { name: `${tag} Nope ${who.role}`, type: 'STORE' }), 403, 'FORBIDDEN_ROLE');
  }

  // ---- categories
  const catOwner = await call(owner, 'POST', '/categories', { name: `${tag} Cat O` });
  expectStatus('OWNER: can add a category', catOwner, 201);
  const catWorkshop = await call(workshopMgr, 'POST', '/categories', { name: `${tag} Cat W` });
  expectStatus('WORKSHOP_MANAGER: can add a category', catWorkshop, 201);
  expectStatus('STORE_MANAGER: cannot add a category', await call(storeMgr, 'POST', '/categories', { name: `${tag} Cat S` }), 403);
  expectStatus('SHOWROOM: cannot add a category', await call(showroomAcc, 'POST', '/categories', { name: `${tag} Cat R` }), 403);
  expectStatus('Duplicate category name is rejected', await call(owner, 'POST', '/categories', { name: `${tag} cat o` }), 409, 'UNIQUE_CONSTRAINT');
  expectStatus('STORE_MANAGER: cannot delete a category', await call(storeMgr, 'DELETE', `/categories/${catOwner.body?.id}`), 403);
  expectStatus('OWNER: can delete an empty category', await call(owner, 'DELETE', `/categories/${catOwner.body?.id}`), 204);
  const catExtra = await call(workshopMgr, 'POST', '/categories', { name: `${tag} Cat W2` });
  expectStatus('WORKSHOP_MANAGER: can delete an empty category', await call(workshopMgr, 'DELETE', `/categories/${catExtra.body?.id}`), 204);

  // ---- products
  const categoryId: string = catWorkshop.body?.id;
  const productOwner = await call(owner, 'POST', '/products', { name: `${tag} Owner sofa`, sku: `${tag}-O`, categoryId, price: 1000 });
  expectStatus('OWNER: can add a product', productOwner, 201);
  const productWorkshop = await call(workshopMgr, 'POST', '/products', { name: `${tag} Workshop sofa`, sku: `${tag}-W`, categoryId, price: 2000 });
  expectStatus('WORKSHOP_MANAGER: can add a product (with a price)', productWorkshop, 201);
  expectStatus('STORE_MANAGER: cannot add a product', await call(storeMgr, 'POST', '/products', { name: `${tag} S`, sku: `${tag}-S`, categoryId, price: 5 }), 403);
  expectStatus('SHOWROOM: cannot add a product', await call(showroomAcc, 'POST', '/products', { name: `${tag} R`, sku: `${tag}-R`, categoryId, price: 5 }), 403);
  expectStatus('Duplicate SKU is rejected', await call(workshopMgr, 'POST', '/products', { name: `${tag} Dup`, sku: `${tag}-w`, categoryId, price: 5 }), 409, 'UNIQUE_CONSTRAINT');
  const badPrice = await call(workshopMgr, 'POST', '/products', { name: `${tag} Bad`, sku: `${tag}-B`, categoryId, price: -5 });
  expectStatus('Negative price is rejected with a field error', badPrice, 400, 'VALIDATION_ERROR');
  record('...and the error points at the "price" field', badPrice.body?.errors?.[0]?.field === 'price', JSON.stringify(badPrice.body?.errors));

  const pW: string = productWorkshop.body?.id;
  expectStatus('WORKSHOP_MANAGER: can change a price', await call(workshopMgr, 'PATCH', `/products/${pW}`, { price: 2500 }), 200);
  const feed = await call(owner, 'GET', '/products/price-changes');
  const seen = Array.isArray(feed.body) && feed.body.some((c: { productId: string; newPrice: string }) => c.productId === pW && Number(c.newPrice) === 2500);
  record('OWNER sees the workshop price change in the feed', seen, 'the change was not listed');

  // ---- stock: production
  const prod = (who: Account, body: unknown) => call(who, 'POST', '/stock/production', body);
  expectStatus('WORKSHOP_MANAGER: can record production', await prod(workshopMgr, { items: [{ productId: pW, quantity: 10 }] }), 201);
  expectStatus('STORE_MANAGER: cannot record production', await prod(storeMgr, { items: [{ productId: pW, quantity: 1 }] }), 403);
  expectStatus('SHOWROOM: cannot record production', await prod(showroomAcc, { items: [{ productId: pW, quantity: 1 }] }), 403);
  expectStatus('OWNER: cannot record production (the workshop does that)', await prod(owner, { items: [{ productId: pW, quantity: 1 }] }), 403, 'FORBIDDEN_ROLE');
  expectStatus('WORKSHOP_MANAGER: can record a second batch', await prod(workshopMgr, { items: [{ productId: pW, quantity: 5 }], note: 'second batch' }), 201);
  const zero = await prod(workshopMgr, { items: [{ productId: pW, quantity: 0 }] });
  expectStatus('Quantity 0 is rejected', zero, 400, 'VALIDATION_ERROR');
  record('...and the error points at the quantity', String(zero.body?.errors?.[0]?.field).includes('quantity'), JSON.stringify(zero.body?.errors));
  expectStatus('Empty production list is rejected', await prod(workshopMgr, { items: [] }), 400, 'VALIDATION_ERROR');

  const levelOf = async (who: Account, locationId: string): Promise<number | undefined> => {
    const res = await call(who, 'GET', `/stock/levels?locationId=${locationId}`);
    return res.body?.items?.find((row: { product: { id: string } }) => row.product.id === pW)?.quantity;
  };
  record('Workshop stock is now 15 (10 + 5)', (await levelOf(workshopMgr, workshop.id)) === 15, `got ${await levelOf(workshopMgr, workshop.id)}`);

  // ---- stock: adjustments
  const adjust = (who: Account, body: unknown) => call(who, 'POST', '/stock/adjustments', body);
  const removed = await adjust(workshopMgr, { productId: pW, quantity: -3, reason: 'DAMAGED' });
  expectStatus('WORKSHOP_MANAGER: can remove damaged stock', removed, 201);
  record('...new quantity is 12', removed.body?.newQuantity === 12, `got ${removed.body?.newQuantity}`);
  expectStatus('Cannot remove more than exists (workshop)', await adjust(workshopMgr, { productId: pW, quantity: -100, reason: 'MISCOUNT' }), 409, 'INSUFFICIENT_STOCK');
  expectStatus('Cannot remove stock that is not there (store)', await adjust(storeMgr, { productId: pW, quantity: -1, reason: 'DAMAGED' }), 409, 'INSUFFICIENT_STOCK');
  expectStatus('STORE_MANAGER: can add found stock', await adjust(storeMgr, { productId: pW, quantity: 2, reason: 'FOUND' }), 201);
  expectStatus('WORKSHOP_MANAGER cannot adjust stock at another location', await adjust(workshopMgr, { productId: pW, quantity: 1, reason: 'FOUND', locationId: store.id }), 403, 'FORBIDDEN_LOCATION');
  expectStatus('Reason "Other" needs an explanation', await adjust(storeMgr, { productId: pW, quantity: 1, reason: 'OTHER' }), 400, 'VALIDATION_ERROR');
  expectStatus('SHOWROOM: cannot adjust stock', await adjust(showroomAcc, { productId: pW, quantity: 1, reason: 'FOUND' }), 403);
  expectStatus('OWNER: can adjust any location', await adjust(owner, { productId: pW, quantity: 1, reason: 'FOUND', locationId: showroom.id }), 201);
  expectStatus('Quantity 0 is rejected for adjustments', await adjust(workshopMgr, { productId: pW, quantity: 0, reason: 'FOUND' }), 400, 'VALIDATION_ERROR');

  // ---- stock: scoping
  expectStatus('SHOWROOM cannot read the workshop stock', await call(showroomAcc, 'GET', `/stock/levels?locationId=${workshop.id}`), 403, 'FORBIDDEN_LOCATION');
  expectStatus('STORE_MANAGER cannot read the workshop history', await call(storeMgr, 'GET', `/stock/movements?locationId=${workshop.id}`), 403, 'FORBIDDEN_LOCATION');
  expectStatus('OWNER must choose a location for stock levels', await call(owner, 'GET', '/stock/levels'), 400);
  const history = await call(workshopMgr, 'GET', `/stock/movements?locationId=${workshop.id}`);
  record('Workshop history lists the production entries', (history.body?.items ?? []).filter((m: { reason: string }) => m.reason === 'PRODUCTION').length >= 2, 'fewer than 2 PRODUCTION rows');

  // ---- ledger integrity: running total must equal the sum of the ledger
  const sum = await prisma.stockMovement.aggregate({ where: { productId: pW, locationId: workshop.id }, _sum: { qtyChange: true } });
  const level = await prisma.stockLevel.findUnique({ where: { productId_locationId: { productId: pW, locationId: workshop.id } } });
  record('Ledger total equals the stock level (workshop)', sum._sum.qtyChange === level?.quantity, `ledger ${sum._sum.qtyChange} vs level ${level?.quantity}`);

  // ---- accounts: protection and instant sign-out
  expectStatus('OWNER cannot deactivate their own account', await call(owner, 'PATCH', `/users/${owner.id}/active`, { isActive: false }), 409, 'CANNOT_MODIFY_SELF');
  expectStatus('OWNER can deactivate the showroom account', await call(owner, 'PATCH', `/users/${showroomAcc.id}/active`, { isActive: false }), 200);
  expectStatus('Deactivated account is signed out immediately', await call(showroomAcc, 'GET', '/locations'), 401);
}

async function main(): Promise<void> {
  let crashed: unknown = null;
  try {
    await run();
  } catch (error) {
    crashed = error;
  } finally {
    try {
      await cleanup();
      console.log('\nTemporary test data removed.');
    } catch (error) {
      console.error('\nCould not remove all test data. Delete rows whose names start with', tag, '\n', error);
    }
    await prisma.$disconnect();
  }

  if (crashed) {
    console.error('\nThe role check could not finish:', crashed instanceof Error ? crashed.message : crashed);
    console.error('Is the backend running (npm run start:dev) and is the database reachable?');
    process.exit(1);
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
  if (failed.length > 0) {
    console.log('\nFAILED:');
    for (const result of failed) console.log(` - ${result.name}: ${result.detail}`);
    process.exit(1);
  }
}

void main();
