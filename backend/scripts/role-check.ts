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

/** A multipart request (used for payments, which can carry a receipt file). */
async function callForm(
  who: Account,
  path: string,
  fields: Record<string, string>,
  file?: { name: string; type: string; bytes: Uint8Array },
): Promise<ApiResponse> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  if (file) form.append('receipt', new Blob([file.bytes], { type: file.type }), file.name);

  const response = await fetch(`${API}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${who.token}` }, body: form });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, body: json };
}

/** A real 1x1 PNG, used to test receipt uploads. */
const TINY_PNG = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
);

/** The discount limit before this test changed it, so it can be put back. */
let discountToRestore: number | null = null;

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
  await prisma.payment.deleteMany({ where: { sale: { location: { name: { startsWith: tag } } } } });
  await prisma.saleItem.deleteMany({ where: { sale: { location: { name: { startsWith: tag } } } } });
  await prisma.sale.deleteMany({ where: { location: { name: { startsWith: tag } } } });
  await prisma.salesperson.deleteMany({ where: { showroom: { name: { startsWith: tag } } } });
  await prisma.transfer.deleteMany({
    where: { OR: [{ fromLocation: { name: { startsWith: tag } } }, { toLocation: { name: { startsWith: tag } } }] },
  });
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

  // ---- transfers
  const send = (who: Account, id: string) => call(who, 'POST', `/transfers/${id}/send`);
  const receive = (who: Account, id: string, body: unknown) => call(who, 'POST', `/transfers/${id}/receive`, body);

  const draft = await call(workshopMgr, 'POST', '/transfers', { toLocationId: store.id, items: [{ productId: pW, quantity: 4 }], note: 'role check' });
  expectStatus('WORKSHOP_MANAGER: can create a transfer to the store', draft, 201);
  record('...it starts as a draft', draft.body?.status === 'DRAFT', `got ${draft.body?.status}`);
  const t1: string = draft.body?.id;

  expectStatus('SHOWROOM: cannot create a transfer', await call(showroomAcc, 'POST', '/transfers', { toLocationId: store.id, items: [{ productId: pW, quantity: 1 }] }), 403, 'FORBIDDEN_ROLE');
  expectStatus('OWNER: cannot create a transfer', await call(owner, 'POST', '/transfers', { toLocationId: store.id, items: [{ productId: pW, quantity: 1 }] }), 403, 'FORBIDDEN_ROLE');
  const toSelf = await call(workshopMgr, 'POST', '/transfers', { toLocationId: workshop.id, items: [{ productId: pW, quantity: 1 }] });
  expectStatus('Route rule: a place cannot send to itself', toSelf, 400, 'VALIDATION_ERROR');
  record('...and the error points at the destination', toSelf.body?.errors?.[0]?.field === 'toLocationId', JSON.stringify(toSelf.body?.errors));
  expectStatus('Route rule: a store cannot send back to the workshop', await call(storeMgr, 'POST', '/transfers', { toLocationId: workshop.id, items: [{ productId: pW, quantity: 1 }] }), 400, 'VALIDATION_ERROR');
  expectStatus('Cannot send more than the sender has', await call(workshopMgr, 'POST', '/transfers', { toLocationId: store.id, items: [{ productId: pW, quantity: 1000 }] }), 409, 'INSUFFICIENT_STOCK');
  expectStatus('The same product twice is rejected', await call(workshopMgr, 'POST', '/transfers', { toLocationId: store.id, items: [{ productId: pW, quantity: 1 }, { productId: pW, quantity: 2 }] }), 400, 'VALIDATION_ERROR');
  expectStatus('The store cannot see the workshop draft', await call(storeMgr, 'GET', `/transfers/${t1}`), 404);
  expectStatus('The showroom cannot see an unrelated transfer', await call(showroomAcc, 'GET', `/transfers/${t1}`), 404);
  expectStatus('WORKSHOP_MANAGER: can edit a draft', await call(workshopMgr, 'PATCH', `/transfers/${t1}`, { items: [{ productId: pW, quantity: 4 }], note: 'edited' }), 200);
  expectStatus('SHOWROOM: cannot send a transfer', await send(showroomAcc, t1), 403, 'FORBIDDEN_ROLE');

  const sent = await send(workshopMgr, t1);
  expectStatus('WORKSHOP_MANAGER: can send the draft', sent, 200);
  record('...it is now in transit', sent.body?.status === 'IN_TRANSIT', `got ${sent.body?.status}`);
  const afterSend = await levelOf(workshopMgr, workshop.id);
  record('...the workshop stock went down by 4 (12 to 8)', afterSend === 8, `got ${afterSend}`);
  expectStatus('A sent transfer cannot be sent again', await send(workshopMgr, t1), 409, 'TRANSFER_STATE');
  expectStatus('A sent transfer cannot be edited', await call(workshopMgr, 'PATCH', `/transfers/${t1}`, { note: 'late' }), 409, 'TRANSFER_STATE');
  expectStatus('WORKSHOP_MANAGER: cannot receive (the workshop only sends)', await receive(workshopMgr, t1, { items: [{ productId: pW, quantityReceived: 4 }] }), 403, 'FORBIDDEN_ROLE');
  expectStatus('SHOWROOM: cannot receive a transfer that is not theirs', await receive(showroomAcc, t1, { items: [{ productId: pW, quantityReceived: 4 }] }), 404);

  const noNote = await receive(storeMgr, t1, { items: [{ productId: pW, quantityReceived: 3 }] });
  expectStatus('A difference needs an explanation', noNote, 400, 'VALIDATION_ERROR');
  record('...and the error points at the note', noNote.body?.errors?.[0]?.field === 'note', JSON.stringify(noNote.body?.errors));
  expectStatus('Cannot receive more than was sent', await receive(storeMgr, t1, { items: [{ productId: pW, quantityReceived: 5 }], note: 'x' }), 400, 'VALIDATION_ERROR');
  const got = await receive(storeMgr, t1, { items: [{ productId: pW, quantityReceived: 3 }], note: '1 arrived damaged' });
  expectStatus('STORE_MANAGER: can receive with a difference', got, 200);
  record('...it is marked received with differences', got.body?.status === 'RECEIVED_WITH_DISCREPANCY', `got ${got.body?.status}`);
  const storeAfter = await levelOf(storeMgr, store.id);
  record('...only what arrived was added to the store (2 + 3 = 5)', storeAfter === 5, `got ${storeAfter}`);
  expectStatus('A received transfer cannot be received again', await receive(storeMgr, t1, { items: [{ productId: pW, quantityReceived: 4 }], note: 'x' }), 409, 'TRANSFER_STATE');

  const t2 = await call(storeMgr, 'POST', '/transfers', { toLocationId: showroom.id, items: [{ productId: pW, quantity: 2 }], sendNow: true });
  expectStatus('STORE_MANAGER: can create and send to a showroom in one step', t2, 201);
  record('...it is in transit', t2.body?.status === 'IN_TRANSIT', `got ${t2.body?.status}`);
  const storeAfterSend = await levelOf(storeMgr, store.id);
  record('...the store stock went down by 2 (5 to 3)', storeAfterSend === 3, `got ${storeAfterSend}`);
  const rec2 = await receive(showroomAcc, t2.body?.id, { items: [{ productId: pW, quantityReceived: 2 }] });
  expectStatus('SHOWROOM: can receive exactly what was sent', rec2, 200);
  record('...it is marked received', rec2.body?.status === 'RECEIVED', `got ${rec2.body?.status}`);
  const showroomAfter = await levelOf(showroomAcc, showroom.id);
  record('...the showroom stock is now 3 (1 + 2)', showroomAfter === 3, `got ${showroomAfter}`);

  const t3 = await call(workshopMgr, 'POST', '/transfers', { toLocationId: showroom.id, items: [{ productId: pW, quantity: 2 }], sendNow: true });
  expectStatus('WORKSHOP_MANAGER: can send straight to a showroom', t3, 201);
  const wsMid = await levelOf(workshopMgr, workshop.id);
  record('...the workshop stock went down by 2 (8 to 6)', wsMid === 6, `got ${wsMid}`);
  expectStatus('OWNER: can cancel a transfer on the road', await call(owner, 'POST', `/transfers/${t3.body?.id}/cancel`, { reason: 'role check' }), 200);
  const wsBack = await levelOf(workshopMgr, workshop.id);
  record('...the stock came back to the workshop (6 to 8)', wsBack === 8, `got ${wsBack}`);
  expectStatus('A cancelled transfer cannot be received', await receive(showroomAcc, t3.body?.id, { items: [{ productId: pW, quantityReceived: 2 }] }), 409, 'TRANSFER_STATE');

  for (const role of ROLES) {
    expectStatus(`${role}: can read the transfer list`, await call(accounts[role], 'GET', '/transfers'), 200);
    expectStatus(`${role}: can read the transfer summary`, await call(accounts[role], 'GET', '/transfers/summary'), 200);
  }
  const showroomList = await call(showroomAcc, 'GET', '/transfers');
  const onlyOwn = (showroomList.body?.items ?? []).every((row: { fromLocation: { id: string }; toLocation: { id: string } }) => row.fromLocation.id === showroom.id || row.toLocation.id === showroom.id);
  record('The showroom only sees transfers that involve it', onlyOwn, 'it saw someone else\'s transfer');

  // ---- low-stock list (dashboards)
  for (const role of ROLES) {
    expectStatus(`${role}: can read the low-stock list`, await call(accounts[role], 'GET', '/stock/low'), 200);
  }
  for (const [who, locationId, label] of [
    [storeMgr, store.id, 'store'],
    [showroomAcc, showroom.id, 'showroom'],
  ] as const) {
    const low = await call(who, 'GET', '/stock/low');
    const ownOnly = (low.body?.items ?? []).every((row: { location: { id: string } }) => row.location.id === locationId);
    record(`The ${label} low-stock list only shows its own location`, ownOnly, 'it listed another location');
  }

  // ---- ledger integrity: running total must equal the sum of the ledger
  const sum = await prisma.stockMovement.aggregate({ where: { productId: pW, locationId: workshop.id }, _sum: { qtyChange: true } });
  const level = await prisma.stockLevel.findUnique({ where: { productId_locationId: { productId: pW, locationId: workshop.id } } });
  record('Ledger total equals the stock level (workshop)', sum._sum.qtyChange === level?.quantity, `ledger ${sum._sum.qtyChange} vs level ${level?.quantity}`);
  const storeSum = await prisma.stockMovement.aggregate({ where: { productId: pW, locationId: store.id }, _sum: { qtyChange: true } });
  const storeLevel = await prisma.stockLevel.findUnique({ where: { productId_locationId: { productId: pW, locationId: store.id } } });
  record('Ledger total equals the stock level (store)', storeSum._sum.qtyChange === storeLevel?.quantity, `ledger ${storeSum._sum.qtyChange} vs level ${storeLevel?.quantity}`);
  const showroomSum = await prisma.stockMovement.aggregate({ where: { productId: pW, locationId: showroom.id }, _sum: { qtyChange: true } });
  const showroomLevel = await prisma.stockLevel.findUnique({ where: { productId_locationId: { productId: pW, locationId: showroom.id } } });
  record('Ledger total equals the stock level (showroom, after the sale)', showroomSum._sum.qtyChange === showroomLevel?.quantity, `ledger ${showroomSum._sum.qtyChange} vs level ${showroomLevel?.quantity}`);

  // ---- settings (owner only)
  for (const role of ROLES) {
    const expected = role === 'OWNER' ? 200 : 403;
    expectStatus(`${role}: settings ${expected === 200 ? 'allowed' : 'refused'}`, await call(accounts[role], 'GET', '/settings'), expected);
  }
  const settingsNow = await call(owner, 'GET', '/settings');
  const currentDiscount = (settingsNow.body ?? []).find((row: { key: string }) => row.key === 'max_discount_percent')?.value;
  discountToRestore = typeof currentDiscount === 'number' ? currentDiscount : 100;
  expectStatus('A setting outside its range is rejected', await call(owner, 'PATCH', '/settings', { max_discount_percent: 150 }), 400, 'VALIDATION_ERROR');
  expectStatus('OWNER: can set the discount limit (10% for this test)', await call(owner, 'PATCH', '/settings', { max_discount_percent: 10 }), 200);
  expectStatus('SHOWROOM: cannot change settings', await call(showroomAcc, 'PATCH', '/settings', { max_discount_percent: 100 }), 403, 'FORBIDDEN_ROLE');

  // ---- salespeople
  const anna = await call(showroomAcc, 'POST', '/salespeople', { fullName: `${tag} Anna`, phone: '+251 911 000111' });
  expectStatus('SHOWROOM: can add a salesperson', anna, 201);
  expectStatus('A duplicate salesperson name is rejected', await call(showroomAcc, 'POST', '/salespeople', { fullName: `${tag} anna` }), 409, 'UNIQUE_CONSTRAINT');
  const ben = await call(showroomAcc, 'POST', '/salespeople', { fullName: `${tag} Ben` });
  expectStatus('SHOWROOM: can add a second salesperson', ben, 201);
  for (const who of [workshopMgr, storeMgr]) {
    expectStatus(`${who.role}: cannot read salespeople`, await call(who, 'GET', '/salespeople'), 403, 'FORBIDDEN_ROLE');
    expectStatus(`${who.role}: cannot add a salesperson`, await call(who, 'POST', '/salespeople', { fullName: `${tag} Nope` }), 403, 'FORBIDDEN_ROLE');
  }
  expectStatus('OWNER must say which showroom when adding a salesperson', await call(owner, 'POST', '/salespeople', { fullName: `${tag} Owner pick` }), 400, 'VALIDATION_ERROR');
  const ownerList = await call(owner, 'GET', `/salespeople?showroomId=${showroom.id}`);
  record('OWNER: sees the showroom list', (ownerList.body ?? []).some((row: { id: string }) => row.id === anna.body?.id), 'Anna was not listed');
  expectStatus('SHOWROOM: can deactivate a salesperson', await call(showroomAcc, 'PATCH', `/salespeople/${ben.body?.id}`, { isActive: false }), 200);
  const activeOnly = await call(showroomAcc, 'GET', '/salespeople');
  record('The "Sold by" list only has active people', (activeOnly.body ?? []).every((row: { isActive: boolean }) => row.isActive), 'an inactive person was listed');

  // ---- sales
  const sale = (extra: Record<string, unknown> = {}, quantity = 1) => ({
    salespersonId: anna.body?.id,
    items: [{ productId: pW, quantity }],
    ...extra,
  });
  for (const who of [workshopMgr, storeMgr, owner]) {
    expectStatus(`${who.role}: cannot record a sale`, await call(who, 'POST', '/sales', sale()), 403, 'FORBIDDEN_ROLE');
  }
  expectStatus('Cannot sell as an inactive salesperson', await call(showroomAcc, 'POST', '/sales', sale({ salespersonId: ben.body?.id })), 400, 'VALIDATION_ERROR');
  expectStatus('Cannot sell more than the showroom has', await call(showroomAcc, 'POST', '/sales', sale({}, 99)), 409, 'INSUFFICIENT_STOCK');
  expectStatus('The price cannot be sent from the screen', await call(showroomAcc, 'POST', '/sales', { salespersonId: anna.body?.id, items: [{ productId: pW, quantity: 1, unitPrice: 1 }] }), 400, 'VALIDATION_ERROR');
  const noReason = await call(showroomAcc, 'POST', '/sales', sale({ discount: 100 }));
  expectStatus('A discount needs a reason', noReason, 400, 'VALIDATION_ERROR');
  record('...and the error points at the reason', noReason.body?.errors?.[0]?.field === 'discountReason', JSON.stringify(noReason.body?.errors));
  expectStatus('A discount cannot be the whole price', await call(showroomAcc, 'POST', '/sales', sale({ discount: 5000, discountReason: 'test' })), 400, 'VALIDATION_ERROR');
  expectStatus('A discount above the limit is refused (20% > 10%)', await call(showroomAcc, 'POST', '/sales', sale({ discount: 500, discountReason: 'too big' })), 409, 'DISCOUNT_LIMIT');

  const made = await call(showroomAcc, 'POST', '/sales', sale({ customerName: 'Test Customer', customerPhone: '+251 911 222333', discount: 100, discountReason: 'regular customer' }));
  expectStatus('SHOWROOM: can record a sale with a small discount', made, 201);
  const saleId: string = made.body?.id;
  record('...the total is price minus discount (2500 - 100 = 2400)', Number(made.body?.total) === 2400, `got ${made.body?.total}`);
  record('...it starts as unpaid', made.body?.paymentStatus === 'PENDING', `got ${made.body?.paymentStatus}`);
  const afterSale = await levelOf(showroomAcc, showroom.id);
  record('...the showroom stock went down by 1 (3 to 2)', afterSale === 2, `got ${afterSale}`);

  expectStatus('SHOWROOM: can open its sale', await call(showroomAcc, 'GET', `/sales/${saleId}`), 200);
  expectStatus('OWNER: can open any sale', await call(owner, 'GET', `/sales/${saleId}`), 200);
  expectStatus('STORE_MANAGER: cannot open a sale', await call(storeMgr, 'GET', `/sales/${saleId}`), 403, 'FORBIDDEN_ROLE');
  expectStatus('WORKSHOP_MANAGER: cannot read sales', await call(workshopMgr, 'GET', '/sales'), 403, 'FORBIDDEN_ROLE');
  const showroomSales = await call(showroomAcc, 'GET', '/sales');
  record('The showroom list only has its own sales', (showroomSales.body?.items ?? []).every((row: { location: { id: string } }) => row.location.id === showroom.id), 'it listed another showroom');
  expectStatus('OWNER: can read the sales list', await call(owner, 'GET', '/sales'), 200);
  expectStatus('SHOWROOM: can read the sales summary', await call(showroomAcc, 'GET', '/sales/summary'), 200);
  expectStatus('OWNER: can read the sales summary', await call(owner, 'GET', '/sales/summary'), 200);
  expectStatus('STORE_MANAGER: cannot read the sales summary', await call(storeMgr, 'GET', '/sales/summary'), 403, 'FORBIDDEN_ROLE');

  // ---- payments
  const pay = (fields: Record<string, string>, file?: { name: string; type: string; bytes: Uint8Array }) =>
    callForm(showroomAcc, `/sales/${saleId}/payments`, fields, file);
  expectStatus('OWNER: cannot record a payment', await callForm(owner, `/sales/${saleId}/payments`, { amount: '100', method: 'CASH' }), 403, 'FORBIDDEN_ROLE');
  expectStatus('A payment cannot be more than the balance', await pay({ amount: '5000', method: 'CASH' }), 409, 'OVERPAYMENT');
  expectStatus('A bank payment needs a reference number', await pay({ amount: '500', method: 'BANK_TRANSFER' }), 400, 'VALIDATION_ERROR');
  expectStatus('A bank payment needs a receipt', await pay({ amount: '500', method: 'TELEBIRR', referenceNo: 'TB123' }), 409, 'RECEIPT_REQUIRED');
  expectStatus('A receipt that is not an image or PDF is rejected', await pay({ amount: '500', method: 'TELEBIRR', referenceNo: 'TB123' }, { name: 'fake.png', type: 'image/png', bytes: new TextEncoder().encode('this is not an image') }), 400, 'VALIDATION_ERROR');
  const part = await pay({ amount: '1000', method: 'CASH' });
  expectStatus('SHOWROOM: can record a cash payment (no receipt needed)', part, 201);
  record('...the sale is now partly paid', part.body?.paymentStatus === 'PARTIAL', `got ${part.body?.paymentStatus}`);
  record('...the payment waits for the owner', part.body?.payments?.[0]?.verificationStatus === 'UNVERIFIED', `got ${part.body?.payments?.[0]?.verificationStatus}`);
  const rest = await pay({ amount: '1400', method: 'CASH' });
  expectStatus('SHOWROOM: can pay the rest', rest, 201);
  record('...the sale is now paid', rest.body?.paymentStatus === 'PAID', `got ${rest.body?.paymentStatus}`);
  expectStatus('A fully paid sale takes no more payments', await pay({ amount: '100', method: 'CASH' }), 409, 'OVERPAYMENT');

  if (process.env.ROLE_CHECK_UPLOADS === '1') {
    // This really uploads a tiny file to your private receipts bucket (it stays there). Run only when you want to test storage.
    const second = await call(showroomAcc, 'POST', '/sales', sale());
    const secondPay = await callForm(showroomAcc, `/sales/${second.body?.id}/payments`, { amount: '1000', method: 'TELEBIRR', referenceNo: 'RC-TEST' }, { name: 'receipt.png', type: 'image/png', bytes: TINY_PNG });
    expectStatus('A bank payment with a receipt is accepted (needs Supabase storage)', secondPay, 201);
    const paymentId: string | undefined = secondPay.body?.payments?.[0]?.id;
    record('...the receipt is stored', secondPay.body?.payments?.[0]?.hasReceipt === true, 'hasReceipt was false');
    expectStatus('SHOWROOM: gets a link to its receipt', await call(showroomAcc, 'GET', `/payments/${paymentId}/receipt`), 200);
    expectStatus('OWNER: gets a link to the receipt', await call(owner, 'GET', `/payments/${paymentId}/receipt`), 200);
    expectStatus('STORE_MANAGER: cannot open a receipt', await call(storeMgr, 'GET', `/payments/${paymentId}/receipt`), 403, 'FORBIDDEN_ROLE');
  } else {
    console.log('SKIP  receipt upload checks (run with ROLE_CHECK_UPLOADS=1 to test Supabase storage)');
  }

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
    if (discountToRestore !== null && accounts.OWNER?.token) {
      try {
        await call(accounts.OWNER, 'PATCH', '/settings', { max_discount_percent: discountToRestore });
      } catch {
        console.error('Could not restore the discount limit. Check Settings.');
      }
    }
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
