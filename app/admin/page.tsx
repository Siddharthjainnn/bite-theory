'use client';

/**
 * Bite Theory — Admin Console
 * Location in your project:  app/admin/page.tsx
 * Visit:  http://localhost:3000/admin
 *
 * Set NEXT_PUBLIC_API_BASE in .env.local:
 *   NEXT_PUBLIC_API_BASE=http://localhost:3001
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

type Page = 'dashboard' | 'orders' | 'products' | 'categories' | 'inventory' | 'customers';

// const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://bite-theory-backend.onrender.com';
const money = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

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
      body: JSON.stringify({
        name: d.name, description: d.description, image: d.image,
        sortOrder: d.sortOrder, isActive: d.status === 'active',
      }),
    });
    if (!r.ok) throw new Error('Create failed');
    return r.json();
  },
  async updateCategory(id: number, d: Partial<Category>) {
    const r = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: d.name, description: d.description, image: d.image,
        sortOrder: d.sortOrder, isActive: d.status === 'active',
      }),
    });
    if (!r.ok) throw new Error('Update failed');
    return r.json();
  },
  async deleteCategory(id: number) {
    const r = await fetch(`${API_BASE}/categories/${id}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Delete failed');
  },
};

/* ============ tokens & small UI ============ */
const C = {
  green: '#4CAF50', darkGreen: '#0D3B2E', orange: '#F59E0B',
  bg: '#F4F6F3', card: '#fff', ink: '#0D3B2E', muted: '#6b7d74',
  line: '#e4ebe6', greenSoft: '#e8f5e9', orangeSoft: '#fef3e2',
};

function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, background: C.darkGreen, color: '#fff',
      padding: '13px 18px', borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,.25)',
      zIndex: 200, fontWeight: 500,
    }}>✓ &nbsp;{msg}</div>
  );
}
function Pill({ kind, children }: { kind: 'active' | 'inactive' | 'low' | 'out'; children: React.ReactNode }) {
  const map: Record<string, [string, string]> = {
    active: [C.greenSoft, '#2e7d32'], inactive: ['#f0f0f0', '#888'],
    low: [C.orangeSoft, '#b76e00'], out: ['#fdecec', '#d64545'],
  };
  const [bg, col] = map[kind];
  return <span style={{ background: bg, color: col, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{children}</span>;
}

/* ============ main ============ */
export default function AdminPage() {
  const [page, setPage] = useState<Page>('dashboard');
  const [toast, setToast] = useState('');
  const showToast = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); }, []);

  const nav = [
    { key: 'dashboard', label: 'Dashboard', icon: '▦' },
    { key: 'orders', label: 'Orders', icon: '🧾' },
    { key: 'products', label: 'Products', icon: '🍱' },
    { key: 'categories', label: 'Categories', icon: '🗂️' },
    { key: 'inventory', label: 'Inventory', icon: '📦' },
    { key: 'customers', label: 'Customers', icon: '👥' },
  ] as const;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, color: C.ink,
      fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif', fontSize: 14 }}>
      <aside style={{
        width: 248, background: C.darkGreen, color: '#cfe3d8', padding: '20px 14px',
        position: 'fixed', height: '100vh', overflowY: 'auto', zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px 18px',
          borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg,${C.green},${C.orange})`,
            display: 'grid', placeItems: 'center', fontWeight: 800, color: '#fff', fontSize: 18 }}>B</div>
          <div><b style={{ color: '#fff', fontSize: 16 }}>Bite Theory</b>
            <span style={{ display: 'block', fontSize: 10, color: '#8fb3a3', letterSpacing: 1 }}>ADMIN CONSOLE</span></div>
        </div>
        {nav.map(n => (
          <div key={n.key} onClick={() => setPage(n.key as Page)} style={{
            display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 10,
            cursor: 'pointer', marginBottom: 2, fontWeight: 500,
            background: page === n.key ? C.green : 'transparent',
            color: page === n.key ? '#fff' : '#cfe3d8',
          }}><span style={{ width: 18, textAlign: 'center' }}>{n.icon}</span>{n.label}</div>
        ))}
      </aside>

      <div style={{ flex: 1, marginLeft: 248, minWidth: 0 }}>
        <header style={{ background: C.card, borderBottom: `1px solid ${C.line}`, padding: '0 24px',
          height: 62, display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 40 }}>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg,${C.green},${C.darkGreen})`,
              color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }}>A</div>
            <div><b style={{ fontSize: 13 }}>Admin</b>
              <div style={{ color: C.muted, fontSize: 11 }}>Super Admin</div></div>
          </div>
        </header>

        <div style={{ padding: 24, maxWidth: 1280 }}>
          {page === 'dashboard' && <Dashboard />}
          {page === 'products' && <Products showToast={showToast} />}
          {page === 'categories' && <Categories showToast={showToast} />}
          {page === 'inventory' && <Inventory />}
          {page === 'orders' && <Orders />}
          {page === 'customers' && <Customers />}
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
const th: React.CSSProperties = { textAlign: 'left', padding: '12px 16px', color: C.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: `1px solid ${C.line}` };
const td: React.CSSProperties = { padding: '13px 16px', borderBottom: `1px solid ${C.line}` };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 13, background: C.bg, color: C.ink, fontFamily: 'inherit' };

