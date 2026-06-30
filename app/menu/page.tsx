'use client';

import { useMemo, useState } from 'react';
import AppShell from '../components/AppShell';
import AppHeader from '../components/AppHeader';
import ProductCard from '../components/ProductCard';
import CartBar from '../components/CartBar';
import { useCatalog } from '../lib/useCatalog';
import { Category, Product } from '../lib/bite';

export default function MenuPage() {
  const { products, categories, loading, error } = useCatalog();
  const [active, setActive] = useState<number | null>(null);

  const byCat = useMemo(() => {
    const map = new Map<number, Product[]>();
    for (const c of categories) map.set(c.id, []);
    for (const p of products) {
      if (!map.has(p.categoryId)) map.set(p.categoryId, []);
      map.get(p.categoryId)!.push(p);
    }
    return map;
  }, [products, categories]);

  function jump(c: Category) {
    setActive(c.id);
    const el = document.getElementById('cat-' + c.id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <AppShell
      header={<AppHeader variant="page" title="Full Menu" />}
      footerExtra={<CartBar />}
    >
      {/* sticky jump-to-category chips */}
      {!loading && categories.length > 0 && (
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
        ) : (
          categories.map((c) => {
            const items = byCat.get(c.id) || [];
            if (items.length === 0) return null;
            return (
              <section key={c.id}>
                <h2 id={'cat-' + c.id} className="menu-cat-h">
                  <span>{c.emoji}</span> {c.name}{' '}
                  <span className="cnt">({items.length})</span>
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
