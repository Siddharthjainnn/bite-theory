'use client';
import { useRouter } from 'next/navigation';

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
import SpinTheThali from './components/SpinTheThali';
import MacroBucketBuilder from './components/MacroBucketBuilder';
import IndianFoodChooser from './components/IndianFoodChooser';
import ThaliBuilder, { ThaliConfig } from './components/ThaliBuilder';
import FlashDealBar from './components/FlashDealBar';
import { useCatalog } from './lib/useCatalog';
import { useCart } from './providers/CartProvider';
import { Product, C, money, effectivePrice, hasOffer, Banner, fetchBanners, fetchStoreSettings } from './lib/bite';
import { useStoreSettings } from './lib/useStoreSettings';
import { useFeaturedCoupon } from './lib/useFeaturedCoupon';
import StoreClosedBanner from './components/StoreClosedBanner';
import DesktopLanding from './components/DesktopLanding';
import DesktopApp from './components/DesktopApp';
import RecommendedRow from './components/RecommendedRow';
import TodaysSpecialModal from './components/TodaysSpecialModal';
import PromoBannerDeck from './components/PromoBannerDeck';
import LiveOrderCard from './components/LiveOrderCard';
import OfferStrip from './components/OfferStrip';
import { useDesktopLanding } from './lib/useDesktopLanding';

type Sort = 'pop' | 'protein' | 'lowcal' | 'cheap';

