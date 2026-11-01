'use client';

/**
 * The storefront home's building blocks, shared by mobile and desktop:
 *   TrustStrip    — pure veg · free delivery above ₹X · lowest price here
 *   MenuSections  — category chips + featured sections (Thali, Combos) + full menu
 *   AppTiles      — "You can also order from" (owner's order; tiles without a link are hidden)
 *   SiteFooter
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Category, Product, money } from '../lib/bite';
import {
  PLATFORM_LOOK,
  menuSections,
  useStorefront,
} from '../lib/storefront';
import ProductCard from './ProductCard';

const Icon = {
  leaf: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1F7A3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15" /><path d="M5 19l7-7" />
    </svg>
  ),
  truck: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1F7A3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h11v10H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" />
    </svg>
  ),
  tag: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1F7A3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.5" />
    </svg>
  ),
  check: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1F7A3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" />
    </svg>
  ),
  arrow: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
};

export function TrustStrip() {
  const { freeDeliveryAbove, storefront } = useStorefront();
  return (
    <section className="sf-trust" aria-label="Why order here">
      <div>{Icon.leaf}100% pure veg</div>
      {freeDeliveryAbove > 0 && <div className="wide">{Icon.truck}Free delivery above {money(freeDeliveryAbove)}</div>}
      {storefront.priceCompare && <div>{Icon.tag}Lowest price here</div>}
    </section>
  );
}

export function MenuSections({
  products,
  categories,
  loading,
  error,
  query = '',
}: {
  products: Product[];
  categories: Category[];
  loading: boolean;
  error?: string;
  query?: string;
}) {
  const { storefront } = useStorefront();
  const sections = useMemo(() => menuSections(products, categories, query), [products, categories, query]);
  const [active, setActive] = useState<number | null>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const anyCompare = storefront.priceCompare && products.some((p) => p.zomatoPrice || p.swiggyPrice || p.toingPrice);

  /* highlight the chip of the section on screen */
  useEffect(() => {
    if (!sections.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(Number((vis[0].target as HTMLElement).dataset.cat));
      },
      { rootMargin: '-80px 0px -60% 0px' },
    );
    sections.forEach((s) => {
      const el = document.getElementById(`sf-cat-${s.category.id}`);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [sections]);

  /* keep the active chip in view. Scroll only the chip row: scrollIntoView
     here would also scroll the page and cancel the jump to the section. */
  useEffect(() => {
    const row = chipsRef.current;
    const el = row?.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    if (!row || !el) return;
    row.scrollTo({ left: el.offsetLeft - row.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [active]);

  const go = (id: number) => {
    setActive(id);
    document.getElementById(`sf-cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="sf-sec">
        <div className="sf-grid">
          {[0, 1, 2].map((i) => <div key={i} className="sf-skel" />)}
        </div>
      </div>
    );
  }
  if (error) return <div className="sf-empty">{error}</div>;
  if (!sections.length) {
    return <div className="sf-empty">{query ? `No dishes match “${query}”.` : 'The menu is being updated. Please check back soon.'}</div>;
  }

  const firstMenu = sections.findIndex((s) => !s.featured);
  return (
    <>
      <nav className="sf-chips" aria-label="Menu sections" ref={chipsRef}>
        {sections.map((s) => (
          <button
            key={s.category.id}
            type="button"
            data-chip={s.category.id}
            className={`sf-chip ${active === s.category.id ? 'on' : ''}`}
            aria-current={active === s.category.id ? 'true' : undefined}
            onClick={() => go(s.category.id)}
          >
            {s.category.name}
          </button>
        ))}
      </nav>
      {sections.map((s, i) => (
        <div key={s.category.id}>
          {i === firstMenu && firstMenu > 0 && <h2 className="sf-menu-title">Full menu</h2>}
          <section className="sf-sec" id={`sf-cat-${s.category.id}`} data-cat={s.category.id} aria-labelledby={`sf-h-${s.category.id}`}>
            <div className="sf-sec-h">
              <h2 id={`sf-h-${s.category.id}`}>
                {s.category.name} <em>{s.items.length}</em>
              </h2>
              {i === 0 && anyCompare && <p>Prices compared with what the same dish costs on the apps</p>}
            </div>
            <div className="sf-grid">
              {s.items.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          </section>
        </div>
      ))}
      {anyCompare && (
        <p className="sf-note">App prices are their menu prices before GST. Their delivery, platform and packaging fees are extra.</p>
      )}
    </>
  );
}

export function AppTiles() {
  const { storefront } = useStorefront();
  const tiles = storefront.platforms.filter((t) => t.enabled && t.url);
  if (!tiles.length) return null;
  return (
    <section className="sf-apps" aria-labelledby="sf-apps-h">
      <div>
        <h2 id="sf-apps-h">You can also order from</h2>
        <p>Same kitchen, same food.{storefront.priceCompare ? ' It costs less here.' : ''}</p>
      </div>
      <div className="sf-apps-row">
        {tiles.map((t) => {
          const look = PLATFORM_LOOK[t.key];
          return (
            <a key={t.key} className="sf-app" href={t.url} target="_blank" rel="noopener noreferrer" aria-label={`Order on ${look.name}`}>
              <strong style={{ color: look.color, fontStyle: look.italic ? 'italic' : 'normal' }}>{look.mark}</strong>
              <span>Order on {look.name} {Icon.arrow}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="sf-foot">
      <b>Bites Theory · Cloud kitchen, Indore</b>
      <nav aria-label="Footer">
        <Link href="/help">Help</Link>
        <Link href="/info?tab=terms">Terms</Link>
      </nav>
    </footer>
  );
}

/** "**bold**" in the admin's closed message → real bold, never raw asterisks. */
export function RichLine({ text }: { text: string }) {
  const parts = String(text || '').split('**');
  return <>{parts.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>))}</>;
}
