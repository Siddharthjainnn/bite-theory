'use client';

/**
 * Bite Theory — Admin Console v4
 * Location:  app/admin/page.tsx
 *
 * Adds LIVE Orders module (list + status timeline) on top of v3.
 * LIVE & WIRED: Products, Categories, Orders
 * READY TO WIRE: every other module — clean "connect backend" cards.
 */

import { useEffect, useState, useCallback } from 'react';

/* ============ types ============ */
type Status = 'active' | 'inactive';

interface Category {
  id: number; name: string; slug: string;
  description: string; image: string; status: Status; sortOrder: number;
}
interface Product {
  id: number; categoryId: number; name: string; slug: string;
  description: string; image: string; videoUrl: string;
  price: number; offerPrice: number; calories: number; protein: number;
  carbs: number; fat: number; rating: number; status: Status;
}
interface Order {
  id: number; orderNumber: string; userId: number; addressId: number;
  subtotal: number; discount: number; deliveryCharge: number; tax: number;
  walletUsed: number; total: number; status: string; deliverySlot: string;
  deliveryPartnerId: number; placedAt: string; updatedAt: string;
}
interface OrderHistoryEntry { id: number; orderId: number; status: string; note: string; createdAt: string; }
interface OrderItem { id: number; orderId: number; productId: number; productName: string; unitPrice: number; quantity: number; lineTotal: number; }

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://bite-theory-backend.onrender.com';
const money = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

const ORDER_FLOW = [
  { key: 'order_received', label: 'Order Received' },
  { key: 'order_confirmed', label: 'Order Confirmed' },
  { key: 'preparing_food', label: 'Preparing Food' },
  { key: 'food_ready', label: 'Food Ready' },
  { key: 'assigned_to_delivery_partner', label: 'Assigned to Delivery Partner' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'arriving_soon', label: 'Arriving Soon' },
  { key: 'delivered', label: 'Delivered' },
];