export default function HomePage() {
  const router = useRouter();
  const { products, categories, loading, error } = useCatalog();
  const { status: storeStatus } = useStoreSettings();
  const { add, addThali, cart, sub } = useCart();
  const featuredCoupon = useFeaturedCoupon();

  // Desktop-only marketing landing gate. On mobile this is always false, so
  // the app renders exactly as before. On desktop, show the landing until the
  // visitor clicks "Order Now". Admin/rider routes never mount this component.
  const { showLanding, enterApp, isDesktop } = useDesktopLanding();

  const [activeCat, setActiveCat] = useState<number | 'all'>('all');
  const [sort, setSort] = useState<Sort>('pop');
  // Swiggy-style quick filters (multi-select, layered on top of sort)
  const [quick, setQuick] = useState<Set<string>>(new Set());
  const toggleQuick = (k: string) =>
    setQuick((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  const [vegOnly, setVegOnly] = useState(true); // pure-veg app: veg stays ON by default
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [specialOpen, setSpecialOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // intro
  const [showIntro, setShowIntro] = useState(false);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [showSpin, setShowSpin] = useState(false);
  const [showBucket, setShowBucket] = useState(false);
  const [showIndian, setShowIndian] = useState(false);
  const [showThali, setShowThali] = useState(false);

  // today's special
  const [agentProduct, setAgentProduct] = useState<Product | null>(null);
  const [agentClosed, setAgentClosed] = useState<boolean>(false);
  const [lineIdx] = useState(() =>
    Math.floor(Math.random() * BHAIYA_LINES.length),
  );

  /* The Ask Bhaiya intro is now ADMIN-CONTROLLED (Store Settings).
     It used to hard-pop once a day for everyone with no way to switch it off
     short of a deploy. Now:
       enabled=false → never auto-shows (the header button still opens it)
       frequency: 'once'   → first visit only, ever
                  'daily'  → once per day (previous behaviour, still default)
                  'always' → every visit
     Fetch fails → we DON'T show it. A silent home page beats a popup nobody
     can explain if settings are unreachable. */
  useEffect(() => {
    let alive = true;
    fetchStoreSettings()
      .then((st) => {
        if (!alive) return;
        if (st?.bhaiyaIntroEnabled === false) return;      // admin turned it off
        const freq = st?.bhaiyaIntroFrequency || 'daily';
        try {
          const seen = localStorage.getItem('bt_intro_seen');
          if (freq === 'always') { setShowIntro(true); return; }
          if (freq === 'once') { if (!seen) setShowIntro(true); return; }
          if (seen !== new Date().toDateString()) setShowIntro(true);   // daily
        } catch {
          setShowIntro(true);   // storage blocked — showing once is the kinder failure
        }
      })
      .catch(() => { /* settings unreachable → stay quiet */ });
    return () => { alive = false; };
  }, []);

  // read session-close for special
  useEffect(() => {
    try {
      if (sessionStorage.getItem('bt_special_closed') === '1')
        setAgentClosed(true);
    } catch {}
  }, []);

  // bottom-nav "Special" tab opens the Today's Special popup
  useEffect(() => {
    const openIt = () => setSpecialOpen(true);
    window.addEventListener('bt:open-special', openIt);
    return () => window.removeEventListener('bt:open-special', openIt);
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

  // Today's Special is now opened ON DEMAND from the bottom-nav "Special"
  // button (see TodaysSpecialModal) — no auto-pop, which was cluttering the
  // home screen and reading as intrusive. The agent stays available but is
  // not force-shown.
  useEffect(() => {
    // intentionally left as a no-op: auto-pop removed.
  }, [loading, products, agentClosed]);

  function finishIntro(g: Goal | null) {
    setGoal(g);
    setShowIntro(false);
    try {
      localStorage.setItem('bt_intro_seen', new Date().toDateString());
    } catch {}
    if (g && g.key === 'surprise') {
      // Surprise me! → Spin the Thali wheel
      setShowSpin(true);
      return;
    }
    if (g && g.key === 'healthy') {
      // Healthy / High Protein → Macro Bucket Builder.
      // (The goal→category effect still sets the healthy category in the
      // background, so closing the builder lands on the right menu view.)
      setShowBucket(true);
      return;
    }
    if (g && g.key === 'indian') {
      // Indian Food → Combo | Thali chooser
      setShowIndian(true);
      return;
    }
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
    if (quick.has('under150')) list = list.filter((p) => (p.offerPrice || p.price) <= 150);
    if (quick.has('rating4')) list = list.filter((p) => p.rating >= 4);
    if (quick.has('offers')) list = list.filter((p) => p.offerPrice > 0 && p.offerPrice < p.price);
    if (quick.has('protein')) list = list.filter((p) => p.protein >= 15);
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
  }, [products, activeCat, sort, vegOnly, quick]);

  const recommended = useMemo(
    () => products
      .filter((p) => (!vegOnly || p.isVeg) && !p.isTodaysSpecial && p.stockStatus !== 'out_of_stock')
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 10),
    [products, vegOnly],
  );

  const specials = useMemo(
    () => products.filter((p) => p.isTodaysSpecial && (!vegOnly || p.isVeg)),
    [products, vegOnly],
  );

  if (showLanding) {
    return <DesktopLanding onEnter={enterApp} />;
  }

  // Desktop + already entered → full-width desktop ordering layout.
  // Mobile always falls through to the app below (isDesktop is false there).
  if (isDesktop) {
    return <DesktopApp />;
  }

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
          <FlashDealBar />
          {showIntro && <BiteAgentIntro onDone={finishIntro} />}
          {showSpin && !loading && (
            <SpinTheThali
              products={products}
              vegOnly={vegOnly}
              onAdd={add}
              onClose={() => setShowSpin(false)}
            />
          )}
          {showBucket && !loading && (
            <MacroBucketBuilder
              products={products}
              vegOnly={vegOnly}
              onAdd={add}
              onClose={() => setShowBucket(false)}
              onSkip={() => {
                // true skip → clean home page (no leftover healthy filter)
                setShowBucket(false);
                setActiveCat('all');
              }}
            />
          )}
          {showIndian && !loading && (
            <IndianFoodChooser
              categories={categories}
              onSelectCategory={(catId) => {
                setShowIndian(false);
                setActiveCat(catId);
                setTimeout(() => {
                  document
                    .getElementById('catrow')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 350);
              }}
              onCustomize={() => {
                setShowIndian(false);
                setShowThali(true);
              }}
              onSkip={() => {
                // true skip → clean home page
                setShowIndian(false);
                setActiveCat('all');
              }}
            />
          )}
          {showThali && (
            <ThaliBuilder
              onDone={(config: ThaliConfig) => {
                addThali({
                  templateId: config.templateId,
                  templateName: config.templateName,
                  total: config.total,
                  selections: config.selections,
                  portions: config.portions,
                });
                setShowThali(false);
              }}
              onSkip={() => {
                setShowThali(false);
                setActiveCat('all');
              }}
            />
          )}
        </>
      }
    >
      {/* hero — promo when a real coupon is live, else brand message.
          When the animated banner deck is on screen (no admin banners), the
          deck already carries the coupon — so the hero stays on-brand to
          avoid saying the same offer twice. */}
      {featuredCoupon && banners.length > 0 ? (
        <section className="bt-hero bt-hero--promo">
          <span className="promo-spark s1" aria-hidden>✦</span>
          <span className="promo-spark s2" aria-hidden>✦</span>
          <span className="promo-ticket t1" aria-hidden>🎟️</span>
          <span className="promo-ticket t2" aria-hidden>🎟️</span>
          <span className="bt-veg-badge">100% PURE VEG · LIMITED TIME</span>
          <div className="promo-offer">
            <span className="promo-flat">FLAT</span>
            <span className="promo-big">{featuredCoupon.label}</span>
          </div>
          <p className="promo-sub">
            Use code <b>{featuredCoupon.code}</b> · healthy meals, honest prices
          </p>
          <button className="promo-cta" onClick={() => router.push('/menu')}>
            Order now <span aria-hidden>→</span>
          </button>
        </section>
      ) : (
        <section className="bt-hero">
          <span className="bt-veg-badge">100% PURE VEG</span>
          <h1 className="bt-hero-title">
            Smart Food.
            <br />
            Better Living.
          </h1>
          <p className="bt-hero-sub">Good food. Right price. Under ₹99 combos.</p>
        </section>
      )}

      {!storeStatus.open && (
        <section style={{ padding: '0 16px' }}>
          <StoreClosedBanner status={storeStatus} />
        </section>
      )}

      {/* S5: live order tracking — the most urgent thing a returning customer
          wants. Renders nothing when there's no order in flight. */}
      <LiveOrderCard />

      {/* timed campaigns — renders nothing when none are live */}
      <OfferStrip />

      {/* animated promo deck — shows until real banners are uploaded */}
      {banners.length === 0 && !loading && (
        <PromoBannerDeck coupon={featuredCoupon} />
      )}

      {/* banners (admin-managed) */}
      {banners.length > 0 && (
        <section className="bt-banners">
          <div className="bt-banner-track" id="btbanners">
            {banners.map((b) => {
              // media-aware: .mp4/.webm/.mov (incl. Cloudinary /video/ URLs)
              // play as silent looping video; GIF/PNG/JPG/WebP render as image.
              const url = b.imageUrl || '';
              const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url) || /\/video\/upload\//.test(url);
              return (
                <a
                  key={b.id}
                  className="bt-banner"
                  href={b.linkUrl || '#'}
                  onClick={(e) => { if (!b.linkUrl) e.preventDefault(); }}
                >
                  {url && (isVideo ? (
                    <video
                      src={url}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={url} alt={b.title} />
                  ))}
                  {b.title && <span className="bt-banner-title">{b.title}</span>}
                </a>
              );
            })}
          </div>
          {banners.length > 1 && (
            <div className="bt-banner-dots">
              {banners.map((_, i) => <i key={i} className={i === bannerIdx ? 'on' : ''} />)}
            </div>
          )}
        </section>
      )}

      {/* recommended for you */}
      {activeCat === 'all' && recommended.length > 0 && (
        <RecommendedRow products={recommended} />
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
          {!loading && categories.length > 0 && (
            <button
              className="bt-cat"
              onClick={() => router.push('/cuisines')}
              aria-label="See all cuisines"
            >
              <span className="bt-cat-ic" style={{ background: C.greenSoft }}>
                <span style={{ fontSize: 20 }}>🍽️</span>
              </span>
              <span className="bt-cat-lbl" style={{ color: C.green, fontWeight: 700 }}>See all</span>
            </button>
          )}
        </div>
      </section>

      {/* offers */}
      <section className="bt-offers">
        {featuredCoupon && (
          <div className="bt-offer dark">
            <span className="bt-offer-ic" style={{ background: C.orange }}>
              %
            </span>
            <div>
              <div className="bt-offer-t">{featuredCoupon.label}</div>
              <div className="bt-offer-s">USE {featuredCoupon.code}</div>
            </div>
          </div>
        )}
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

        {/* quick filters (multi-select) */}
        {(
          [
            ['under150', '💸 Under ₹150'],
            ['rating4', '⭐ Rating 4+'],
            ['offers', '🏷️ Offers'],
            ['protein', '💪 High Protein'],
          ] as [string, string][]
        ).map(([k, lbl]) => (
          <button
            key={k}
            className={`bt-chip ${quick.has(k) ? 'on' : ''}`}
            onClick={() => toggleQuick(k)}
            aria-pressed={quick.has(k)}
          >
            {lbl}
          </button>
        ))}

        {/* sort */}
        {(
          [
            ['pop', 'Top Rated'],
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

        {quick.size > 0 && (
          <button className="bt-chip bt-chip--clear" onClick={() => setQuick(new Set())}>
            Clear ✕
          </button>
        )}
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
      <TodaysSpecialModal
        open={specialOpen}
        onClose={() => setSpecialOpen(false)}
        specials={specials}
      />

    </AppShell>
  );
}
