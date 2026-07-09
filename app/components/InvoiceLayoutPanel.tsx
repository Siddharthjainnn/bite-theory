'use client';

/**
 * InvoiceLayoutPanel — full admin control over the printable bill.
 *
 * Edits store_settings.invoice_config (single JSONB blob) and shows a LIVE
 * preview of the customer invoice + chef ticket rendered by the same code
 * that prints them from the Orders screen (lib/invoice.ts). Whatever you see
 * here is exactly what prints.
 *
 * Saves via PATCH /settings { invoiceConfig } — protected by AdminWriteGuard.
 */
import { useEffect, useState } from 'react';
import { API_BASE, C, InvoiceConfig, DEFAULT_INVOICE_CONFIG } from '../lib/bite';
import { customerInvoice, chefTicket, InvoiceOrder, printHtml } from '../lib/invoice';

const SAMPLE: InvoiceOrder = {
  orderNumber: 'BT7K2QX',
  placedAt: new Date().toISOString(),
  items: [
    { productName: 'Paneer Tikka Bowl', quantity: 2, unitPrice: 220, lineTotal: 440 },
    { productName: 'Masala Poha', quantity: 1, unitPrice: 80, lineTotal: 80 },
    { productName: 'Cold Coffee', quantity: 1, unitPrice: 120, lineTotal: 120 },
  ],
  subtotal: 640, discount: 64, deliveryCharge: 0, tax: 32, walletUsed: 0, tip: 20, total: 660,
  deliveryAddress: '87, Ratanlok Colony, Indore, MP 452010',
  customerName: 'Aarav Sharma', customerMobile: '+91 90000 11111',
  paymentMethod: 'online',
  cookingNote: 'Less spicy, no onion please',
  deliveryInstructions: 'Ring the bell twice',
  status: 'preparing_food',
};

const box: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginBottom: 16 };
const label: React.CSSProperties = { fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 };
const input: React.CSSProperties = { width: '100%', padding: '9px 11px', border: `1px solid ${C.line}`, borderRadius: 9, fontSize: 13, background: C.bg, color: C.ink, fontFamily: 'inherit' };
const row: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 };

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

