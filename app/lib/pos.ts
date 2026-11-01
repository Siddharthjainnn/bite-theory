'use client';

/**
 * Counter POS client — talks to /api/pos and /api/outlets.
 * Every call takes the admin headers (shared key + the admin's own JWT, so
 * the bill carries the cashier's real name).
 */
import { API_BASE } from './bite';
import type { PosBill, PosOutlet } from './posPrint';

export type Headers = () => Record<string, string>;

export interface PosMenuItem {
  id: number; name: string; isVeg: boolean | null; image: string | null;
  categoryId: number | null; categoryName: string | null;
  price: number; sitePrice: number;
}
export interface PosDayStats { date: string; bills: number; sales: number; lastToken: number | null }
export interface PosMenu {
  outlet: PosOutlet;
  categories: { id: number; name: string }[];
  items: PosMenuItem[];
  tax: { gstEnabled: boolean; gstRate: number; gstInclusive: boolean };
  today: PosDayStats;
}
export interface NewBill {
  outletId: number; clientRef: string;
  items: { productId: number; quantity: number }[];
  paymentMethod: 'cash' | 'upi' | 'card' | 'other';
  orderType: 'takeaway' | 'dine_in';
  customerName?: string; customerMobile?: string; note?: string;
  discount?: { type: 'flat' | 'percent'; value: number; reason?: string };
}
export interface OutletPriceRow {
  productId: number; name: string; status: string; isVeg: boolean | null;
  categoryId: number | null; categoryName: string | null;
  sitePrice: number; outletPrice: number | null; isAvailable: boolean;
}
export interface PosSummary {
  range: { from: string; to: string };
  totals: {
    bills: number; netSales: number; subtotal: number; discount: number; taxable: number;
    cgst: number; sgst: number; tax: number; roundOff: number; items: number; avgBill: number;
    cancelledBills: number; cancelledAmount: number;
  };
  byPayment: { method: string; bills: number; amount: number }[];
  byOutlet: {
    outletId: number; name: string; code: string; gstin: string | null; bills: number; amount: number;
    discount: number; taxable: number; cgst: number; sgst: number; cancelled: number;
    firstBillNo: string | null; lastBillNo: string | null;
  }[];
  byDay: { date: string; bills: number; amount: number }[];
  byHour: { hour: number; bills: number; amount: number }[];
  byType: { type: string; bills: number; amount: number }[];
  topItems: { productId: number; name: string; category: string | null; qty: number; amount: number }[];
  byCategory: { category: string; qty: number; amount: number }[];
  cancelled: {
    id: number; billNo: string; token: number; total: number; reason: string;
    cancelledBy: string; cancelledAt: string; cashierName: string; outlet: string;
  }[];
}

async function ok<T>(r: Response, fallback: string): Promise<T> {
  if (r.ok) return r.json();
  let msg = '';
  try {
    const b = await r.json();
    const m = b?.message ?? b?.error;
    msg = Array.isArray(m) ? m.join(' · ') : (typeof m === 'string' ? m : '');
  } catch { /* not JSON */ }
  if (!msg && (r.status === 401 || r.status === 403)) msg = 'Session expired or not allowed — please log in again.';
  throw new Error(msg || `${fallback} (HTTP ${r.status})`);
}

export function posApi(headers: Headers) {
  const get = (path: string) => fetch(`${API_BASE}${path}`, { headers: headers(), cache: 'no-store' });
  const send = (method: string, path: string, body?: unknown) => fetch(`${API_BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...headers() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const qs = (o: Record<string, string | number | null | undefined>) =>
    Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');

  return {
    outlets: async (): Promise<PosOutlet[]> => ok(await get('/pos/outlets'), 'Could not load outlets'),
    menu: async (outletId: number): Promise<PosMenu> => ok(await get(`/pos/outlets/${outletId}/menu`), 'Could not load the menu'),
    createBill: async (b: NewBill): Promise<PosBill> => ok(await send('POST', '/pos/bills', b), 'Could not save the bill'),
    bills: async (outletId: number, date?: string, q?: string): Promise<{ date: string; outlet: PosOutlet; bills: PosBill[]; stats: PosDayStats }> =>
      ok(await get(`/pos/bills?${qs({ outletId, date, q })}`), 'Could not load bills'),
    markPrinted: async (id: number): Promise<PosBill> => ok(await send('POST', `/pos/bills/${id}/printed`), 'Could not record the print'),
    cancelBill: async (id: number, reason: string): Promise<PosBill> =>
      ok(await send('POST', `/pos/manage/bills/${id}/cancel`, { reason }), 'Could not cancel the bill'),

    allOutlets: async (): Promise<PosOutlet[]> => ok(await get('/outlets'), 'Could not load outlets'),
    saveOutlet: async (id: number | null, o: Partial<PosOutlet>): Promise<PosOutlet> =>
      ok(await send(id ? 'PATCH' : 'POST', id ? `/outlets/${id}` : '/outlets', o), 'Could not save the outlet'),
    prices: async (outletId: number): Promise<OutletPriceRow[]> => ok(await get(`/outlets/${outletId}/prices`), 'Could not load the rate list'),
    savePrices: async (outletId: number, prices: { productId: number; price: number | null; isAvailable: boolean }[]) =>
      ok<{ ok: true; changed: number }>(await send('PUT', `/outlets/${outletId}/prices`, { prices }), 'Could not save the rate list'),
    copyPrices: async (outletId: number, fromOutletId: number): Promise<OutletPriceRow[]> =>
      ok(await send('POST', `/outlets/${outletId}/prices/copy`, { fromOutletId }), 'Could not copy the rate list'),

    summary: async (from: string, to: string, outletId?: number | null): Promise<PosSummary> =>
      ok(await get(`/pos/reports/summary?${qs({ from, to, outletId })}`), 'Could not load the report'),
    /** CSV needs the auth headers, so fetch it and hand the browser a blob */
    downloadCsv: async (kind: 'bills' | 'items', from: string, to: string, outletId?: number | null) => {
      const r = await get(`/pos/reports/${kind}.csv?${qs({ from, to, outletId })}`);
      if (!r.ok) await ok(r, 'Could not export');
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `counter-${kind}-${from}${to !== from ? `-to-${to}` : ''}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
  };
}
export type PosApi = ReturnType<typeof posApi>;

/** Bill totals the till shows while typing — same rules as the server
 *  (pos.math.ts). The server's numbers are what get saved and printed. */
export function previewTotals(
  subtotal: number,
  tax: PosMenu['tax'] | undefined,
  discount?: { type: 'flat' | 'percent'; value: number } | null,
) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  let disc = 0;
  if (discount && discount.value > 0) {
    disc = discount.type === 'percent' ? subtotal * Math.min(discount.value, 100) / 100 : discount.value;
    disc = r2(Math.min(subtotal, Math.max(0, disc)));
  }
  const net = r2(subtotal - disc);
  const rate = tax?.gstEnabled ? tax.gstRate : 0;
  let gst = 0; let gross = net;
  if (rate > 0 && net > 0) {
    if (tax?.gstInclusive) gst = r2(net - r2(net / (1 + rate / 100)));
    else { gst = r2(net * rate / 100); gross = r2(net + gst); }
  }
  const total = Math.round(gross);
  return { subtotal, discount: disc, gst, roundOff: r2(total - gross), total };
}

/** RFC 4122 v4, for the bill's idempotency key */
export function newClientRef(): string {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
  // randomUUID needs a secure context (https or localhost); a till opened over
  // plain http on the shop network falls back to getRandomValues
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c) c.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
