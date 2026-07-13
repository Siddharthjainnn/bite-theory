'use client';

/**
 * Cuisines & dishes — the full photo grid behind "See all" on the home
 * category strip (Swiggy pattern, adapted to the Bite Theory green/gold brand).
 *
 * - 4-column responsive grid of category tiles with real food photos.
 * - Graceful emoji fallback (via FoodImage) for categories without a photo yet,
 *   so this ships today and auto-upgrades the moment images are uploaded.
 * - Tapping a tile deep-links into the menu, pre-scrolled to that category.
 * - Live search filters the grid by category name.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../components/AppShell';
import AppHeader from '../components/AppHeader';
import CartBar from '../components/CartBar';
import FoodImage from '../components/FoodImage';
import { useCatalog } from '../lib/useCatalog';
import { Category, catEmoji } from '../lib/bite';

export default function CuisinesPage() {
  const { categories, products, loading } = useCatalog();
  const router = useRouter();
  const [q, setQ] = useState('');

  // count of items per category, so tiles can show "12 dishes"
  const counts = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of products) m.set(p.categoryId, (m.get(p.categoryId) || 0) + 1);
    return m;
  }, [products]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? categories.filter((c) => c.name.toLowerCase().includes(needle))
      : categories;
    return list;
  }, [categories, q]);

  function open(c: Category) {
    router.push(`/menu?cat=${c.id}`);
  }

  return (
    <AppShell
      header={<AppHeader variant="page" title="Cuisines & dishes" />}
      footerExtra={<CartBar />}
    >
      <div className="cz-wrap">
        {/* search */}
        <div className="cz-search">
          <span aria-hidden>🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search cuisines"
            aria-label="Search cuisines"
          />
          {q && (
            <button className="cz-clear" onClick={() => setQ('')} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>

        {loading ? (
          <div className="cz-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <div className="cz-tile" key={i}>
                <div className="cz-photo skel" />
                <div className="skel-txt" style={{ width: '70%', margin: '8px auto 0' }} />
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="bt-empty" style={{ marginTop: 20 }}>
            No cuisines match “{q}”.
          </div>
        ) : (
          <div className="cz-grid">
            {shown.map((c, i) => {
              const n = counts.get(c.id) || 0;
              return (
                <button
                  key={c.id}
                  className="cz-tile"
                  onClick={() => open(c)}
                  style={{ animationDelay: `${Math.min(i, 12) * 0.03}s` }}
                >
                  <span className="cz-photo">
                    <FoodImage
                      src={c.image}
                      alt={c.name}
                      emoji={c.emoji || catEmoji(c.name)}
                    />
                    <span className="veg-dot sm" aria-label="Pure veg"><i /></span>
                  </span>
                  <span className="cz-name">{c.name}</span>
                  {n > 0 && <span className="cz-count">{n} {n === 1 ? 'dish' : 'dishes'}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
