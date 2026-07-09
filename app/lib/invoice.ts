'use client';

/**
 * Invoice / bill rendering — driven entirely by the admin's InvoiceConfig.
 *
 * Two documents share one config:
 *   - chefTicket()      → compact kitchen ticket (items + notes, no prices)
 *   - customerInvoice() → branded receipt (logo, bill breakup, tax, footer)
 *
 * Both return a self-contained HTML string sized for the chosen paper
 * (58mm / 80mm thermal, or A4). `printHtml()` opens it in a hidden iframe and
 * calls window.print() — no dependencies, works from the browser.
 *
 * Real unattended thermal auto-print (fire-and-forget on "food ready") needs a
 * tiny local print agent on the shop PC — see AUTO_PRINT_AGENT.md. This module
 * gives you the exact HTML that agent would POST to the printer.
 */
import { InvoiceConfig, DEFAULT_INVOICE_CONFIG } from './bite';

export interface InvoiceItem {
  productName: string; quantity: number; unitPrice: number; lineTotal: number;
}
export interface InvoiceOrder {
  orderNumber: string;
  placedAt?: string | null;
  items: InvoiceItem[];
  subtotal: number; discount?: number; deliveryCharge?: number;
  tax?: number; walletUsed?: number; tip?: number; total: number;
  deliveryAddress?: string | null;
  customerName?: string | null;
  customerMobile?: string | null;
  paymentMethod?: string | null;
  cookingNote?: string | null;
  deliveryInstructions?: string | null;
  status?: string | null;
}

const money = (n: number) => '\u20B9' + Number(n || 0).toLocaleString('en-IN');

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paperWidth(paper: InvoiceConfig['paper']): string {
  if (paper === 'thermal58') return '58mm';
  if (paper === 'a4') return '210mm';
  return '80mm';
}
function contentWidth(paper: InvoiceConfig['paper']): string {
  if (paper === 'thermal58') return '54mm';
  if (paper === 'a4') return '180mm';
  return '76mm';
}

function cfgOrDefault(cfg?: Partial<InvoiceConfig> | null): InvoiceConfig {
  return { ...DEFAULT_INVOICE_CONFIG, ...(cfg || {}),
    columns: { ...DEFAULT_INVOICE_CONFIG.columns, ...(cfg?.columns || {}) } };
}

function baseStyles(cfg: InvoiceConfig): string {
  const isThermal = cfg.paper !== 'a4';
  const base = isThermal ? 12 : 13;
  return `
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html,body { margin:0; padding:0; }
    body { font-family: ${isThermal ? "'Courier New', ui-monospace, monospace" : "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"};
      font-size:${base}px; color:#111; line-height:1.4; }
    .doc { width:${contentWidth(cfg.paper)}; margin:0 auto; padding:${isThermal ? '6px 2px' : '18px'}; }
    .center { text-align:center; }
    .brand { font-weight:800; font-size:${isThermal ? 16 : 22}px; letter-spacing:.5px; color:${esc(cfg.accentColor)}; }
    .tagline { font-size:${base - 2}px; color:#555; margin-top:2px; }
    .meta { font-size:${base - 1}px; color:#333; }
    .logo { max-width:${isThermal ? '120px' : '160px'}; max-height:64px; object-fit:contain; margin:0 auto 4px; display:block; }
    .rule { border:none; border-top:1px dashed #999; margin:8px 0; }
    .rule-solid { border:none; border-top:2px solid ${esc(cfg.accentColor)}; margin:8px 0; }
    table { width:100%; border-collapse:collapse; }
    th,td { text-align:left; padding:${isThermal ? '2px 0' : '5px 4px'}; font-size:${base - 1}px; vertical-align:top; }
    th { border-bottom:1px solid #000; font-weight:700; }
    .num { text-align:right; white-space:nowrap; }
    .totrow td { padding:2px 4px; }
    .grand td { font-weight:800; font-size:${base + 2}px; border-top:2px solid #000; padding-top:5px; }
    .note { background:#f4f4f4; border-left:3px solid ${esc(cfg.accentColor)}; padding:6px 8px; margin:6px 0; font-size:${base - 1}px; }
    .footer { margin-top:10px; text-align:center; font-size:${base - 1}px; color:#333; }
    .big-item { font-size:${isThermal ? 15 : 16}px; font-weight:800; }
    .qtybox { display:inline-block; min-width:26px; padding:1px 6px; border:2px solid #000; font-weight:800; text-align:center; margin-right:8px; }
    @media print { @page { size:${paperWidth(cfg.paper)} auto; margin:${isThermal ? '2mm' : '12mm'}; } }
  `;
}