function PageHead({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
      <div><h1 style={{ fontSize: 22, margin: 0 }}>{title}</h1>
        <p style={{ color: C.muted, marginTop: 3 }}>{sub}</p></div>
      {action}
    </div>
  );
}

/* ============ DASHBOARD ============ */
function Dashboard() {
  const stats = [
    ['Today\'s Orders', '142'], ['Revenue', '₹48,260'],
    ['Active Users', '1,284'], ['Pending Deliveries', '12'],
  ];
  return (
    <>
      <PageHead title="Dashboard" sub="Welcome back — here's today at Bite Theory." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {stats.map(([lbl, val]) => (
          <div key={lbl} style={{ ...cardStyle, padding: 18 }}>
            <div style={{ color: C.muted, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>{lbl}</div>
            <div style={{ fontSize: 28, fontWeight: 800, margin: '8px 0 4px' }}>{val}</div>
            <div style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>▲ live</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ============ PRODUCTS ============ */
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
      <div style={cardStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>
              <th style={th}>Product</th><th style={th}>Category</th><th style={th}>Nutrition</th>
              <th style={th}>Price</th><th style={th}>Status</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td style={td} colSpan={6}>Loading…</td></tr>
              ) : products.length === 0 ? (
                <tr><td style={{ ...td, textAlign: 'center', padding: 50, color: C.muted }} colSpan={6}>
                  No products yet. Click “Add Product” to create your first one.</td></tr>
              ) : products.map(p => {
                const off = p.offerPrice > 0;
                return (
                  <tr key={p.id}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 10, background: C.greenSoft, display: 'grid', placeItems: 'center', fontSize: 18, overflow: 'hidden' }}>
                          {p.image && p.image.startsWith('http') ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.image || '🍱')}
                        </div>
                        <div><b>{p.name}</b><div style={{ color: C.muted, fontSize: 12 }}>{p.description.slice(0, 38)}</div></div>
                      </div>
                    </td>
                    <td style={td}>{catName(p.categoryId)}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[`${p.calories}cal`, `${p.protein}g P`, `${p.carbs}g C`, `${p.fat}g F`].map(x => (
                          <span key={x} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: C.bg, color: C.muted, fontWeight: 600 }}>{x}</span>
                        ))}
                      </div>
                    </td>
                    <td style={td}><b>{money(off ? p.offerPrice : p.price)}</b>{off && <s style={{ color: C.muted, marginLeft: 5, fontSize: 12 }}>{money(p.price)}</s>}</td>
                    <td style={td}><Pill kind={p.status}>{p.status === 'active' ? 'Active' : 'Inactive'}</Pill></td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setEditing(p)} style={{ ...btnGhost, padding: '6px 10px' }}>✏️</button>
                        <button onClick={() => setConfirmDel(p)} style={{ ...btnGhost, padding: '6px 10px', color: '#d64545' }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <ProductModal product={editing} cats={cats} onClose={() => setEditing(null)} onSave={save} />}
      {confirmDel && (
        <Modal title="Delete product" onClose={() => setConfirmDel(null)}>
          <p>Delete <b>{confirmDel.name}</b>? This can’t be undone.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <button style={btnGhost} onClick={() => setConfirmDel(null)}>Cancel</button>
            <button style={{ ...btnPrimary, background: '#d64545', borderColor: '#d64545' }} onClick={() => del(confirmDel)}>Delete</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function ProductModal({ product, cats, onClose, onSave }:
  { product: Partial<Product>; cats: Category[]; onClose: () => void; onSave: (d: Partial<Product>) => void }) {
  const [f, setF] = useState<Partial<Product>>({
    name: '', description: '', image: '', videoUrl: '', price: 0, offerPrice: 0,
    calories: 0, protein: 0, carbs: 0, fat: 0, status: 'active',
    categoryId: cats[0]?.id, ...product,
  });
  const set = (k: keyof Product, v: any) => setF(s => ({ ...s, [k]: v }));
  const num = (k: keyof Product, v: string) => set(k, v === '' ? 0 : Number(v));

  return (
    <Modal title={product.id ? 'Edit Product' : 'Add Product'} onClose={onClose}>
      <Field label="Product name *">
        <input style={inputStyle} value={f.name || ''} onChange={e => set('name', e.target.value)} placeholder="e.g. Grilled Chicken Bowl" />
      </Field>
      <Row>
        <Field label="Category *">
          <select style={inputStyle} value={f.categoryId} onChange={e => set('categoryId', Number(e.target.value))}>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select style={inputStyle} value={f.status} onChange={e => set('status', e.target.value as Status)}>
            <option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </Field>
      </Row>
      <Field label="Description">
        <textarea style={{ ...inputStyle, minHeight: 70 }} value={f.description || ''} onChange={e => set('description', e.target.value)} />
      </Field>
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
      <Field label="Video URL">
        <input style={inputStyle} value={f.videoUrl || ''} onChange={e => set('videoUrl', e.target.value)} placeholder="https://…/preview.mp4" />
      </Field>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={btnPrimary} onClick={() => {
          if (!f.name || !f.price) return alert('Name and price are required');
          onSave(f);
        }}>{product.id ? 'Save changes' : 'Create product'}</button>
      </div>
    </Modal>
  );
}

/* ============ CATEGORIES ============ */
function Categories({ showToast }: { showToast: (m: string) => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [confirmDel, setConfirmDel] = useState<Category | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCats(await api.listCategories()); }
    catch (e: any) { showToast(e.message || 'Load failed'); }
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
      <PageHead title="Categories" sub="Organize your menu into sections."
        action={<button style={btnPrimary} onClick={() => setEditing({ status: 'active' })}>＋ Add Category</button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {loading ? <div style={{ ...cardStyle, padding: 18 }}>Loading…</div>
          : cats.length === 0 ? <div style={{ ...cardStyle, padding: 40, color: C.muted }}>No categories yet.</div>
          : cats.map(c => (
            <div key={c.id} style={{ ...cardStyle, padding: 18 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 52, height: 52, borderRadius: 10, background: C.greenSoft, display: 'grid', placeItems: 'center', fontSize: 26, overflow: 'hidden' }}>
                  {c.image && c.image.startsWith('http')
                    ? <img src={c.image} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (c.image || '🗂️')}
                </div>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 15 }}>{c.name}</b>
                  <div style={{ color: C.muted, fontSize: 12, margin: '3px 0 8px' }}>{c.description}</div>
                  <Pill kind={c.status}>{c.status === 'active' ? 'Active' : 'Inactive'}</Pill>
                  <span style={{ color: C.muted, fontSize: 11, marginLeft: 8 }}>#{c.sortOrder}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                <button style={{ ...btnGhost, fontSize: 12, padding: '6px 11px' }} onClick={() => setEditing(c)}>✏️ Edit</button>
                <button style={{ ...btnGhost, fontSize: 12, padding: '6px 11px', color: '#d64545' }} onClick={() => setConfirmDel(c)}>🗑️ Delete</button>
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
            <button style={{ ...btnPrimary, background: '#d64545', borderColor: '#d64545' }} onClick={() => del(confirmDel)}>Delete</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function CategoryModal({ cat, nextSort, onClose, onSave }:
  { cat: Partial<Category>; nextSort: number; onClose: () => void; onSave: (d: Partial<Category>) => void }) {
  const [f, setF] = useState<Partial<Category>>({
    name: '', description: '', image: '', status: 'active',
    sortOrder: cat.id ? cat.sortOrder : nextSort,
    ...cat,
  });
  const set = (k: keyof Category, v: any) => setF(s => ({ ...s, [k]: v }));
  return (
    <Modal title={cat.id ? 'Edit Category' : 'Add Category'} onClose={onClose}>
      <Field label="Name *">
        <input style={inputStyle} value={f.name || ''} onChange={e => set('name', e.target.value)} placeholder="e.g. Protein Meals" />
      </Field>
      <Field label="Description">
        <textarea style={{ ...inputStyle, minHeight: 70 }} value={f.description || ''} onChange={e => set('description', e.target.value)} placeholder="Short description of this category" />
      </Field>
      <Field label="Image URL">
        <input style={inputStyle} value={f.image || ''} onChange={e => set('image', e.target.value)} placeholder="https://…/category-image.jpg" />
      </Field>
      <Row>
        <Field label="Sort number">
          <input style={inputStyle} type="number" value={f.sortOrder ?? ''} onChange={e => set('sortOrder', e.target.value === '' ? 0 : Number(e.target.value))} />
        </Field>
        <Field label="Status">
          <select style={inputStyle} value={f.status} onChange={e => set('status', e.target.value as Status)}>
            <option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </Field>
      </Row>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={btnPrimary} onClick={() => { if (!f.name) return alert('Name is required'); onSave(f); }}>
          {cat.id ? 'Save' : 'Create'}</button>
      </div>
    </Modal>
  );
}

/* ============ INVENTORY ============ */
function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => { api.listProducts().then(setProducts).catch(() => {}); }, []);
  return (
    <>
      <PageHead title="Inventory" sub="Stock status per product." />
      <div style={cardStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr><th style={th}>Product</th><th style={th}>Price</th><th style={th}>Status</th></tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td style={td}><b>{p.name}</b></td>
                  <td style={td}>{money(p.offerPrice > 0 ? p.offerPrice : p.price)}</td>
                  <td style={td}><Pill kind={p.status}>{p.status === 'active' ? 'Available' : 'Hidden'}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ============ ORDERS / CUSTOMERS placeholders ============ */
function Orders() {
  return (
    <>
      <PageHead title="Orders" sub="Live orders and status timeline." />
      <div style={{ ...cardStyle, padding: 40, color: C.muted, textAlign: 'center' }}>
        Orders endpoint not wired yet. Once your <code>/orders</code> API is live, this lists every order with the full status timeline.
      </div>
    </>
  );
}
function Customers() {
  return (
    <>
      <PageHead title="Customers" sub="Your community." />
      <div style={{ ...cardStyle, padding: 40, color: C.muted, textAlign: 'center' }}>
        Customers endpoint not wired yet. Once <code>/users</code> is live, this lists customers, spend, and loyalty tier.
      </div>
    </>
  );
}

/* ============ modal + form helpers ============ */
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'fixed', inset: 0, background: 'rgba(13,59,46,.45)', backdropFilter: 'blur(3px)',
      zIndex: 90, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto',
    }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 600, boxShadow: '0 24px 60px rgba(13,59,46,.3)' }}>
        <div style={{ padding: '20px 22px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 17, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.muted }}>×</button>
        </div>
        <div style={{ padding: 22, maxHeight: '64vh', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 15 }}>
    <label style={{ display: 'block', fontWeight: 600, fontSize: 12, marginBottom: 6 }}>{label}</label>{children}</div>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>{children}</div>;
}
function Row3({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>{children}</div>;
}