/* ============ API layer ============ */
const api = {
  async listProducts(): Promise<Product[]> {
    const r = await fetch(`${API_BASE}/products`);
    if (!r.ok) throw new Error('Failed to load products');
    const rows = await r.json();
    return rows.map((p: any) => ({
      id: Number(p.id), categoryId: Number(p.categoryId), name: p.name, slug: p.slug,
      description: p.description || '', image: p.image || '', videoUrl: p.videoUrl || '',
      price: Number(p.price), offerPrice: Number(p.offerPrice) || 0,
      calories: Number(p.calories) || 0, protein: Number(p.protein) || 0,
      carbs: Number(p.carbs) || 0, fat: Number(p.fat) || 0,
      rating: Number(p.rating) || 0, status: p.status as Status,
    }));
  },
  async createProduct(d: Partial<Product>) {
    const r = await fetch(`${API_BASE}/products`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: d.name, categoryId: d.categoryId, description: d.description, image: d.image,
        videoUrl: d.videoUrl, price: d.price, offerPrice: d.offerPrice, calories: d.calories,
        protein: d.protein, carbs: d.carbs, fat: d.fat, status: d.status,
      }),
    });
    if (!r.ok) throw new Error('Create failed');
    return r.json();
  },
  async updateProduct(id: number, d: Partial<Product>) {
    const r = await fetch(`${API_BASE}/products/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: d.name, categoryId: d.categoryId, description: d.description, image: d.image,
        videoUrl: d.videoUrl, price: d.price, offerPrice: d.offerPrice, calories: d.calories,
        protein: d.protein, carbs: d.carbs, fat: d.fat, status: d.status,
      }),
    });
    if (!r.ok) throw new Error('Update failed');
    return r.json();
  },
  async deleteProduct(id: number) {
    const r = await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Delete failed');
  },
  async listCategories(): Promise<Category[]> {
    const r = await fetch(`${API_BASE}/categories`);
    if (!r.ok) throw new Error('Failed to load categories');
    const rows = await r.json();
    return rows.map((c: any) => ({
      id: Number(c.id), name: c.name, slug: c.slug,
      description: c.description || '', image: c.image || '',
      status: (c.isActive ? 'active' : 'inactive') as Status,
      sortOrder: Number(c.sortOrder) || 0,
    }));
  },
  async createCategory(d: Partial<Category>) {
    const r = await fetch(`${API_BASE}/categories`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: d.name, description: d.description, image: d.image, sortOrder: d.sortOrder, isActive: d.status === 'active' }),
    });
    if (!r.ok) throw new Error('Create failed');
    return r.json();
  },
  async updateCategory(id: number, d: Partial<Category>) {
    const r = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: d.name, description: d.description, image: d.image, sortOrder: d.sortOrder, isActive: d.status === 'active' }),
    });
    if (!r.ok) throw new Error('Update failed');
    return r.json();
  },
  async deleteCategory(id: number) {
    const r = await fetch(`${API_BASE}/categories/${id}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Delete failed');
  },

  async listOrders(): Promise<Order[]> {
    const r = await fetch(`${API_BASE}/orders`);
    if (!r.ok) throw new Error('Failed to load orders');
    const rows = await r.json();
    return rows.map((o: any) => ({
      id: Number(o.id), orderNumber: o.orderNumber, userId: Number(o.userId), addressId: Number(o.addressId),
      subtotal: Number(o.subtotal) || 0, discount: Number(o.discount) || 0, deliveryCharge: Number(o.deliveryCharge) || 0,
      tax: Number(o.tax) || 0, walletUsed: Number(o.walletUsed) || 0, total: Number(o.total) || 0,
      status: o.status, deliverySlot: o.deliverySlot || '', deliveryPartnerId: o.deliveryPartnerId,
      placedAt: o.placedAt, updatedAt: o.updatedAt,
    }));
  },
  async getOrderHistory(orderId: number): Promise<OrderHistoryEntry[]> {
    const r = await fetch(`${API_BASE}/orders/${orderId}/history`);
    if (!r.ok) throw new Error('Failed to load history');
    return r.json();
  },
  async advanceOrderStatus(orderId: number, status: string, note?: string) {
    const r = await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note }),
    });
    if (!r.ok) throw new Error('Status update failed');
    return r.json();
  },

  async listOrderItems(orderId?: number): Promise<OrderItem[]> {
    const url = orderId ? `${API_BASE}/order-items?orderId=${orderId}` : `${API_BASE}/order-items`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Failed to load order items');
    const rows = await r.json();
    return rows.map((i: any) => ({
      id: Number(i.id), orderId: Number(i.orderId), productId: Number(i.productId),
      productName: i.productName, unitPrice: Number(i.unitPrice), quantity: Number(i.quantity), lineTotal: Number(i.lineTotal),
    }));
  },
  async createOrderItem(d: Partial<OrderItem>) {
    const r = await fetch(`${API_BASE}/order-items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: d.orderId, productId: d.productId, productName: d.productName, unitPrice: d.unitPrice, quantity: d.quantity, lineTotal: d.lineTotal }),
    });
    if (!r.ok) throw new Error('Create failed');
    return r.json();
  },
  async updateOrderItem(id: number, d: Partial<OrderItem>) {
    const r = await fetch(`${API_BASE}/order-items/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: d.orderId, productId: d.productId, productName: d.productName, unitPrice: d.unitPrice, quantity: d.quantity, lineTotal: d.lineTotal }),
    });
    if (!r.ok) throw new Error('Update failed');
    return r.json();
  },
  async deleteOrderItem(id: number) {
    const r = await fetch(`${API_BASE}/order-items/${id}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Delete failed');
  },
};

/* ============ tokens ============ */
const C = {
  green: '#4CAF50', darkGreen: '#0D3B2E', orange: '#F59E0B',
  bg: '#F4F6F3', card: '#fff', ink: '#0D3B2E', muted: '#6b7d74',
  line: '#e4ebe6', greenSoft: '#e8f5e9', orangeSoft: '#fef3e2', red: '#d64545',
};

/* ============ nav ============ */
interface NavItem { key: string; label: string; icon: string; table?: string; desc?: string; }
interface NavGroup { title: string; items: NavItem[]; }

const NAV: NavGroup[] = [
  { title: 'Overview', items: [{ key: 'dashboard', label: 'Dashboard', icon: '▦' }] },
  { title: 'Orders', items: [
    { key: 'orders', label: 'Orders', icon: '🧾' },
    { key: 'order_items', label: 'Order Items', icon: '🍽️', table: 'order_items', desc: 'Line items inside each order.' },
  ]},
  { title: 'Catalog', items: [
    { key: 'products', label: 'Products', icon: '🍱' },
    { key: 'categories', label: 'Categories', icon: '🗂️' },
    { key: 'inventory', label: 'Inventory', icon: '📦', table: 'inventory', desc: 'Live stock quantity + low-stock threshold per product.' },
  ]},
  { title: 'Customers', items: [
    { key: 'users', label: 'Customers', icon: '👥', table: 'users', desc: 'Customer accounts, spend, order count, loyalty tier.' },
    { key: 'reviews', label: 'Reviews & Ratings', icon: '⭐', table: 'reviews', desc: 'Star ratings + written reviews per product.' },
    { key: 'addresses', label: 'Addresses', icon: '📍', table: 'addresses', desc: 'Saved delivery addresses per customer.' },
    { key: 'favorites', label: 'Favorites', icon: '❤️', table: 'favorites', desc: 'Which products each customer has favorited.' },
  ]},
  { title: 'Marketing', items: [
    { key: 'coupons', label: 'Coupons', icon: '🎟️', table: 'coupons', desc: 'Promo codes, discount rules, usage limits.' },
    { key: 'campaigns', label: 'Campaigns', icon: '📣', table: 'campaigns', desc: 'Email / SMS / WhatsApp marketing campaigns.' },
    { key: 'banners', label: 'Banners', icon: '🖼️', table: 'banners', desc: 'Homepage offer banners and hero slides.' },
    { key: 'referrals', label: 'Referrals', icon: '🔗', table: 'referrals', desc: 'Referral codes, invites, conversions, rewards.' },
    { key: 'loyalty_points', label: 'Loyalty Points', icon: '🏆', table: 'loyalty_points', desc: 'Bronze/Silver/Gold/Platinum tier tracking.' },
  ]},
  { title: 'Finance', items: [
    { key: 'payments', label: 'Payments', icon: '💳', table: 'payments', desc: 'Razorpay/UPI transactions per order.' },
    { key: 'wallet_transactions', label: 'Wallet Transactions', icon: '👛', table: 'wallet_transactions', desc: 'Wallet credits, debits, refunds.' },
  ]},
  { title: 'Delivery', items: [{ key: 'delivery_partners', label: 'Delivery Partners', icon: '🛵', table: 'delivery_partners', desc: 'Rider accounts, active status, assigned orders.' }] },
  { title: 'Support', items: [
    { key: 'support_tickets', label: 'Support Tickets', icon: '🎧', table: 'support_tickets', desc: 'Customer support requests and resolution status.' },
    { key: 'notifications', label: 'Notifications', icon: '🔔', table: 'notifications', desc: 'Push / Email / SMS / WhatsApp notification log.' },
  ]},
  { title: 'Access Control', items: [
    { key: 'admin_users', label: 'Admin Users', icon: '🛡️', table: 'admin_users', desc: 'Super Admin, Kitchen Manager, Delivery Manager, etc.' },
    { key: 'roles', label: 'Roles & Permissions', icon: '🔑', table: 'roles', desc: 'Role definitions and what each role can access.' },
  ]},
  { title: 'System', items: [{ key: 'audit_logs', label: 'Audit Logs', icon: '📋', table: 'audit_logs', desc: 'Every admin action, who did it, and when.' }] },
];

const ALL_KEYS = NAV.flatMap(g => g.items.map(i => i.key));
type PageKey = typeof ALL_KEYS[number];

/* ============ small UI ============ */
function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  return <div style={{ position: 'fixed', bottom: 20, right: 20, left: 20, maxWidth: 360, marginLeft: 'auto', background: C.darkGreen, color: '#fff', padding: '13px 18px', borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,.25)', zIndex: 300, fontWeight: 500, fontSize: 13 }}>✓ &nbsp;{msg}</div>;
}
function Pill({ kind, children }: { kind: 'active' | 'inactive' | 'low' | 'out'; children: React.ReactNode }) {
  const map: Record<string, [string, string]> = { active: [C.greenSoft, '#2e7d32'], inactive: ['#f0f0f0', '#888'], low: [C.orangeSoft, '#b76e00'], out: ['#fdecec', C.red] };
  const [bg, col] = map[kind];
  return <span style={{ background: bg, color: col, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</span>;
}
function orderStatusPill(status: string) {
  const map: Record<string, [string, string, string]> = {
    order_received: [C.orangeSoft, '#b76e00', 'Order Received'],
    order_confirmed: [C.orangeSoft, '#b76e00', 'Confirmed'],
    preparing_food: [C.orangeSoft, '#b76e00', 'Preparing'],
    food_ready: [C.orangeSoft, '#b76e00', 'Food Ready'],
    assigned_to_delivery_partner: [C.orangeSoft, '#b76e00', 'Assigned'],
    out_for_delivery: [C.orangeSoft, '#b76e00', 'Out for Delivery'],
    arriving_soon: [C.orangeSoft, '#b76e00', 'Arriving Soon'],
    delivered: [C.greenSoft, '#2e7d32', 'Delivered'],
    cancelled: ['#fdecec', C.red, 'Cancelled'],
  };
  const [bg, col, label] = map[status] || ['#f0f0f0', '#888', status];
  return <span style={{ background: bg, color: col, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>;
}

/* ============ charts ============ */
function LineChart({ data, color = C.green, height = 140 }: { data: number[]; color?: string; height?: number }) {
  const w = 320, h = height, pad = 10;
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => [pad + i * stepX, h - pad - ((v - min) / range) * (h - pad * 2)]);
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const area = `${path} L${pts[pts.length - 1][0]},${h - pad} L${pts[0][0]},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height }}>
      <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill="url(#lg)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={color} />)}
    </svg>
  );
}
function HBarList({ items }: { items: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map(it => (
        <div key={it.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}><span style={{ color: C.muted, fontWeight: 600 }}>{it.label}</span><b>{it.value}</b></div>
          <div style={{ height: 8, background: C.bg, borderRadius: 6, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(it.value / max) * 100}%`, background: it.color || C.green, borderRadius: 6, transition: 'width .5s' }} /></div>
        </div>
      ))}
    </div>
  );
}
function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return <span style={{ color: C.orange, fontSize: 12, letterSpacing: 1 }}>{'★'.repeat(full)}{'☆'.repeat(5 - full)} <span style={{ color: C.muted }}>{value.toFixed(1)}</span></span>;
}

const STATUS_COLORS: Record<string, string> = {
  order_received: '#F59E0B', order_confirmed: '#fbbf24', preparing_food: '#fb923c', food_ready: '#f97316',
  assigned_to_delivery: '#34d399', out_for_delivery: '#10b981', arriving_soon: '#059669',
  delivered: '#4CAF50', cancelled: '#d64545',
};

function DonutChart({ data, size = 168 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2 - 14, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.bg} strokeWidth={20} />
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = `${frac * circ} ${circ}`;
          const offset = -acc * circ;
          acc += frac;
          return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={20}
            strokeDasharray={dash} strokeDashoffset={offset} transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />;
        })}
        <text x={cx} y={cy - 3} textAnchor="middle" fontSize="20" fontWeight="800" fill={C.ink}>{total}</text>
        <text x={cx} y={cy + 15} textAnchor="middle" fontSize="10" fill={C.muted}>orders</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minWidth: 140 }}>
        {data.map(d => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flexShrink: 0 }} />
            <span style={{ color: C.muted, flex: 1 }}>{d.label}</span>
            <b>{d.value}</b>
            <span style={{ color: C.muted, fontSize: 11, width: 34, textAlign: 'right' }}>{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data, color = C.green, height = 140 }: { data: { label: string; value: number }[]; color?: string; height?: number }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height, padding: '0 2px' }}>
      {data.map(d => (
        <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}>{d.value > 0 ? d.value : ''}</span>
          <div style={{ width: '100%', maxWidth: 28, height: `${Math.max((d.value / max) * (height - 30), 3)}px`, background: color, borderRadius: '6px 6px 2px 2px', transition: 'height .4s' }} />
          <span style={{ fontSize: 10, color: C.muted }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ============ main ============ */
export default function AdminPage() {
  const [page, setPage] = useState<PageKey>('dashboard');
  const [toast, setToast] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const showToast = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(''), 2400); }, []);
  const currentItem = NAV.flatMap(g => g.items).find(i => i.key === page);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.ink, fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif', fontSize: 14 }}>
      <style>{`
        .bt-shell { display:flex; min-height:100vh; }
        .bt-sidebar { width:264px; background:${C.darkGreen}; color:#cfe3d8; padding:18px 12px 30px; position:fixed; top:0; left:0; height:100vh; overflow-y:auto; z-index:100; transition:transform .25s ease; }
        .bt-main { flex:1; min-width:0; margin-left:264px; }
        .bt-backdrop { display:none; }
        .bt-hamburger { display:none; }
        .bt-grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
        .bt-grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
        .bt-grid-2 { display:grid; grid-template-columns:1.4fr 1fr; gap:14px; }
        .bt-content { padding:22px; max-width:1320px; }
        @media (max-width: 900px) {
          .bt-sidebar { transform:translateX(-100%); width:78vw; max-width:300px; }
          .bt-sidebar.open { transform:translateX(0); box-shadow:0 0 40px rgba(0,0,0,.3); }
          .bt-main { margin-left:0; }
          .bt-hamburger { display:grid; }
          .bt-backdrop.open { display:block; position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:99; }
          .bt-grid-4 { grid-template-columns:repeat(2,1fr); }
          .bt-grid-3 { grid-template-columns:1fr; }
          .bt-grid-2 { grid-template-columns:1fr; }
          .bt-content { padding:14px; }
        }
        @media (max-width: 480px) { .bt-grid-4 { grid-template-columns:1fr 1fr; } }
      `}</style>

      <div className="bt-shell">
        <div className={`bt-backdrop ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
        <aside className={`bt-sidebar ${drawerOpen ? 'open' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg,${C.green},${C.orange})`, display: 'grid', placeItems: 'center', fontWeight: 800, color: '#fff', fontSize: 17 }}>B</div>
            <div><b style={{ color: '#fff', fontSize: 15 }}>Bite Theory</b><span style={{ display: 'block', fontSize: 10, color: '#8fb3a3', letterSpacing: 1 }}>ADMIN CONSOLE</span></div>
            <button onClick={() => setDrawerOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#cfe3d8', fontSize: 20, cursor: 'pointer', display: drawerOpen ? 'block' : 'none' }}>×</button>
          </div>
          {NAV.map(group => (
            <div key={group.title} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#6f9484', margin: '14px 10px 5px', fontWeight: 700 }}>{group.title}</div>
              {group.items.map(item => (
                <div key={item.key} onClick={() => { setPage(item.key); setDrawerOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 9, cursor: 'pointer', marginBottom: 1, fontWeight: 500, fontSize: 13.5, background: page === item.key ? C.green : 'transparent', color: page === item.key ? '#fff' : '#cfe3d8' }}>
                  <span style={{ width: 17, textAlign: 'center', fontSize: 14 }}>{item.icon}</span>{item.label}
                </div>
              ))}
            </div>
          ))}
        </aside>

        <div className="bt-main">
          <header style={{ background: C.card, borderBottom: `1px solid ${C.line}`, padding: '0 18px', height: 58, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40 }}>
            <button className="bt-hamburger" onClick={() => setDrawerOpen(true)} style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${C.line}`, background: '#fff', placeItems: 'center', fontSize: 17, cursor: 'pointer' }}>☰</button>
            <b style={{ fontSize: 14 }}>{currentItem?.label || 'Dashboard'}</b>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 33, height: 33, borderRadius: '50%', background: `linear-gradient(135deg,${C.green},${C.darkGreen})`, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>A</div>
            </div>
          </header>
          <div className="bt-content">
            {page === 'dashboard' && <Dashboard showToast={showToast} />}
            {page === 'products' && <Products showToast={showToast} />}
            {page === 'categories' && <Categories showToast={showToast} />}
            {page === 'orders' && <Orders showToast={showToast} />}
            {page === 'order_items' && <OrderItemsPage showToast={showToast} />}
            {page !== 'dashboard' && page !== 'products' && page !== 'categories' && page !== 'orders' && page !== 'order_items' && currentItem?.table && <ComingSoon item={currentItem} />}
          </div>
        </div>
      </div>
      <Toast msg={toast} />
    </div>
  );
}

/* ============ shared styles ============ */
const cardStyle: React.CSSProperties = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: '0 1px 3px rgba(13,59,46,.06)' };
const btnPrimary: React.CSSProperties = { background: C.green, border: `1px solid ${C.green}`, color: '#fff', fontWeight: 600, fontSize: 13, padding: '9px 16px', borderRadius: 10, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, color: C.ink, fontWeight: 600, fontSize: 13, padding: '9px 16px', borderRadius: 10, cursor: 'pointer' };
const th: React.CSSProperties = { textAlign: 'left', padding: '12px 14px', color: C.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: `1px solid ${C.line}` };
const td: React.CSSProperties = { padding: '12px 14px', borderBottom: `1px solid ${C.line}` };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 13, background: C.bg, color: C.ink, fontFamily: 'inherit' };

function PageHead({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}><div><h1 style={{ fontSize: 20, margin: 0 }}>{title}</h1><p style={{ color: C.muted, marginTop: 3, fontSize: 13 }}>{sub}</p></div>{action}</div>;
}

/* ============ COMING SOON ============ */
function ComingSoon({ item }: { item: NavItem }) {
  return (
    <>
      <PageHead title={item.label} sub={item.desc || ''} />
      <div style={{ ...cardStyle, padding: 36, textAlign: 'center', border: `1.5px dashed ${C.line}` }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>{item.icon}</div>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Ready to connect</div>
        <div style={{ color: C.muted, fontSize: 13, maxWidth: 440, margin: '0 auto 14px' }}>
          This module will manage your <code style={{ background: C.bg, padding: '1px 6px', borderRadius: 5 }}>{item.table}</code> table — full CRUD, built the same way Products, Categories and Orders already work.
        </div>
        <Pill kind="inactive">Not wired yet</Pill>
      </div>
    </>
  );
}

/* ============ DASHBOARD ============ */
function Dashboard({ showToast }: { showToast: (m: string) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'today' | 'week' | 'month' | 'all'>('all');

  useEffect(() => {
    Promise.all([api.listProducts(), api.listOrders().catch(() => [])])
      .then(([p, o]) => { setProducts(p); setOrders(o); })
      .catch(() => showToast('Could not load live data'))
      .finally(() => setLoading(false));
  }, [showToast]);

  const now = new Date();
  const cutoff = (() => {
    if (range === 'today') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
    if (range === 'week') { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
    if (range === 'month') { const d = new Date(now); d.setDate(d.getDate() - 30); return d; }
    return null;
  })();
  const filtered = cutoff ? orders.filter(o => o.placedAt && new Date(o.placedAt) >= cutoff) : orders;

  const topRated = [...products].sort((a, b) => b.rating - a.rating).slice(0, 5);
  const activeOrders = filtered.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
  const revenueLive = filtered.reduce((s, o) => s + o.total, 0);
  const avgOrderValue = filtered.length ? revenueLive / filtered.length : 0;

  const statusDonut = ORDER_FLOW.map(s => ({ label: s.label, value: filtered.filter(o => o.status === s.key).length, color: STATUS_COLORS[s.key] }))
    .concat([{ label: 'Cancelled', value: filtered.filter(o => o.status === 'cancelled').length, color: STATUS_COLORS.cancelled }])
    .filter(s => s.value > 0);

  // group by day for revenue + order-count trend
  const dayKey = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const dayMap = new Map<string, { revenue: number; count: number }>();
  filtered.forEach(o => {
    if (!o.placedAt) return;
    const k = dayKey(new Date(o.placedAt));
    const cur = dayMap.get(k) || { revenue: 0, count: 0 };
    cur.revenue += o.total; cur.count += 1;
    dayMap.set(k, cur);
  });
  const dayEntries = Array.from(dayMap.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const revenueByDay = dayEntries.map(([label, v]) => ({ label, value: Math.round(v.revenue) }));
  const ordersByDay = dayEntries.map(([label, v]) => ({ label, value: v.count }));

  // peak hours
  const hourMap = new Map<number, number>();
  filtered.forEach(o => { if (!o.placedAt) return; const h = new Date(o.placedAt).getHours(); hourMap.set(h, (hourMap.get(h) || 0) + 1); });
  const peakHours = Array.from(hourMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([h, count]) => ({ label: `${h % 12 || 12}${h < 12 ? 'AM' : 'PM'}`, value: count, color: C.orange }));

  const RANGE_LABEL: Record<string, string> = { today: 'Today', week: 'Last 7 days', month: 'Last 30 days', all: 'All time' };

  return (
    <>
      <PageHead title="Dashboard" sub={`Live snapshot — ${RANGE_LABEL[range]}.`}
        action={
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['today', 'week', 'month', 'all'] as const).map(r => (
              <button key={r} onClick={() => setRange(r)} style={{ ...btnGhost, padding: '7px 13px', fontSize: 12, background: range === r ? C.green : '#fff', color: range === r ? '#fff' : C.ink, borderColor: range === r ? C.green : C.line }}>
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
        } />

      <div className="bt-grid-4" style={{ marginBottom: 16 }}>
        {[
          ['Orders', String(filtered.length)],
          ['Revenue', money(revenueLive)],
          ['Avg Order Value', money(Math.round(avgOrderValue))],
          ['Active Orders', String(activeOrders.length)],
        ].map(([lbl, val]) => (
          <div key={lbl} style={{ ...cardStyle, padding: 16 }}>
            <div style={{ color: C.muted, fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase' }}>{lbl}</div>
            <div style={{ fontSize: 25, fontWeight: 800, margin: '7px 0 2px' }}>{val}</div>
          </div>
        ))}
      </div>

      <div className="bt-grid-2" style={{ marginBottom: 16 }}>
        <div style={cardStyle}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.line}` }}><b style={{ fontSize: 14 }}>Revenue by day</b></div>
          <div style={{ padding: 16 }}>
            {revenueByDay.length === 0 ? <div style={{ color: C.muted, fontSize: 13 }}>No orders in this range yet.</div> : <BarChart data={revenueByDay} color={C.green} />}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.line}` }}><b style={{ fontSize: 14 }}>Order status breakdown</b></div>
          <div style={{ padding: 16 }}>
            {statusDonut.length === 0 ? <div style={{ color: C.muted, fontSize: 13 }}>No orders in this range yet.</div> : <DonutChart data={statusDonut} />}
          </div>
        </div>
      </div>

      <div className="bt-grid-2" style={{ marginBottom: 16 }}>
        <div style={cardStyle}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.line}` }}><b style={{ fontSize: 14 }}>Orders placed by day</b></div>
          <div style={{ padding: 16 }}>
            {ordersByDay.length === 0 ? <div style={{ color: C.muted, fontSize: 13 }}>No orders in this range yet.</div> : <BarChart data={ordersByDay} color={C.orange} />}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.line}` }}><b style={{ fontSize: 14 }}>Peak ordering hours</b></div>
          <div style={{ padding: 16 }}>
            {peakHours.length === 0 ? <div style={{ color: C.muted, fontSize: 13 }}>No orders in this range yet.</div> : <HBarList items={peakHours} />}
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between' }}>
          <b style={{ fontSize: 14 }}>Top rated products</b>
          <span style={{ fontSize: 9, color: '#2e7d32', background: C.greenSoft, padding: '1px 6px', borderRadius: 5, alignSelf: 'center' }}>live</span>
        </div>
        <div style={{ padding: '6px 16px' }}>
          {loading ? <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>Loading…</div>
            : topRated.length === 0 ? <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>No products yet.</div>
            : topRated.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.line}` }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: C.greenSoft, display: 'grid', placeItems: 'center', fontSize: 16, overflow: 'hidden', flexShrink: 0 }}>
                  {p.image && p.image.startsWith('http') ? <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.image || '🍱')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <Stars value={p.rating} />
                </div>
                <b style={{ fontSize: 13 }}>{money(p.offerPrice > 0 ? p.offerPrice : p.price)}</b>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}