function wrap(cfg: InvoiceConfig, title: string, inner: string, autoprint = false): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${baseStyles(cfg)}</style></head>
<body><div class="doc">${inner}</div>
${autoprint ? '<script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>' : ''}
</body></html>`;
}

/** Branded customer invoice / receipt. */
export function customerInvoice(order: InvoiceOrder, rawCfg?: Partial<InvoiceConfig> | null, autoprint = false): string {
  const cfg = cfgOrDefault(rawCfg);
  const when = order.placedAt ? new Date(order.placedAt).toLocaleString('en-IN') : '';
  const cols = cfg.columns;

  const head = `
    <div class="center">
      ${cfg.showLogo && cfg.logoUrl ? `<img class="logo" src="${esc(cfg.logoUrl)}" alt="">` : ''}
      <div class="brand">${esc(cfg.brandName)}</div>
      ${cfg.tagline ? `<div class="tagline">${esc(cfg.tagline)}</div>` : ''}
      ${cfg.addressLine ? `<div class="meta">${esc(cfg.addressLine)}</div>` : ''}
      ${cfg.phone ? `<div class="meta">${esc(cfg.phone)}</div>` : ''}
      ${cfg.showGstin && cfg.gstin ? `<div class="meta">GSTIN: ${esc(cfg.gstin)}</div>` : ''}
      ${cfg.showFssai && cfg.fssai ? `<div class="meta">FSSAI: ${esc(cfg.fssai)}</div>` : ''}
    </div>
    <hr class="rule-solid">
    ${cfg.headerNote ? `<div class="note">${esc(cfg.headerNote)}</div>` : ''}
    <div class="meta"><b>Order:</b> ${esc(order.orderNumber)}</div>
    ${when ? `<div class="meta"><b>Date:</b> ${esc(when)}</div>` : ''}
    ${cfg.showPaymentMethod && order.paymentMethod ? `<div class="meta"><b>Payment:</b> ${esc((order.paymentMethod || '').toUpperCase())}</div>` : ''}
    ${cfg.showCustomer && (order.customerName || order.deliveryAddress) ? `
      <hr class="rule">
      ${order.customerName ? `<div class="meta"><b>${esc(order.customerName)}</b></div>` : ''}
      ${order.customerMobile ? `<div class="meta">${esc(order.customerMobile)}</div>` : ''}
      ${order.deliveryAddress ? `<div class="meta">${esc(order.deliveryAddress)}</div>` : ''}
    ` : ''}
    <hr class="rule">`;

  let itemsBlock = '';
  if (cfg.showItemsTable) {
    const colCount = 1 + (cols.qty ? 1 : 0) + (cols.unitPrice ? 1 : 0) + (cols.lineTotal ? 1 : 0);
    itemsBlock = `<table><thead><tr>
        <th>Item</th>
        ${cols.qty ? '<th class="num">Qty</th>' : ''}
        ${cols.unitPrice ? '<th class="num">Rate</th>' : ''}
        ${cols.lineTotal ? '<th class="num">Amt</th>' : ''}
      </tr></thead><tbody>
      ${order.items.map((it) => `<tr>
        <td>${esc(it.productName)}</td>
        ${cols.qty ? `<td class="num">${it.quantity}</td>` : ''}
        ${cols.unitPrice ? `<td class="num">${money(it.unitPrice)}</td>` : ''}
        ${cols.lineTotal ? `<td class="num">${money(it.lineTotal)}</td>` : ''}
      </tr>`).join('')}
      </tbody></table><hr class="rule">`;
    void colCount;
  }

  const totalRow = (label: string, value: string, cls = '') =>
    `<tr class="totrow ${cls}"><td>${esc(label)}</td><td class="num">${value}</td></tr>`;

  const totals = `<table>
    ${totalRow('Item total', money(order.subtotal))}
    ${Number(order.discount) > 0 ? totalRow('Discount', '- ' + money(Number(order.discount))) : ''}
    ${totalRow('Delivery', Number(order.deliveryCharge) === 0 ? 'FREE' : money(Number(order.deliveryCharge || 0)))}
    ${cfg.showTaxBreakup && Number(order.tax) > 0 ? totalRow('Taxes', money(Number(order.tax))) : ''}
    ${Number(order.tip) > 0 ? totalRow('Rider tip', money(Number(order.tip))) : ''}
    ${Number(order.walletUsed) > 0 ? totalRow('Wallet', '- ' + money(Number(order.walletUsed))) : ''}
    ${totalRow('TOTAL', money(order.total), 'grand')}
  </table>`;

  const footer = `
    ${cfg.showQrNote ? `<div class="footer">Scan the QR on your tracking page to reorder.</div>` : ''}
    ${cfg.footerNote ? `<div class="footer">${esc(cfg.footerNote)}</div>` : ''}
    ${cfg.thankYouNote ? `<div class="footer" style="font-weight:700;">${esc(cfg.thankYouNote)}</div>` : ''}`;

  return wrap(cfg, `Invoice ${order.orderNumber}`, head + itemsBlock + totals + footer, autoprint);
}

/** Compact kitchen ticket — big item names + qty, notes, no prices. */
export function chefTicket(order: InvoiceOrder, rawCfg?: Partial<InvoiceConfig> | null, autoprint = false): string {
  const cfg = cfgOrDefault(rawCfg);
  const when = order.placedAt ? new Date(order.placedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';

  const inner = `
    <div class="center">
      <div class="brand" style="color:#000;">${esc(cfg.chefTicketTitle || 'KITCHEN TICKET')}</div>
      <div class="meta"><b>${esc(order.orderNumber)}</b>${when ? ` &middot; ${esc(when)}` : ''}</div>
    </div>
    <hr class="rule-solid">
    <table><tbody>
      ${order.items.map((it) => `<tr>
        <td class="big-item"><span class="qtybox">${it.quantity}</span>${esc(it.productName)}</td>
      </tr>`).join('')}
    </tbody></table>
    ${cfg.chefShowNotes && order.cookingNote ? `<div class="note"><b>Cooking note:</b> ${esc(order.cookingNote)}</div>` : ''}
    ${cfg.chefShowNotes && order.deliveryInstructions ? `<div class="note"><b>Delivery:</b> ${esc(order.deliveryInstructions)}</div>` : ''}
    <hr class="rule">
    <div class="center meta">${esc(order.items.reduce((s, i) => s + i.quantity, 0))} item(s)</div>`;

  return wrap(cfg, `Ticket ${order.orderNumber}`, inner, autoprint);
}

/** Open an HTML document in a hidden iframe and trigger the print dialog. */
export function printHtml(html: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open(); doc.write(html); doc.close();
  const win = iframe.contentWindow!;
  const fire = () => {
    try { win.focus(); win.print(); } catch { /* ignore */ }
    setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* */ } }, 1000);
  };
  // give images/fonts a beat to load
  setTimeout(fire, 350);
}

/** Open the raw HTML in a new tab (useful for previewing the layout). */
export function openHtmlPreview(html: string) {
  const w = window.open('', '_blank');
  if (w) { w.document.open(); w.document.write(html); w.document.close(); }
}
