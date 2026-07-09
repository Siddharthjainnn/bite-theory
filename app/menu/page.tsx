'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '../components/AppShell';
import AppHeader from '../components/AppHeader';
import ProductCard from '../components/ProductCard';
import CartBar from '../components/CartBar';
import { useCatalog } from '../lib/useCatalog';
import { Category, Product } from '../lib/bite';

function MenuInner() {
  const { products, categories, loading, error } = useCatalog();
  const params = useSearchParams();
  const initialQ = params.get('q') || '';

  const [active, setActive] = useState<number | null>(null);
  const [q, setQ] = useState(initialQ);
  const [vegOnly] = useState(true); // pure-veg app: veg stays on

  // search filter (name + description), veg-only
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter((p) => {
      if (vegOnly && !p.isVeg) return false;
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) ||
        (p.description || '').toLowerCase().includes(term)
      );
    });
  }, [products, q, vegOnly]);

  const byCat = useMemo(() => {
    const map = new Map<number, Product[]>();
    for (const c of categories) map.set(c.id, []);
    for (const p of filtered) {
      if (!map.has(p.categoryId)) map.set(p.categoryId, []);
      map.get(p.categoryId)!.push(p);
    }
    return map;
  }, [filtered, categories]);

  function jump(c: Category) {
    setActive(c.id);
    document.getElementById('cat-' + c.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const totalShown = filtered.length;

  return (
    <AppShell
      header={
        // Bugs #3 & #10: removed `showSearch` so the header no longer renders a
        // second search bar — the in-page live search below is the only one.
        // Also dropped the page-local ProfileDrawer + onMenu: the shared drawer
        // mounted by MenuProvider (app/layout.tsx) handles the hamburger, so we
        // no longer mount a duplicate drawer here.
        <AppHeader variant="home" />
      }
      footerExtra={<CartBar />}
    >
      {/* live in-page search — the single source of truth for search on /menu */}
      <div style={{ padding: '10px 12px 2px' }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, background: '#fff',
            border: '1.5px solid #e4ebe6', borderRadius: 12, padding: '0 10px',
          }}
        >
          <span style={{ fontSize: 15 }}>🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the full menu…"
            style={{ flex: 1, border: 'none', outline: 'none', padding: '11px 2px', fontSize: 14, color: '#0D3B2E', background: 'none' }}
          />
          {q && (
            <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', color: '#9fb0a8', cursor: 'pointer' }}>✕</button>
          )}
        </div>
        {q && (
          <div style={{ fontSize: 12, color: '#6b7d74', margin: '8px 2px 0' }}>
            {totalShown} result{totalShown === 1 ? '' : 's'} for “{q}”
          </div>
        )}
      </div>

      {!loading && categories.length > 0 && !q && (
        <div className="menu-jump">
          {categories.map((c) => (
            <button
              key={c.id}
              className={`menu-jump-chip ${active === c.id ? 'on' : ''}`}
              onClick={() => jump(c)}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: '0 12px 12px' }}>
        {error && <div className="bt-empty">{error}</div>}

        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bt-card">
              <div className="bt-card-img skel" />
              <div className="bt-card-body">
                <div className="skel-txt" style={{ width: '60%' }} />
                <div className="skel-txt" style={{ width: '90%' }} />
                <div className="skel-txt" style={{ width: '40%' }} />
              </div>
            </div>
          ))
        ) : totalShown === 0 ? (
          <div className="bt-empty">
            {q ? `Kuch nahi mila for “${q}”. Doosra try karo!` : 'Menu abhi khaali hai.'}
          </div>
        ) : (
          categories.map((c) => {
            const items = byCat.get(c.id) || [];
            if (items.length === 0) return null;
            return (
              <section key={c.id}>
                <h2 id={'cat-' + c.id} className="menu-cat-h">
                  <span>{c.emoji}</span> {c.name} <span className="cnt">({items.length})</span>
                </h2>
                {items.map((p) => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </section>
            );
          })
        )}
      </div>
    </AppShell>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={null}>
      <MenuInner />
    </Suspense>
  );
}