/* ============ ORDERS (live) ============ */
function Orders({ showToast }: { showToast: (m: string) => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'delivered'>('all');
  const [selected, setSelected] = useState<Order | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setOrders(await api.listOrders()); } catch (e: any) { showToast(e.message || 'Load failed'); }
    setLoading(false);
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  let filtered = orders;
  if (filter === 'active') filtered = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
  if (filter === 'delivered') filtered = orders.filter(o => o.status === 'delivered');

  return (
    <>
      <PageHead title="Orders" sub="Live order list — click Track to view & advance the status timeline." />
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['all', 'active', 'delivered'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ ...btnGhost, background: filter === f ? C.green : '#fff', color: filter === f ? '#fff' : C.ink, borderColor: filter === f ? C.green : C.line, textTransform: 'capitalize' }}>{f}</button>
        ))}
      </div>
      <div style={{ ...cardStyle, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
          <thead><tr><th style={th}>Order #</th><th style={th}>Customer</th><th style={th}>Total</th><th style={th}>Status</th><th style={th}>Placed</th><th style={th}></th></tr></thead>
          <tbody>
            {loading ? <tr><td style={td} colSpan={6}>Loading…</td></tr>
              : filtered.length === 0 ? <tr><td style={{ ...td, textAlign: 'center', padding: 50, color: C.muted }} colSpan={6}>No orders yet. Orders placed by customers will appear here.</td></tr>
              : filtered.map(o => (
                <tr key={o.id}>
                  <td style={td}><b>{o.orderNumber}</b></td>
                  <td style={td}>User #{o.userId}</td>
                  <td style={td}><b>{money(o.total)}</b></td>
                  <td style={td}>{orderStatusPill(o.status)}</td>
                  <td style={td}><small>{o.placedAt ? new Date(o.placedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</small></td>
                  <td style={td}><button style={{ ...btnGhost, padding: '6px 12px', fontSize: 12 }} onClick={() => setSelected(o)}>Track →</button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {selected && <OrderDetail order={selected} onClose={() => setSelected(null)} onChanged={load} showToast={showToast} />}
    </>
  );
}

function OrderDetail({ order, onClose, onChanged, showToast }:
  { order: Order; onClose: () => void; onChanged: () => void; showToast: (m: string) => void }) {
  const [history, setHistory] = useState<OrderHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(order);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setHistory(await api.getOrderHistory(order.id)); } catch (e: any) { showToast(e.message || 'Could not load history'); }
    setLoading(false);
  }, [order.id, showToast]);
  useEffect(() => { load(); }, [load]);

  const curIdx = ORDER_FLOW.findIndex(s => s.key === current.status);
  const isCancelled = current.status === 'cancelled';
  const nextStep = !isCancelled ? ORDER_FLOW[curIdx + 1] : null;

  async function advance() {
    if (!nextStep) return;
    setBusy(true);
    try {
      const updated = await api.advanceOrderStatus(order.id, nextStep.key);
      setCurrent((c) => ({ ...c, status: nextStep.key }));
      showToast(`Advanced to "${nextStep.label}"`);
      await load(); onChanged();
    } catch (e: any) { showToast(e.message || 'Could not advance'); }
    setBusy(false);
  }

  return (
    <Modal title={`Order ${order.orderNumber}`} onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div><small style={{ color: C.muted }}>CUSTOMER</small><br /><b>User #{order.userId}</b></div>
        <div style={{ textAlign: 'right' }}><small style={{ color: C.muted }}>TOTAL</small><br /><b style={{ fontSize: 17 }}>{money(order.total)}</b></div>
      </div>
      {isCancelled && <div style={{ marginBottom: 14 }}>{orderStatusPill('cancelled')}</div>}

      <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13 }}>Status timeline</div>
      <div>
        {ORDER_FLOW.map((s, i) => {
          const done = i < curIdx || (i === curIdx);
          const isCurrent = i === curIdx;
          const histEntry = history.find(h => h.status === s.key);
          return (
            <div key={s.key} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: i === ORDER_FLOW.length - 1 ? 0 : 20 }}>
              {i !== ORDER_FLOW.length - 1 && <div style={{ position: 'absolute', left: 12, top: 26, bottom: -4, width: 2, background: i < curIdx ? C.green : C.line }} />}
              <div style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${done ? C.green : C.line}`, background: done ? C.green : '#fff', color: done ? '#fff' : C.muted, display: 'grid', placeItems: 'center', fontSize: 11, flexShrink: 0, zIndex: 1, boxShadow: isCurrent ? `0 0 0 4px ${C.orangeSoft}` : 'none', borderColor: isCurrent ? C.orange : (done ? C.green : C.line) }}>
                {i < curIdx ? '✓' : isCurrent ? '●' : ''}
              </div>
              <div>
                <b style={{ fontSize: 13, color: isCurrent ? C.orange : C.ink }}>{s.label}</b>
                {histEntry && <div style={{ fontSize: 11, color: C.muted }}>{new Date(histEntry.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
        <button style={btnGhost} onClick={onClose}>Close</button>
        {isCancelled ? <Pill kind="out">Order cancelled</Pill>
          : nextStep ? <button style={btnPrimary} disabled={busy} onClick={advance}>{busy ? 'Updating…' : `Advance → ${nextStep.label}`}</button>
          : <Pill kind="active">Order complete</Pill>}
      </div>
    </Modal>
  );
}

/* ============ PRODUCTS (live) ============ */
/* ============ ORDER ITEMS (live) ============ */
function OrderItemsPage({ showToast }: { showToast: (m: string) => void }) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState<number | 'all'>('all');
  const [editing, setEditing] = useState<Partial<OrderItem> | null>(null);
  const [confirmDel, setConfirmDel] = useState<OrderItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [i, o, p] = await Promise.all([api.listOrderItems(), api.listOrders().catch(() => []), api.listProducts().catch(() => [])]);
      setItems(i); setOrders(o); setProducts(p);
    } catch (e: any) { showToast(e.message || 'Load failed'); }
    setLoading(false);
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const orderNumber = (id: number) => orders.find(o => o.id === id)?.orderNumber || `#${id}`;
  const filtered = orderFilter === 'all' ? items : items.filter(i => i.orderId === orderFilter);

  async function save(d: Partial<OrderItem>) {
    try {
      if (d.id) await api.updateOrderItem(d.id, d); else await api.createOrderItem(d);
      setEditing(null); showToast(d.id ? 'Item updated' : 'Item added'); load();
    } catch (e: any) { showToast(e.message || 'Save failed'); }
  }
  async function del(i: OrderItem) {
    try { await api.deleteOrderItem(i.id); setConfirmDel(null); showToast('Item deleted'); load(); }
    catch (e: any) { showToast(e.message || 'Delete failed'); }
  }

  return (
    <>
      <PageHead title="Order Items" sub="Line items inside each order."
        action={<button style={btnPrimary} onClick={() => setEditing({ orderId: orders[0]?.id, quantity: 1, unitPrice: 0, lineTotal: 0 })}>＋ Add Item</button>} />
      <div style={{ marginBottom: 14 }}>
        <select style={{ ...inputStyle, maxWidth: 260, width: 'auto' }} value={orderFilter} onChange={e => setOrderFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
          <option value="all">All orders</option>
          {orders.map(o => <option key={o.id} value={o.id}>{o.orderNumber}</option>)}
        </select>
      </div>
      <div style={{ ...cardStyle, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
          <thead><tr><th style={th}>Order</th><th style={th}>Product</th><th style={th}>Unit Price</th><th style={th}>Qty</th><th style={th}>Line Total</th><th style={th}></th></tr></thead>
          <tbody>
            {loading ? <tr><td style={td} colSpan={6}>Loading…</td></tr>
              : filtered.length === 0 ? <tr><td style={{ ...td, textAlign: 'center', padding: 50, color: C.muted }} colSpan={6}>No order items yet.</td></tr>
              : filtered.map(i => (
                <tr key={i.id}>
                  <td style={td}><b>{orderNumber(i.orderId)}</b></td>
                  <td style={td}>{i.productName}</td>
                  <td style={td}>{money(i.unitPrice)}</td>
                  <td style={td}>{i.quantity}</td>
                  <td style={td}><b>{money(i.lineTotal)}</b></td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setEditing(i)} style={{ ...btnGhost, padding: '6px 10px' }}>✏️</button>
                      <button onClick={() => setConfirmDel(i)} style={{ ...btnGhost, padding: '6px 10px', color: C.red }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {editing && <OrderItemModal item={editing} orders={orders} products={products} onClose={() => setEditing(null)} onSave={save} />}
      {confirmDel && (
        <Modal title="Delete order item" onClose={() => setConfirmDel(null)}>
          <p>Delete <b>{confirmDel.productName}</b> from {orderNumber(confirmDel.orderId)}?</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <button style={btnGhost} onClick={() => setConfirmDel(null)}>Cancel</button>
            <button style={{ ...btnPrimary, background: C.red, borderColor: C.red }} onClick={() => del(confirmDel)}>Delete</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function OrderItemModal({ item, orders, products, onClose, onSave }:
  { item: Partial<OrderItem>; orders: Order[]; products: Product[]; onClose: () => void; onSave: (d: Partial<OrderItem>) => void }) {
  const [f, setF] = useState<Partial<OrderItem>>({ orderId: orders[0]?.id, productId: products[0]?.id, productName: '', unitPrice: 0, quantity: 1, lineTotal: 0, ...item });
  const set = (k: keyof OrderItem, v: any) => setF(s => ({ ...s, [k]: v }));

  function pickProduct(pid: number) {
    const p = products.find(x => x.id === pid);
    if (!p) return;
    const price = p.offerPrice > 0 ? p.offerPrice : p.price;
    setF(s => ({ ...s, productId: pid, productName: p.name, unitPrice: price, lineTotal: price * (s.quantity || 1) }));
  }
  function setQty(q: number) {
    setF(s => ({ ...s, quantity: q, lineTotal: (s.unitPrice || 0) * q }));
  }
  function setUnitPrice(p: number) {
    setF(s => ({ ...s, unitPrice: p, lineTotal: p * (s.quantity || 1) }));
  }

  return (
    <Modal title={item.id ? 'Edit Order Item' : 'Add Order Item'} onClose={onClose}>
      <Field label="Order *">
        <select style={inputStyle} value={f.orderId} onChange={e => set('orderId', Number(e.target.value))}>
          {orders.map(o => <option key={o.id} value={o.id}>{o.orderNumber}</option>)}
        </select>
      </Field>
      <Field label="Pick a product (auto-fills name & price)">
        <select style={inputStyle} value={f.productId} onChange={e => pickProduct(Number(e.target.value))}>
          <option value="">— choose —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Product name *"><input style={inputStyle} value={f.productName || ''} onChange={e => set('productName', e.target.value)} placeholder="e.g. Grilled Chicken Bowl" /></Field>
      <Row3>
        <Field label="Unit price (₹) *"><input style={inputStyle} type="number" value={f.unitPrice || ''} onChange={e => setUnitPrice(Number(e.target.value) || 0)} /></Field>
        <Field label="Quantity *"><input style={inputStyle} type="number" min={1} value={f.quantity || ''} onChange={e => setQty(Number(e.target.value) || 1)} /></Field>
        <Field label="Line total (₹)"><input style={inputStyle} type="number" value={f.lineTotal || ''} onChange={e => set('lineTotal', Number(e.target.value) || 0)} /></Field>
      </Row3>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={btnPrimary} onClick={() => { if (!f.orderId || !f.productName) return alert('Order and product name are required'); onSave(f); }}>{item.id ? 'Save changes' : 'Add item'}</button>
      </div>
    </Modal>
  );
}

function Products({ showToast }: { showToast: (m: string) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [confirmDel, setConfirmDel] = useState<Product | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([api.listProducts(), api.listCategories().catch(() => [])]);
      setProducts(p); setCats(c);
    } catch (e: any) { showToast(e.message || 'Load failed'); }
    setLoading(false);
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const catName = (id: number) => cats.find(c => c.id === id)?.name || '—';

  async function save(d: Partial<Product>) {
    try {
      if (d.id) await api.updateProduct(d.id, d); else await api.createProduct(d);
      setEditing(null); showToast(d.id ? 'Product updated' : 'Product created'); load();
    } catch (e: any) { showToast(e.message || 'Save failed'); }
  }
  async function del(p: Product) {
    try { await api.deleteProduct(p.id); setConfirmDel(null); showToast('Product deleted'); load(); }
    catch (e: any) { showToast(e.message || 'Delete failed'); }
  }

  return (
    <>
      <PageHead title="Products" sub="Manage your menu — pricing, nutrition, media & status."
        action={<button style={btnPrimary} onClick={() => setEditing({ status: 'active', categoryId: cats[0]?.id })}>＋ Add Product</button>} />
      <div style={{ ...cardStyle, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
          <thead><tr><th style={th}>Product</th><th style={th}>Category</th><th style={th}>Nutrition</th><th style={th}>Price</th><th style={th}>Status</th><th style={th}></th></tr></thead>
          <tbody>
            {loading ? <tr><td style={td} colSpan={6}>Loading…</td></tr>
              : products.length === 0 ? <tr><td style={{ ...td, textAlign: 'center', padding: 50, color: C.muted }} colSpan={6}>No products yet. Click "Add Product".</td></tr>
              : products.map(p => {
                const off = p.offerPrice > 0;
                return (
                  <tr key={p.id}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: C.greenSoft, display: 'grid', placeItems: 'center', fontSize: 17, overflow: 'hidden', flexShrink: 0 }}>
                          {p.image && p.image.startsWith('http') ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.image || '🍱')}
                        </div>
                        <div><b>{p.name}</b><div style={{ color: C.muted, fontSize: 12 }}>{p.description.slice(0, 36)}</div></div>
                      </div>
                    </td>
                    <td style={td}>{catName(p.categoryId)}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {[`${p.calories}cal`, `${p.protein}g P`, `${p.carbs}g C`, `${p.fat}g F`].map(x => <span key={x} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: C.bg, color: C.muted, fontWeight: 600 }}>{x}</span>)}
                      </div>
                    </td>
                    <td style={td}><b>{money(off ? p.offerPrice : p.price)}</b>{off && <s style={{ color: C.muted, marginLeft: 5, fontSize: 12 }}>{money(p.price)}</s>}</td>
                    <td style={td}><Pill kind={p.status}>{p.status === 'active' ? 'Active' : 'Inactive'}</Pill></td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setEditing(p)} style={{ ...btnGhost, padding: '6px 10px' }}>✏️</button>
                        <button onClick={() => setConfirmDel(p)} style={{ ...btnGhost, padding: '6px 10px', color: C.red }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {editing && <ProductModal product={editing} cats={cats} onClose={() => setEditing(null)} onSave={save} />}
      {confirmDel && (
        <Modal title="Delete product" onClose={() => setConfirmDel(null)}>
          <p>Delete <b>{confirmDel.name}</b>? This can't be undone.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <button style={btnGhost} onClick={() => setConfirmDel(null)}>Cancel</button>
            <button style={{ ...btnPrimary, background: C.red, borderColor: C.red }} onClick={() => del(confirmDel)}>Delete</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function ProductModal({ product, cats, onClose, onSave }:
  { product: Partial<Product>; cats: Category[]; onClose: () => void; onSave: (d: Partial<Product>) => void }) {
  const [f, setF] = useState<Partial<Product>>({ name: '', description: '', image: '', videoUrl: '', price: 0, offerPrice: 0, calories: 0, protein: 0, carbs: 0, fat: 0, status: 'active', categoryId: cats[0]?.id, ...product });
  const set = (k: keyof Product, v: any) => setF(s => ({ ...s, [k]: v }));
  const num = (k: keyof Product, v: string) => set(k, v === '' ? 0 : Number(v));
  return (
    <Modal title={product.id ? 'Edit Product' : 'Add Product'} onClose={onClose}>
      <Field label="Product name *"><input style={inputStyle} value={f.name || ''} onChange={e => set('name', e.target.value)} placeholder="e.g. Grilled Chicken Bowl" /></Field>
      <Row>
        <Field label="Category *"><select style={inputStyle} value={f.categoryId} onChange={e => set('categoryId', Number(e.target.value))}>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Status"><select style={inputStyle} value={f.status} onChange={e => set('status', e.target.value as Status)}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
      </Row>
      <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 70 }} value={f.description || ''} onChange={e => set('description', e.target.value)} /></Field>
      <Row>
        <Field label="Price (₹) *"><input style={inputStyle} type="number" value={f.price || ''} onChange={e => num('price', e.target.value)} /></Field>
        <Field label="Offer price (₹)"><input style={inputStyle} type="number" value={f.offerPrice || ''} onChange={e => num('offerPrice', e.target.value)} /></Field>
      </Row>
      <Row3>
        <Field label="Calories"><input style={inputStyle} type="number" value={f.calories || ''} onChange={e => num('calories', e.target.value)} /></Field>
        <Field label="Protein (g)"><input style={inputStyle} type="number" value={f.protein || ''} onChange={e => num('protein', e.target.value)} /></Field>
        <Field label="Carbs (g)"><input style={inputStyle} type="number" value={f.carbs || ''} onChange={e => num('carbs', e.target.value)} /></Field>
      </Row3>
      <Row>
        <Field label="Fat (g)"><input style={inputStyle} type="number" value={f.fat || ''} onChange={e => num('fat', e.target.value)} /></Field>
        <Field label="Image URL"><input style={inputStyle} value={f.image || ''} onChange={e => set('image', e.target.value)} placeholder="https://… or emoji" /></Field>
      </Row>
      <Field label="Video URL"><input style={inputStyle} value={f.videoUrl || ''} onChange={e => set('videoUrl', e.target.value)} placeholder="https://…/preview.mp4" /></Field>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={btnPrimary} onClick={() => { if (!f.name || !f.price) return alert('Name and price are required'); onSave(f); }}>{product.id ? 'Save changes' : 'Create product'}</button>
      </div>
    </Modal>
  );
}

/* ============ CATEGORIES (live) ============ */
function Categories({ showToast }: { showToast: (m: string) => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [confirmDel, setConfirmDel] = useState<Category | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCats(await api.listCategories()); } catch (e: any) { showToast(e.message || 'Load failed'); }
    setLoading(false);
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  async function save(d: Partial<Category>) {
    try {
      if (d.id) await api.updateCategory(d.id, d); else await api.createCategory(d);
      setEditing(null); showToast(d.id ? 'Category updated' : 'Category created'); load();
    } catch (e: any) { showToast(e.message || 'Save failed'); }
  }
  async function del(c: Category) {
    try { await api.deleteCategory(c.id); setConfirmDel(null); showToast('Category deleted'); load(); }
    catch (e: any) { showToast(e.message || 'Delete failed'); }
  }

  const nextSort = cats.length ? Math.max(...cats.map(c => c.sortOrder || 0)) + 1 : 1;

  return (
    <>
      <PageHead title="Categories" sub="Organize your menu into sections." action={<button style={btnPrimary} onClick={() => setEditing({ status: 'active' })}>＋ Add Category</button>} />
      <div className="bt-grid-3">
        {loading ? <div style={{ ...cardStyle, padding: 18 }}>Loading…</div>
          : cats.length === 0 ? <div style={{ ...cardStyle, padding: 40, color: C.muted }}>No categories yet.</div>
          : cats.map(c => (
            <div key={c.id} style={{ ...cardStyle, padding: 16 }}>
              <div style={{ display: 'flex', gap: 11 }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: C.greenSoft, display: 'grid', placeItems: 'center', fontSize: 24, overflow: 'hidden', flexShrink: 0 }}>
                  {c.image && c.image.startsWith('http') ? <img src={c.image} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (c.image || '🗂️')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 14 }}>{c.name}</b>
                  <div style={{ color: C.muted, fontSize: 12, margin: '3px 0 7px' }}>{c.description}</div>
                  <Pill kind={c.status}>{c.status === 'active' ? 'Active' : 'Inactive'}</Pill>
                  <span style={{ color: C.muted, fontSize: 11, marginLeft: 7 }}>#{c.sortOrder}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 13 }}>
                <button style={{ ...btnGhost, fontSize: 12, padding: '6px 11px' }} onClick={() => setEditing(c)}>✏️ Edit</button>
                <button style={{ ...btnGhost, fontSize: 12, padding: '6px 11px', color: C.red }} onClick={() => setConfirmDel(c)}>🗑️ Delete</button>
              </div>
            </div>
          ))}
      </div>
      {editing && <CategoryModal cat={editing} nextSort={nextSort} onClose={() => setEditing(null)} onSave={save} />}
      {confirmDel && (
        <Modal title="Delete category" onClose={() => setConfirmDel(null)}>
          <p>Delete <b>{confirmDel.name}</b>?</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <button style={btnGhost} onClick={() => setConfirmDel(null)}>Cancel</button>
            <button style={{ ...btnPrimary, background: C.red, borderColor: C.red }} onClick={() => del(confirmDel)}>Delete</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function CategoryModal({ cat, nextSort, onClose, onSave }:
  { cat: Partial<Category>; nextSort: number; onClose: () => void; onSave: (d: Partial<Category>) => void }) {
  const [f, setF] = useState<Partial<Category>>({ name: '', description: '', image: '', status: 'active', sortOrder: cat.id ? cat.sortOrder : nextSort, ...cat });
  const set = (k: keyof Category, v: any) => setF(s => ({ ...s, [k]: v }));
  return (
    <Modal title={cat.id ? 'Edit Category' : 'Add Category'} onClose={onClose}>
      <Field label="Name *"><input style={inputStyle} value={f.name || ''} onChange={e => set('name', e.target.value)} placeholder="e.g. Protein Meals" /></Field>
      <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 70 }} value={f.description || ''} onChange={e => set('description', e.target.value)} /></Field>
      <Field label="Image URL"><input style={inputStyle} value={f.image || ''} onChange={e => set('image', e.target.value)} placeholder="https://…/category-image.jpg" /></Field>
      <Row>
        <Field label="Sort number"><input style={inputStyle} type="number" value={f.sortOrder ?? ''} onChange={e => set('sortOrder', e.target.value === '' ? 0 : Number(e.target.value))} /></Field>
        <Field label="Status"><select style={inputStyle} value={f.status} onChange={e => set('status', e.target.value as Status)}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
      </Row>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={btnPrimary} onClick={() => { if (!f.name) return alert('Name is required'); onSave(f); }}>{cat.id ? 'Save' : 'Create'}</button>
      </div>
    </Modal>
  );
}

/* ============ modal + form helpers ============ */
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(13,59,46,.45)', backdropFilter: 'blur(3px)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '30px 14px', overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 580, boxShadow: '0 24px 60px rgba(13,59,46,.3)' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.muted }}>×</button>
        </div>
        <div style={{ padding: 20, maxHeight: '64vh', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><label style={{ display: 'block', fontWeight: 600, fontSize: 12, marginBottom: 6 }}>{label}</label>{children}</div>;
}
function Row({ children }: { children: React.ReactNode }) { return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>; }
function Row3({ children }: { children: React.ReactNode }) { return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>{children}</div>; }