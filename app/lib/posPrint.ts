'use client';

/**
 * Counter POS printing — the customer bill and the kitchen ticket (KOT).
 *
 * Both carry the 3-digit TOKEN as the biggest thing on the paper, so the
 * kitchen calls "042" and the customer holding bill 042 collects.
 *
 * One click prints both as ONE print job with a page break between them. Set
 * the thermal printer driver to cut after each page ("Page [Cut]" / "Cut per
 * page") and you get a KOT and a bill, each cut cleanly. For no print dialog
 * at all, open the till in Chrome started with --kiosk-printing (see
 * docs/COUNTER_POS.md).
 */
import { InvoiceConfig } from './bite';
import { baseStyles, cfgOrDefault, esc, printHtml } from './invoice';

export interface PosOutlet {
  id: number; code: string; name: string;
  address?: string | null; phone?: string | null; gstin?: string | null; fssai?: string | null;
  billFooter?: string | null; dayStartsAt: number;
  printMode: 'both' | 'bill' | 'kot'; kotCopies: number;
  isActive: boolean; sortOrder: number;
  /* online takeaway */
  pickupEnabled?: boolean; pickupOpensOn?: string | null; cooksDelivery?: boolean;
  latitude?: number | null; longitude?: number | null; mapsUrl?: string | null; pickupNote?: string | null;
}

export interface PosBillItem {
  productId: number | null; name: string; category?: string | null; isVeg?: boolean | null;
  unitPrice: number; quantity: number; lineTotal: number;
}

export interface PosBill {
  id: number; outletId: number; outlet: PosOutlet;
  billNo: string; token: number; tokenLabel: string; businessDate: string;
  orderType: 'takeaway' | 'dine_in';
  customerName?: string | null; customerMobile?: string | null; note?: string | null;
  itemCount: number; subtotal: number; discount: number; discountReason?: string | null;
  taxableAmount: number; taxRate: number; cgst: number; sgst: number; gstInclusive: boolean;
  roundOff: number; total: number;
  paymentMethod: 'cash' | 'upi' | 'card' | 'other';
  status: 'paid' | 'cancelled';
  cancelReason?: string | null; cancelledAt?: string | null; cancelledBy?: string | null;
  cashierName?: string | null; printCount: number; createdAt: string;
  items: PosBillItem[];
}

export type PrintWhat = 'both' | 'bill' | 'kot';

const PAY_LABEL: Record<string, string> = { cash: 'CASH', upi: 'UPI', card: 'CARD', other: 'OTHER' };
const TYPE_LABEL: Record<string, string> = { takeaway: 'TAKEAWAY', dine_in: 'DINE IN' };

const rs = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const rs2 = (n: number) => '₹' + Number(n || 0).toFixed(2);
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
const dateTimeOf = (iso: string) => new Date(iso).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
});

function posStyles(cfg: InvoiceConfig): string {
  return baseStyles(cfg) + `
    .tok { text-align:center; margin:6px 0 4px; }
    .tok .lbl { font-size:12px; font-weight:900; letter-spacing:3px; }
    .tok .tnum { font-size:46px; font-weight:900; line-height:1; letter-spacing:2px; font-family:Arial, Helvetica, sans-serif; }
    .kot .tok .tnum { font-size:64px; }
    .typ { display:inline-block; background:#000; color:#fff; font-weight:900; padding:2px 10px; letter-spacing:2px; margin-top:4px; }
    .stamp { border:3px solid #000; text-align:center; font-weight:900; font-size:16px; letter-spacing:3px; padding:2px 0; margin:6px 0; }
    .kot-item { font-size:17px; font-weight:900; padding:3px 0; }
    .kot-item .qtybox { font-size:17px; }
    .pagebreak { break-after:page; page-break-after:always; height:0; }
    .small { font-size:10px; }
  `;
}

function tokenBlock(b: PosBill): string {
  return `<div class="tok">
      <div class="lbl">TOKEN</div>
      <div class="tnum">${esc(b.tokenLabel)}</div>
      <div class="typ">${TYPE_LABEL[b.orderType] || 'TAKEAWAY'}</div>
    </div>`;
}

function stamps(b: PosBill, duplicate: boolean): string {
  return `${b.status === 'cancelled' ? '<div class="stamp">CANCELLED</div>' : ''}
          ${duplicate ? '<div class="stamp">DUPLICATE</div>' : ''}`;
}

