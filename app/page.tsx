'use client';

// session is per-user, so never statically pre-render this page
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import AppShell from './components/AppShell';
import AppHeader from './components/AppHeader';
import ProductCard from './components/ProductCard';
import CartBar from './components/CartBar';
import ProfileDrawer from './components/ProfileDrawer';
import BiteAgentIntro, { Goal } from './components/BiteAgentIntro';
import TheoryBhaiyaAgent, {
  BHAIYA_LINES,
} from './components/TheoryBhaiyaAgent';
import { useCatalog } from './lib/useCatalog';
import { useCart } from './providers/CartProvider';
import { Product, C } from './lib/bite';

type Sort = 'pop' | 'protein' | 'lowcal' | 'cheap';

export default function HomePage() {
  const { products, categories, loading, error } = useCatalog();
  const { add, cart } = useCart();

  const [activeCat, setActiveCat] = useState<number | 'all'>('all');
  const [sort, setSort] = useState<Sort>('pop');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // intro
  const [showIntro, setShowIntro] = useState(false);
  const [goal, setGoal] = useState<Goal | null>(null);

  // today's special
  const [agentProduct, setAgentProduct] = useState<Product | null>(null);
  const [agentClosed, setAgentClosed] = useState<boolean>(false);
  const [lineIdx] = useState(() =>
    Math.floor(Math.random() * BHAIYA_LINES.length),
  );

  // show intro once per day; read session-close for special
  useEffect(() => {
    try {
      const last = localStorage.getItem('bt_intro_seen');
      if (last !== new Date().toDateString()) setShowIntro(true);
    } catch {
      setShowIntro(true);
    }
    try {
      if (sessionStorage.getItem('bt_special_closed') === '1')
        setAgentClosed(true);
    } catch {}
  }, []);

  // apply goal -> category
  useEffect(() => {
    if (!goal || goal.key === 'surprise' || !categories.length) return;
    const hit = categories.find((c) => goal.match(c));
    if (hit) setActiveCat(hit.id);
  }, [goal, categories]);

  // pop the special after a moment
  useEffect(() => {
    if (loading || !products.length || agentClosed) return;
    const t = setTimeout(() => {
      const withOffer = products
        .filter((p) => p.offerPrice > 0 && p.offerPrice < p.price)
        .sort((a, b) => b.price - b.offerPrice - (a.price - a.offerPrice));
      setAgentProduct(withOffer[0] || products[0]);
    }, 2800);
    return () => clearTimeout(t);
  }, [loading, products, agentClosed]);

  function finishIntro(g: Goal | null) {
    setGoal(g);
    setShowIntro(false);
    try {
      localStorage.setItem('bt_intro_seen', new Date().toDateString());
    } catch {}
    if (g && g.key !== 'surprise') {
      setTimeout(() => {
        document
          .getElementById('catrow')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);
    }
  }

  function closeAgent() {
    setAgentClosed(true);
    try {
      sessionStorage.setItem('bt_special_closed', '1');
    } catch {}
  }

  const visible = useMemo(() => {
    const list =
      activeCat === 'all'
        ? products
        : products.filter((p) => p.categoryId === activeCat);
    const arr = [...list];
    if (sort === 'protein') arr.sort((a, b) => b.protein - a.protein);
    else if (sort === 'lowcal') arr.sort((a, b) => a.calories - b.calories);
    else if (sort === 'cheap')
      arr.sort(
        (a, b) =>
          (a.offerPrice || a.price) - (b.offerPrice || b.price),
      );
    else arr.sort((a, b) => b.rating - a.rating);
    return arr;
  }, [products, activeCat, sort]);

  return (
    <AppShell
      header={
        <AppHeader
          variant="home"
          showSearch
          onMenu={() => setDrawerOpen(true)}
          onAskBhaiya={() => setShowIntro(true)}
        />
      }
      footerExtra={<CartBar />}
      overlay={
        <>
          <ProfileDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
          />
          {agentProduct && !agentClosed && (
            <TheoryBhaiyaAgent
              product={agentProduct}
              line={BHAIYA_LINES[lineIdx]}
              inCart={(cart[agentProduct.id] || 0) > 0}
              hasCart={Object.keys(cart).length > 0}
              onOrder={() => {
                add(agentProduct.id);
                closeAgent();
              }}
              onClose={closeAgent}
            />
          )}
          {showIntro && <BiteAgentIntro onDone={finishIntro} />}
        </>
      }
    >
      {/* hero */}
      <section className="bt-hero">
        <span className="bt-veg-badge">100% PURE VEG</span>
        <h1 className="bt-hero-title">
          Smart Food.
          <br />
          Better Living.
        </h1>
        <p className="bt-hero-sub">Good food. Right price. Under ₹99 combos.</p>
      </section>

      {/* categories */}
      <section className="bt-cats" id="catrow">
        <div className="bt-cat-scroll">
          <button
            className={`bt-cat ${activeCat === 'all' ? 'on' : ''}`}
            onClick={() => setActiveCat('all')}
          >
            <span className="bt-cat-ic" style={{ background: C.orangeSoft }}>
              🍽️
            </span>
            <span className="bt-cat-lbl">All</span>
          </button>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bt-cat">
                  <span className="bt-cat-ic skel" />
                  <span className="bt-cat-lbl skel-txt" />
                </div>
              ))
            : categories.map((c, i) => (
                <button
                  key={c.id}
                  className={`bt-cat ${activeCat === c.id ? 'on' : ''}`}
                  onClick={() => setActiveCat(c.id)}
                >
                  <span
                    className="bt-cat-ic"
                    style={{ background: i % 2 ? C.greenSoft : C.orangeSoft }}
                  >
                    {c.image ? (
                      <img src={c.image} alt={c.name} />
                    ) : (
                      c.emoji
                    )}
                  </span>
                  <span className="bt-cat-lbl">{c.name}</span>
                </button>
              ))}
        </div>
      </section>

      {/* offers */}
      <section className="bt-offers">
        <div className="bt-offer dark">
          <span className="bt-offer-ic" style={{ background: C.orange }}>
            %
          </span>
          <div>
            <div className="bt-offer-t">70% OFF up to ₹100</div>
            <div className="bt-offer-s">USE BITE70</div>
          </div>
        </div>
        <div className="bt-offer soft">
          <span className="bt-offer-ic" style={{ background: C.green }}>
            🍛
          </span>
          <div>
            <div className="bt-offer-t" style={{ color: '#854f0b' }}>
              Thali at ₹99
            </div>
            <div className="bt-offer-s" style={{ color: '#ba7517' }}>
              TODAY ONLY
            </div>
          </div>
        </div>
      </section>

      {/* filters */}
      <section className="bt-filters">
        {(
          [
            ['pop', 'Sort by'],
            ['protein', 'High Protein'],
            ['lowcal', 'Under 400 cal'],
            ['cheap', 'Cheapest'],
          ] as [Sort, string][]
        ).map(([k, lbl]) => (
          <button
            key={k}
            className={`bt-chip ${sort === k ? 'on' : ''}`}
            onClick={() => setSort(k)}
          >
            {lbl}
          </button>
        ))}
      </section>

      {/* products */}
      <section className="bt-products">
        <h2 className="bt-sec-title">
          {activeCat === 'all'
            ? 'Popular near you'
            : categories.find((c) => c.id === activeCat)?.name || 'Menu'}
        </h2>

        {error && <div className="bt-empty">{error}</div>}

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bt-card">
              <div className="bt-card-img skel" />
              <div className="bt-card-body">
                <div className="skel-txt" style={{ width: '60%' }} />
                <div className="skel-txt" style={{ width: '90%' }} />
                <div className="skel-txt" style={{ width: '40%' }} />
              </div>
            </div>
          ))
        ) : visible.length === 0 ? (
          <div className="bt-empty">
            Is category mein abhi kuch nahi hai. Doosri dekho!
          </div>
        ) : (
          visible.map((p) => <ProductCard key={p.id} p={p} />)
        )}
      </section>

      <div style={{ height: 16 }} />
    </AppShell>
  );
}
