'use client';

/**
 * In-store POS (counter) screen.
 * Staff picks products, enters the customer's phone (auto-fills name if the
 * customer already exists), then generates + prints an invoice. The order is
 * saved as a real order so it appears in reports. Payment is taken at the
 * counter (cash/UPI) and just recorded here.
 */

import { useEffect, useMemo, useState } from 'react';
import { API_BASE, fetchStoreSettings, InvoiceConfig } from '../../lib/bite';
import { customerInvoice, printHtml, InvoiceOrder } from '../../lib/invoice';

const C = {
  green: '#1D9E75', dark: '#0D3B2E', orange: '#EF9F27',
  bg: '#F3F8F4', card: '#fff', ink: '#0D3B2E', muted: '#6b8378', line: '#e0e8e3',
};

function adminKey(): string {
  try {
    const raw = localStorage.getItem('bt_admin');
    return raw ? (JSON.parse(raw).adminKey || '') : '';
  } catch { return ''; }
}
const HDR = () => ({ 'Content-Type': 'application/json', 'x-admin-key': adminKey() });

type Product = {
  id: number; name: string; price: number; offerPrice?: number | null;
  categoryId: number; status: string;
};
type Line = { product: Product; qty: number };

const money = (n: number) => '₹' + Number(n || 0).toFixed(0);
const priceOf = (p: Product) =>
  p.offerPrice && p.offerPrice > 0 && p.offerPrice < p.price ? p.offerPrice : p.price;

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [cart, setCart] = useState<Record<number, Line>>({});
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [lookupState, setLookupState] = useState<'idle' | 'looking' | 'found' | 'new'>('idle');
  const [payMethod, setPayMethod] = useState<'cash' | 'upi'>('cash');
  const [invoiceCfg, setInvoiceCfg] = useState<InvoiceConfig | null>(null);
  const [placing, setPlacing] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/products`)
      .then((r) => r.json())
      .then((rows) => setProducts((rows || []).filter((p: Product) => p.status === 'active')))
      .catch(() => {});
    fetchStoreSettings().then((s: any) => setInvoiceCfg(s?.invoiceConfig || null)).catch(() => {});
  }, []);

  // auto-lookup customer when a full 10-digit mobile is entered
  useEffect(() => {
    const m = mobile.replace(/\D/g, '');
    if (m.length !== 10) { setLookupState('idle'); return; }
    let alive = true;
    setLookupState('looking');
    fetch(`${API_BASE}/orders/pos/customer/${m}`, { headers: HDR() })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d?.found) { setName(d.name || ''); setLookupState('found'); }
        else setLookupState('new');
      })
      .catch(() => { if (alive) setLookupState('new'); });
    return () => { alive = false; };
  }, [mobile]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return products;
    return products.filter((p) => p.name.toLowerCase().includes(t));
  }, [products, q]);

  const lines = Object.values(cart);
  const subtotal = lines.reduce((s, l) => s + priceOf(l.product) * l.qty, 0);

  function add(p: Product) {
    setCart((c) => ({ ...c, [p.id]: { product: p, qty: (c[p.id]?.qty || 0) + 1 } }));
  }
  function setQty(id: number, qty: number) {
    setCart((c) => {
      if (qty <= 0) { const n = { ...c }; delete n[id]; return n; }
      return { ...c, [id]: { ...c[id], qty } };
    });
  }

  async function generate() {
    setMsg('');
    const m = mobile.replace(/\D/g, '');
    if (m.length !== 10) { setMsg('Enter a valid 10-digit mobile.'); return; }
    if (!lines.length) { setMsg('Add at least one item.'); return; }
    setPlacing(true);
    try {
      const res = await fetch(`${API_BASE}/orders/pos/order`, {
        method: 'POST',
        headers: HDR(),
        body: JSON.stringify({
          items: lines.map((l) => ({ productId: l.product.id, quantity: l.qty })),
          mobile: m,
          customerName: name.trim() || undefined,
          paymentMethod: payMethod,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.message || 'Failed to create order');
      }
      const order = await res.json();

      // Build the invoice and print
      const inv: InvoiceOrder = {
        orderNumber: order.orderNumber,
        placedAt: order.placedAt || new Date().toISOString(),
        items: order.items,
        subtotal: order.subtotal,
        discount: 0,
        deliveryCharge: 0,
        total: order.total,
        customerName: order.customerName,
        customerMobile: order.customerMobile,
        paymentMethod: order.paymentMethod,
        status: 'order_received',
      } as InvoiceOrder;

      if (invoiceCfg) printHtml(customerInvoice(inv, invoiceCfg));

      setMsg(`✅ Order ${order.orderNumber} created & invoice printed.`);
      // reset for next customer
      setCart({}); setMobile(''); setName(''); setLookupState('idle');
    } catch (e: any) {
      setMsg('⚠️ ' + (e?.message || 'Something went wrong.'));
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ color: C.dark, margin: '4px 0 2px' }}>🧾 Counter / POS</h1>
        <p style={{ color: C.muted, marginTop: 0, fontSize: 14 }}>
          Pick items, enter the customer's phone, generate &amp; print the invoice.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, alignItems: 'start' }}>
          {/* LEFT: product picker */}
          <div style={{ background: C.card, borderRadius: 14, padding: 14, border: `1px solid ${C.line}` }}>
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search items…"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 14, marginBottom: 10 }}
            />
            <div style={{ maxHeight: '65vh', overflowY: 'auto', display: 'grid', gap: 8 }}>
              {shown.map((p) => (
                <button key={p.id} onClick={() => add(p)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.line}`,
                    background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontWeight: 600, color: C.ink }}>{p.name}</span>
                  <span style={{ color: C.green, fontWeight: 800 }}>{money(priceOf(p))} +</span>
                </button>
              ))}
              {!shown.length && <div style={{ color: C.muted, padding: 12 }}>No items match.</div>}
            </div>
          </div>

          {/* RIGHT: cart + customer + generate */}
          <div style={{ background: C.card, borderRadius: 14, padding: 14, border: `1px solid ${C.line}`, position: 'sticky', top: 16 }}>
            <h3 style={{ margin: '2px 0 10px', color: C.dark }}>Order</h3>
            {!lines.length && <div style={{ color: C.muted, fontSize: 14, marginBottom: 10 }}>No items yet — tap items to add.</div>}
            <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
              {lines.map((l) => (
                <div key={l.product.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 14, color: C.ink }}>{l.product.name}</span>
                  <button onClick={() => setQty(l.product.id, l.qty - 1)} style={qtyBtn}>−</button>
                  <span style={{ width: 22, textAlign: 'center', fontWeight: 700 }}>{l.qty}</span>
                  <button onClick={() => setQty(l.product.id, l.qty + 1)} style={qtyBtn}>+</button>
                  <span style={{ width: 54, textAlign: 'right', fontWeight: 700, color: C.ink }}>
                    {money(priceOf(l.product) * l.qty)}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 10, marginBottom: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18, color: C.dark }}>
              <span>Total</span><span>{money(subtotal)}</span>
            </div>

            <input
              value={mobile} onChange={(e) => setMobile(e.target.value)}
              placeholder="Customer mobile (10 digit)" inputMode="numeric"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 14, marginBottom: 6 }}
            />
            {lookupState === 'looking' && <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Looking up…</div>}
            {lookupState === 'found' && <div style={{ fontSize: 12, color: C.green, marginBottom: 6 }}>✓ Existing customer</div>}
            {lookupState === 'new' && <div style={{ fontSize: 12, color: C.orange, marginBottom: 6 }}>New customer — enter name</div>}

            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 14, marginBottom: 10 }}
            />

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['cash', 'upi'] as const).map((m) => (
                <button key={m} onClick={() => setPayMethod(m)}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${payMethod === m ? C.green : C.line}`,
                    background: payMethod === m ? C.green : '#fff', color: payMethod === m ? '#fff' : C.ink }}>
                  {m.toUpperCase()}
                </button>
              ))}
            </div>

            <button onClick={generate} disabled={placing}
              style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
                background: placing ? C.muted : C.green, color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>
              {placing ? 'Generating…' : 'Generate & Print Invoice'}
            </button>

            {msg && <div style={{ marginTop: 10, fontSize: 13, color: msg.startsWith('✅') ? C.green : '#C0392B' }}>{msg}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

const qtyBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 7, border: '1px solid #e0e8e3',
  background: '#fff', cursor: 'pointer', fontWeight: 800, color: '#0D3B2E',
};