/** Kitchen order ticket: token, type, dishes and quantities, note. No prices. */
function kotBody(b: PosBill, duplicate: boolean, copy?: string): string {
  const items = b.items.map((it) => `
      <div class="kot-item"><span class="qtybox">${it.quantity}</span>${esc(it.name)}</div>`).join('');
  return `<div class="kot">
    <div class="center">
      <div class="brand" style="color:#000;font-size:15px;">KOT &middot; ${esc(b.outlet.name)}</div>
      ${copy ? `<div class="meta">${esc(copy)}</div>` : ''}
    </div>
    ${tokenBlock(b)}
    ${stamps(b, duplicate)}
    <div class="center meta">${esc(timeOf(b.createdAt))} &middot; Bill ${esc(b.billNo)}</div>
    <hr class="rule-solid">
    ${items}
    <hr class="rule-solid">
    ${b.note ? `<div class="note"><b>Note:</b> ${esc(b.note)}</div>` : ''}
    <div class="center meta"><b>${b.itemCount} item${b.itemCount === 1 ? '' : 's'}</b></div>
  </div>`;
}

/** Customer bill: outlet header, token, bill number, items, GST, total, payment. */
function billBody(b: PosBill, cfg: InvoiceConfig, duplicate: boolean): string {
  const o = b.outlet;
  const gst = b.taxRate > 0;
  const half = b.taxRate / 2;
  const row = (label: string, value: string, cls = '') =>
    `<tr class="totrow ${cls}"><td>${esc(label)}</td><td class="num">${value}</td></tr>`;
  const items = b.items.map((it) => `<tr>
      <td class="item-name">${esc(it.name)}</td>
      <td class="num">${it.quantity}</td>
      <td class="num">${rs(it.unitPrice)}</td>
      <td class="num">${rs(it.lineTotal)}</td>
    </tr>`).join('');
  const customer = b.customerName || b.customerMobile
    ? `<div class="meta"><b>Customer:</b> ${esc(b.customerName || '')}${b.customerName && b.customerMobile ? ' &middot; ' : ''}${esc(b.customerMobile || '')}</div>`
    : '';
  return `
    <div class="center">
      ${cfg.showLogo && cfg.logoUrl ? `<img class="logo" src="${esc(cfg.logoUrl)}" alt="">` : ''}
      <div class="brand">${esc(cfg.brandName || 'Bite Theory')}</div>
      <div class="meta"><b>${esc(o.name)}</b></div>
      ${o.address ? `<div class="meta">${esc(o.address)}</div>` : ''}
      ${o.phone ? `<div class="meta">Ph: ${esc(o.phone)}</div>` : ''}
      ${o.gstin ? `<div class="meta">GSTIN: ${esc(o.gstin)}</div>` : ''}
      ${o.fssai ? `<div class="meta">FSSAI: ${esc(o.fssai)}</div>` : ''}
    </div>
    <hr class="rule-solid">
    ${tokenBlock(b)}
    ${stamps(b, duplicate)}
    <hr class="rule">
    <div class="center" style="font-weight:900;letter-spacing:1px;">${gst ? 'TAX INVOICE' : 'BILL'}</div>
    <div class="meta"><b>Bill No:</b> ${esc(b.billNo)}</div>
    <div class="meta"><b>Date:</b> ${esc(dateTimeOf(b.createdAt))}</div>
    ${b.cashierName ? `<div class="meta"><b>Cashier:</b> ${esc(b.cashierName)}</div>` : ''}
    ${customer}
    <hr class="rule">
    <table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amt</th></tr></thead>
      <tbody>${items}</tbody></table>
    <hr class="rule">
    <table>
      ${row(`Item total (${b.itemCount})`, rs2(b.subtotal))}
      ${b.discount > 0 ? row(`Discount${b.discountReason ? ` (${b.discountReason})` : ''}`, '- ' + rs2(b.discount)) : ''}
      ${gst ? row('Taxable value', rs2(b.taxableAmount)) : ''}
      ${gst ? row(`CGST @ ${half}%`, rs2(b.cgst)) : ''}
      ${gst ? row(`SGST @ ${half}%`, rs2(b.sgst)) : ''}
      ${b.roundOff !== 0 ? row('Round off', (b.roundOff > 0 ? '+ ' : '- ') + rs2(Math.abs(b.roundOff))) : ''}
      ${row('TOTAL', rs(b.total), 'grand')}
    </table>
    <div class="meta" style="margin-top:4px;"><b>Paid by:</b> ${PAY_LABEL[b.paymentMethod] || esc(b.paymentMethod)}</div>
    ${gst && b.gstInclusive ? '<div class="meta small">Prices are inclusive of GST.</div>' : ''}
    ${gst ? '<div class="meta small">SAC 996331 &middot; Restaurant service</div>' : ''}
    <hr class="rule">
    ${o.billFooter ? `<div class="footer">${esc(o.billFooter)}</div>` : (cfg.footerNote ? `<div class="footer">${esc(cfg.footerNote)}</div>` : '')}
    ${cfg.thankYouNote ? `<div class="footer" style="font-weight:700;">${esc(cfg.thankYouNote)}</div>` : ''}
    <div class="footer small">Please collect your order when token ${esc(b.tokenLabel)} is called.</div>`;
}

