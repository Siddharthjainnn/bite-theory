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
  /* GST (snapshotted per order at checkout, never recomputed) */
  invoiceNo?: string | null;
  taxRate?: number; cgst?: number; sgst?: number;
  deliveryAddress?: string | null;
  customerName?: string | null;
  customerMobile?: string | null;
  paymentMethod?: string | null;
  cookingNote?: string | null;
  deliveryInstructions?: string | null;
  status?: string | null;
}

const money = (n: number) => '\u20B9' + Number(n || 0).toLocaleString('en-IN');

/** Grab a clean first name from a full name for the personalized greeting. */
function firstName(full?: string | null): string {
  const n = String(full ?? '').trim().split(/\s+/)[0] || '';
  if (!n) return '';
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** Pick a greeting template deterministically from the order number, so one bill
 *  always shows the same line but different orders vary naturally. */
function pickGreeting(templates: string[], seed: string): string {
  const list = (templates || []).filter((t) => t && t.trim());
  if (!list.length) return '';
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

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
  // Thermal heads print grey when given #333/#555 — force pure black and heavier
  // weights so every line burns solid. On A4 keep the softer greys.
  const ink      = isThermal ? '#000' : '#111';
  const inkSoft  = isThermal ? '#000' : '#333';
  const inkFaint = isThermal ? '#000' : '#555';
  const ruleCol  = isThermal ? '#000' : '#999';
  const bodyWeight = isThermal ? 600 : 400; // thicker default stroke on thermal
  return `
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html,body { margin:0; padding:0; }
    body { font-family: ${isThermal ? "'Courier New', ui-monospace, monospace" : "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"};
      font-size:${base}px; color:${ink}; font-weight:${bodyWeight}; line-height:1.4; }
    .doc { width:${contentWidth(cfg.paper)}; margin:0 auto; padding:${isThermal ? '6px 2px' : '18px'}; }
    .center { text-align:center; }
    .brand { font-weight:800; font-size:${isThermal ? 18 : 22}px; letter-spacing:.5px; color:${isThermal ? '#000' : esc(cfg.accentColor)}; }
    .tagline { font-size:${base - 2}px; color:${inkFaint}; margin-top:2px; }
    .meta { font-size:${base - 1}px; color:${inkSoft}; font-weight:${isThermal ? 600 : 400}; }
    .logo { max-width:${isThermal ? '120px' : '160px'}; max-height:64px; object-fit:contain; margin:0 auto 4px; display:block; }
    .rule { border:none; border-top:1px dashed ${ruleCol}; margin:8px 0; }
    .rule-solid { border:none; border-top:2px solid ${isThermal ? '#000' : esc(cfg.accentColor)}; margin:8px 0; }
    table { width:100%; border-collapse:collapse; }
    th,td { text-align:left; padding:${isThermal ? '2px 0' : '5px 4px'}; font-size:${base - 1}px; vertical-align:top; }
    th { border-bottom:1px solid #000; font-weight:800; }
    td { font-weight:${isThermal ? 600 : 400}; }
    .item-name { font-weight:${isThermal ? 700 : 600}; }
    .num { text-align:right; white-space:nowrap; }
    .totrow td { padding:2px 4px; font-weight:${isThermal ? 700 : 600}; }
    .grand td { font-weight:900; font-size:${base + 3}px; border-top:2px solid #000; padding-top:5px; }
    .note { background:${isThermal ? '#fff' : '#f4f4f4'}; border-left:3px solid #000; padding:6px 8px; margin:6px 0; font-size:${base - 1}px; font-weight:${isThermal ? 700 : 400}; }
    .footer { margin-top:10px; text-align:center; font-size:${base - 1}px; color:${inkSoft}; }
    .big-item { font-size:${isThermal ? 16 : 16}px; font-weight:900; }
    .qtybox { display:inline-block; min-width:26px; padding:1px 6px; border:2px solid #000; font-weight:900; text-align:center; margin-right:8px; }
    .qrrow { display:flex; justify-content:space-around; gap:8px; margin:8px 0 4px; }
    .qrcell { text-align:center; flex:1; }
    .qrimg { display:flex; justify-content:center; }
    .qrimg svg { width:${isThermal ? '96px' : '120px'}; height:auto; }
    .qrcap { font-size:${base - 3}px; line-height:1.25; margin-top:2px; color:#000; }
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

/** Branded customer invoice / receipt.
 *  `qr` carries pre-rendered SVG strings (QR encoding is async, so the caller
 *  generates them via qrSvg() and passes them in — keeps this render sync). */
export function customerInvoice(
  order: InvoiceOrder,
  rawCfg?: Partial<InvoiceConfig> | null,
  autoprint = false,
  qr?: { reorder?: string; insta?: string } | null,
): string {
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
    ${order.invoiceNo
      ? `<div class="meta"><b>Tax Invoice:</b> ${esc(order.invoiceNo)}</div>`
      : ''}
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
        <td class="item-name">${esc(it.productName)}</td>
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
    ${cfg.showTaxBreakup && Number(order.tax) > 0
      ? (Number(order.cgst) > 0 || Number(order.sgst) > 0
          ? totalRow(`CGST @ ${Number(order.taxRate || 0) / 2}%`, money(Number(order.cgst || 0)))
            + totalRow(`SGST @ ${Number(order.taxRate || 0) / 2}%`, money(Number(order.sgst || 0)))
          : totalRow('Taxes', money(Number(order.tax))))
      : ''}
    ${Number(order.tip) > 0 ? totalRow('Rider tip', money(Number(order.tip))) : ''}
    ${Number(order.walletUsed) > 0 ? totalRow('Wallet', '- ' + money(Number(order.walletUsed))) : ''}
    ${totalRow('TOTAL', money(order.total), 'grand')}
  </table>`;

  const qrReorder = cfg.showReorderQr && qr?.reorder ? qr.reorder : '';
  const qrInsta = cfg.showInstaQr && qr?.insta ? qr.insta : '';
  const qrBlock = (qrReorder || qrInsta) ? `
    <hr class="rule">
    <div class="qrrow">
      ${qrReorder ? `<div class="qrcell"><div class="qrimg">${qrReorder}</div><div class="qrcap"><b>Scan to order again</b><br>www.bitestheory.com</div></div>` : ''}
      ${qrInsta ? `<div class="qrcell"><div class="qrimg">${qrInsta}</div><div class="qrcap"><b>Follow us</b><br>${esc(cfg.instagramHandle || '')}</div></div>` : ''}
    </div>` : '';

  const greetName = firstName(order.customerName);
  const greetingLine = cfg.showPersonalGreeting && greetName
    ? pickGreeting(cfg.personalGreetings, order.orderNumber || greetName).replace(/\{name\}/g, greetName)
    : '';

  const footer = `
    ${greetingLine ? `<hr class="rule"><div class="footer center" style="font-weight:800;font-size:13px;">${esc(greetingLine)}</div>` : ''}
    ${qrBlock}
    ${cfg.showWhatsappLine && cfg.whatsappNumber ? `<div class="footer" style="font-weight:800;">📱 Order directly on WhatsApp: ${esc(cfg.whatsappNumber)}</div>` : ''}
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

/**
 * Print the chef ticket AND the customer invoice for one order.
 * They go as TWO separate print jobs so that a printer set to "Document[Cut]"
 * cuts the paper between them — giving you one chef ticket and one bill,
 * each cleanly cut. The gap lets the first job clear before the second fires.
 */
export function printBoth(
  order: InvoiceOrder,
  cfg?: Partial<InvoiceConfig> | null,
  gapMs = 1500,
) {
  printHtml(chefTicket(order, cfg));
  setTimeout(() => printHtml(customerInvoice(order, cfg)), gapMs);
}

/** Open the raw HTML in a new tab (useful for previewing the layout). */
export function openHtmlPreview(html: string) {
  const w = window.open('', '_blank');
  if (w) { w.document.open(); w.document.write(html); w.document.close(); }
}
