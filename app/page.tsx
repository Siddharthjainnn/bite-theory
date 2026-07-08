'use client';

// session is per-user, so never statically pre-render this page
export const dynamic = 'force-dynamic';

import Link from 'next/link';
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
import { Product, C, money, effectivePrice, hasOffer, Banner, fetchBanners } from './lib/bite';
import { useStoreSettings } from './lib/useStoreSettings';
import StoreClosedBanner from './components/StoreClosedBanner';

type Sort = 'pop' | 'protein' | 'lowcal' | 'cheap';

export default function HomePage() {
  const { products, categories, loading, error } = useCatalog();
  const { status: storeStatus } = useStoreSettings();
  const { add, cart } = useCart();

  const [activeCat, setActiveCat] = useState<number | 'all'>('all');
  const [sort, setSort] = useState<Sort>('pop');
  const [vegOnly, setVegOnly] = useState(true); // pure-veg app: veg stays ON by default
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannerIdx, setBannerIdx] = useState(0);
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

  // banners: load once, auto-advance
  useEffect(() => { fetchBanners().then(setBanners); }, []);
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => {
      setBannerIdx((i) => {
        const next = (i + 1) % banners.length;
        document.getElementById('btbanners')?.scrollTo({
          left: next * (document.getElementById('btbanners')?.clientWidth || 0) * 0.9,
          behavior: 'smooth',
        });
        return next;
      });
    }, 4500);
    return () => clearInterval(t);
  }, [banners.length]);

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
      const flagged = products.filter((p) => p.isTodaysSpecial);
      const withOffer = products
        .filter((p) => p.offerPrice > 0 && p.offerPrice < p.price)
        .sort((a, b) => b.price - b.offerPrice - (a.price - a.offerPrice));
      setAgentProduct(flagged[0] || withOffer[0] || products[0]);
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
    let list =
      activeCat === 'all'
        ? products
        : products.filter((p) => p.categoryId === activeCat);
    if (vegOnly) list = list.filter((p) => p.isVeg);
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
  }, [products, activeCat, sort, vegOnly]);

  const specials = useMemo(
    () => products.filter((p) => p.isTodaysSpecial && (!vegOnly || p.isVeg)),
    [products, vegOnly],
  );

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

      {!storeStatus.open && (
        <section style={{ padding: '0 16px' }}>
          <StoreClosedBanner status={storeStatus} />
        </section>
      )}

      {/* banners (admin-managed) */}
      {banners.length > 0 && (
        <section className="bt-banners">
          <div className="bt-banner-track" id="btbanners">
            {banners.map((b) => (
              <a
                key={b.id}
                className="bt-banner"
                href={b.linkUrl || '#'}
                onClick={(e) => { if (!b.linkUrl) e.preventDefault(); }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {b.imageUrl && <img src={b.imageUrl} alt={b.title} />}
                {b.title && <span className="bt-banner-title">{b.title}</span>}
              </a>
            ))}
          </div>
          {banners.length > 1 && (
            <div className="bt-banner-dots">
              {banners.map((_, i) => <i key={i} className={i === bannerIdx ? 'on' : ''} />)}
            </div>
          )}
        </section>
      )}

      {/* TODAY'S SPECIAL — admin toggles products on/off dynamically */}
      {specials.length > 0 && (
        <>
          <div className="bt-special-head">
            <span className="zap">⚡</span> Today&apos;s Special
            <span style={{ fontSize: 10.5, fontWeight: 800, color: C.orangeDeep, background: C.orangeSoft, padding: '3px 8px', borderRadius: 999, marginLeft: 2 }}>
              LIMITED TIME
            </span>
          </div>
          <div className="bt-special-row">
            {specials.map((p) => (
              <div key={p.id} className="bt-sp-card">
                <Link href={`/product/${p.id}`} className="bt-sp-img" style={{ display: 'block' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.image
                    ? <img src={p.image} alt={p.name} />
                    : <div className="food-emoji">🍛</div>}
                  <span className="bt-sp-tag">{p.specialTag || "TODAY'S SPECIAL"}</span>
                </Link>
                <div className="bt-sp-body">
                  <div className="bt-sp-name">{p.name}</div>
                  <div className="bt-sp-price">
                    <b>{money(effectivePrice(p))}</b>
                    {hasOffer(p) && <s>{money(p.price)}</s>}
                  </div>
                  <button className="bt-sp-add" onClick={() => add(p.id)}>
                    {(cart[p.id] || 0) > 0 ? `ADDED · ${cart[p.id]}` : 'ADD +'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

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
        <button
          className={`bt-vegtoggle ${vegOnly ? 'on' : ''}`}
          onClick={() => setVegOnly((v) => !v)}
          aria-pressed={vegOnly}
        >
          <span className="lbl">VEG</span>
          <span className="sw"><i /></span>
        </button>
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