/**
 * The whole print job as one HTML document: KOT copies first (so the kitchen
 * starts), then the customer bill, each on its own "page".
 */
export function posPrintHtml(
  b: PosBill,
  rawCfg: Partial<InvoiceConfig> | null | undefined,
  what: PrintWhat,
  duplicate = false,
): string {
  const cfg = cfgOrDefault(rawCfg);
  const pages: string[] = [];
  if (what === 'both' || what === 'kot') {
    const copies = Math.max(1, Math.min(3, Number(b.outlet.kotCopies) || 1));
    for (let i = 1; i <= copies; i++) pages.push(kotBody(b, duplicate, copies > 1 ? `Copy ${i} of ${copies}` : undefined));
  }
  if (what === 'both' || what === 'bill') pages.push(billBody(b, cfg, duplicate));
  const inner = pages.map((p, i) => `<div class="doc">${p}</div>${i < pages.length - 1 ? '<div class="pagebreak"></div>' : ''}`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Token ${esc(b.tokenLabel)} · ${esc(b.billNo)}</title>
<style>${posStyles(cfg)}</style></head><body>${inner}</body></html>`;
}

export function printPosBill(
  b: PosBill,
  cfg: Partial<InvoiceConfig> | null | undefined,
  what: PrintWhat,
  duplicate = false,
) {
  printHtml(posPrintHtml(b, cfg, what, duplicate));
}

/** Day-close slip (thermal): sales by payment mode, GST, cancellations and
 *  the bill-number range — what the cashier hands over with the cash. */
export interface DayCloseData {
  title: string; from: string; to: string; printedBy?: string;
  totals: { bills: number; netSales: number; discount: number; cgst: number; sgst: number; items: number; cancelledBills: number; cancelledAmount: number };
  byPayment: { method: string; bills: number; amount: number }[];
  byOutlet: { name: string; bills: number; amount: number; firstBillNo: string | null; lastBillNo: string | null }[];
  topItems: { name: string; qty: number }[];
}
export function printDayClose(d: DayCloseData, rawCfg?: Partial<InvoiceConfig> | null) {
  const cfg = cfgOrDefault(rawCfg);
  const row = (l: string, v: string, cls = '') => `<tr class="totrow ${cls}"><td>${esc(l)}</td><td class="num">${v}</td></tr>`;
  const range = d.from === d.to ? d.from : `${d.from} to ${d.to}`;
  const inner = `
    <div class="center"><div class="brand" style="color:#000;">${esc(cfg.brandName || 'Bite Theory')}</div>
      <div class="meta"><b>DAY CLOSE &middot; ${esc(d.title)}</b></div>
      <div class="meta">${esc(range)}</div></div>
    <hr class="rule-solid">
    <table>
      ${row('Bills', String(d.totals.bills))}
      ${row('Items sold', String(d.totals.items))}
      ${d.totals.discount > 0 ? row('Discounts given', rs2(d.totals.discount)) : ''}
      ${d.totals.cgst + d.totals.sgst > 0 ? row('CGST', rs2(d.totals.cgst)) + row('SGST', rs2(d.totals.sgst)) : ''}
      ${row('NET SALES', rs(d.totals.netSales), 'grand')}
    </table>
    <hr class="rule">
    <div class="meta"><b>By payment</b></div>
    <table>${d.byPayment.map((p) => row(`${PAY_LABEL[p.method] || p.method} (${p.bills})`, rs(p.amount))).join('') || row('—', rs(0))}</table>
    <hr class="rule">
    ${d.byOutlet.map((o) => `<div class="meta"><b>${esc(o.name)}</b>: ${o.bills} bills, ${rs(o.amount)}${o.firstBillNo ? `<br>${esc(o.firstBillNo)} &rarr; ${esc(o.lastBillNo || '')}` : ''}</div>`).join('')}
    ${d.totals.cancelledBills ? `<hr class="rule"><div class="meta"><b>Cancelled:</b> ${d.totals.cancelledBills} bill(s), ${rs(d.totals.cancelledAmount)}</div>` : ''}
    ${d.topItems.length ? `<hr class="rule"><div class="meta"><b>Top dishes</b></div><table>${d.topItems.slice(0, 10).map((i) => row(i.name, String(i.qty))).join('')}</table>` : ''}
    <hr class="rule">
    <div class="center meta">Printed ${esc(dateTimeOf(new Date().toISOString()))}${d.printedBy ? ` by ${esc(d.printedBy)}` : ''}</div>
    <div style="margin-top:22px" class="meta">Cash counted: ____________</div>
    <div style="margin-top:14px" class="meta">Signature: ____________</div>`;
  printHtml(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Day close</title><style>${posStyles(cfg)}</style></head><body><div class="doc">${inner}</div></body></html>`);
}