export default function InvoiceLayoutPanel({ adminHeaders }: { adminHeaders: () => Record<string, string> }) {
  const [cfg, setCfg] = useState<InvoiceConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [view, setView] = useState<'invoice' | 'chef'>('invoice');

  useEffect(() => {
    fetch(`${API_BASE}/settings`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((s) => setCfg({ ...DEFAULT_INVOICE_CONFIG, ...(s?.invoiceConfig || {}),
        columns: { ...DEFAULT_INVOICE_CONFIG.columns, ...(s?.invoiceConfig?.columns || {}) } }))
      .catch(() => setCfg({ ...DEFAULT_INVOICE_CONFIG }));
  }, []);

  function set<K extends keyof InvoiceConfig>(k: K, v: InvoiceConfig[K]) {
    setCfg((c) => (c ? { ...c, [k]: v } : c));
  }
  function setCol(k: keyof InvoiceConfig['columns'], v: boolean) {
    setCfg((c) => (c ? { ...c, columns: { ...c.columns, [k]: v } } : c));
  }

  async function save() {
    if (!cfg) return;
    setSaving(true); setMsg('');
    try {
      const r = await fetch(`${API_BASE}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ invoiceConfig: cfg }),
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.message || 'Save failed'); }
      setMsg('Saved ✓ — this layout now prints everywhere.');
    } catch (e: any) { setMsg(e.message || 'Save failed'); }
    setSaving(false);
    setTimeout(() => setMsg(''), 3500);
  }

  function resetDefaults() { setCfg({ ...DEFAULT_INVOICE_CONFIG }); }

  if (!cfg) return <div style={{ padding: 30, color: C.muted }}>Loading…</div>;

  const previewHtml = view === 'invoice'
    ? customerInvoice(SAMPLE, cfg)
    : chefTicket(SAMPLE, cfg);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: 0 }}>Invoice Layout</h1>
          <p style={{ color: C.muted, marginTop: 3, fontSize: 13 }}>Fully customize your printed bill & chef ticket. Live preview on the right.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={resetDefaults} style={{ background: '#fff', border: `1px solid ${C.line}`, color: C.ink, fontWeight: 600, fontSize: 13, padding: '9px 16px', borderRadius: 10, cursor: 'pointer' }}>Reset</button>
          <button onClick={save} disabled={saving} style={{ background: C.green, border: `1px solid ${C.green}`, color: '#fff', fontWeight: 700, fontSize: 13, padding: '9px 18px', borderRadius: 10, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save layout'}
          </button>
        </div>
      </div>
      {msg && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: C.greenSoft, color: C.greenDeep, fontSize: 13, fontWeight: 600 }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 18, alignItems: 'start' }}>
        {/* ── editor ── */}
        <div>
          <div style={box}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>🏷️ Branding</div>
            <div style={row}>
              <div><label style={label}>Brand name</label><input style={input} value={cfg.brandName} onChange={(e) => set('brandName', e.target.value)} /></div>
              <div><label style={label}>Tagline</label><input style={input} value={cfg.tagline} onChange={(e) => set('tagline', e.target.value)} /></div>
            </div>
            <div style={row}>
              <div><label style={label}>Address line</label><input style={input} value={cfg.addressLine} onChange={(e) => set('addressLine', e.target.value)} /></div>
              <div><label style={label}>Phone</label><input style={input} value={cfg.phone} onChange={(e) => set('phone', e.target.value)} /></div>
            </div>
            <div style={row}>
              <div><label style={label}>Logo URL</label><input style={input} value={cfg.logoUrl} onChange={(e) => set('logoUrl', e.target.value)} placeholder="https://…" /></div>
              <div><label style={label}>Accent colour</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={cfg.accentColor} onChange={(e) => set('accentColor', e.target.value)} style={{ width: 42, height: 38, border: `1px solid ${C.line}`, borderRadius: 8, background: '#fff', cursor: 'pointer' }} />
                  <input style={input} value={cfg.accentColor} onChange={(e) => set('accentColor', e.target.value)} />
                </div>
              </div>
            </div>
            <div style={row}>
              <div><label style={label}>GSTIN</label><input style={input} value={cfg.gstin} onChange={(e) => set('gstin', e.target.value)} /></div>
              <div><label style={label}>FSSAI licence</label><input style={input} value={cfg.fssai} onChange={(e) => set('fssai', e.target.value)} /></div>
            </div>
          </div>

          <div style={box}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>📄 Paper & sections</div>
            <div style={row}>
              <div>
                <label style={label}>Paper size</label>
                <select style={input} value={cfg.paper} onChange={(e) => set('paper', e.target.value as InvoiceConfig['paper'])}>
                  <option value="thermal58">Thermal 58mm</option>
                  <option value="thermal80">Thermal 80mm</option>
                  <option value="a4">A4</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <Toggle checked={cfg.showLogo} onChange={(v) => set('showLogo', v)}>Show logo</Toggle>
              <Toggle checked={cfg.showCustomer} onChange={(v) => set('showCustomer', v)}>Show customer block</Toggle>
              <Toggle checked={cfg.showGstin} onChange={(v) => set('showGstin', v)}>Show GSTIN</Toggle>
              <Toggle checked={cfg.showFssai} onChange={(v) => set('showFssai', v)}>Show FSSAI</Toggle>
              <Toggle checked={cfg.showItemsTable} onChange={(v) => set('showItemsTable', v)}>Show items table</Toggle>
              <Toggle checked={cfg.showTaxBreakup} onChange={(v) => set('showTaxBreakup', v)}>Show tax line</Toggle>
              <Toggle checked={cfg.showPaymentMethod} onChange={(v) => set('showPaymentMethod', v)}>Show payment method</Toggle>
              <Toggle checked={cfg.showQrNote} onChange={(v) => set('showQrNote', v)}>Show reorder note</Toggle>
            </div>
          </div>

          <div style={box}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>🔢 Item columns</div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <Toggle checked={cfg.columns.qty} onChange={(v) => setCol('qty', v)}>Qty</Toggle>
              <Toggle checked={cfg.columns.unitPrice} onChange={(v) => setCol('unitPrice', v)}>Unit price (rate)</Toggle>
              <Toggle checked={cfg.columns.lineTotal} onChange={(v) => setCol('lineTotal', v)}>Line total</Toggle>
            </div>
          </div>

          <div style={box}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>✍️ Copy</div>
            <div style={{ marginBottom: 12 }}><label style={label}>Header note (top of bill)</label><input style={input} value={cfg.headerNote} onChange={(e) => set('headerNote', e.target.value)} placeholder="optional" /></div>
            <div style={{ marginBottom: 12 }}><label style={label}>Footer note</label><input style={input} value={cfg.footerNote} onChange={(e) => set('footerNote', e.target.value)} /></div>
            <div><label style={label}>Thank-you line</label><input style={input} value={cfg.thankYouNote} onChange={(e) => set('thankYouNote', e.target.value)} /></div>
          </div>

          <div style={box}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>👨‍🍳 Chef ticket</div>
            <div style={{ marginBottom: 12 }}><label style={label}>Ticket title</label><input style={input} value={cfg.chefTicketTitle} onChange={(e) => set('chefTicketTitle', e.target.value)} /></div>
            <Toggle checked={cfg.chefShowNotes} onChange={(v) => set('chefShowNotes', v)}>Show cooking & delivery notes on ticket</Toggle>
          </div>

          <div style={box}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>🖨️ Auto-print</div>
            <Toggle checked={cfg.autoPrintOnReady} onChange={(v) => set('autoPrintOnReady', v)}>
              Auto-print chef ticket when an order comes in
            </Toggle>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
              Browser auto-print works when the Orders tab is open. True unattended thermal printing (no dialog) needs a small local print agent on the shop PC — see <b>AUTO_PRINT_AGENT.md</b> for the exact spec.
            </div>
          </div>
        </div>

        {/* ── live preview ── */}
        <div style={{ position: 'sticky', top: 70 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={() => setView('invoice')} style={{ flex: 1, padding: '8px', borderRadius: 9, border: `1px solid ${view === 'invoice' ? C.green : C.line}`, background: view === 'invoice' ? C.green : '#fff', color: view === 'invoice' ? '#fff' : C.ink, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Customer invoice</button>
            <button onClick={() => setView('chef')} style={{ flex: 1, padding: '8px', borderRadius: 9, border: `1px solid ${view === 'chef' ? C.green : C.line}`, background: view === 'chef' ? C.green : '#fff', color: view === 'chef' ? '#fff' : C.ink, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Chef ticket</button>
          </div>
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden', background: '#e9ecef' }}>
            <iframe
              title="preview"
              srcDoc={previewHtml}
              style={{ width: '100%', height: 480, border: 'none', background: '#fff' }}
            />
          </div>
          <button onClick={() => printHtml(previewHtml)} style={{ width: '100%', marginTop: 10, padding: '10px', borderRadius: 10, border: `1px solid ${C.line}`, background: '#fff', color: C.ink, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            🖨️ Test print this
          </button>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8, textAlign: 'center' }}>Preview uses sample data.</div>
        </div>
      </div>

      <style>{`@media (max-width: 900px){ .bt-content div[style*="grid-template-columns: minmax"]{ grid-template-columns: 1fr !important; } }`}</style>
    </>
  );
}
