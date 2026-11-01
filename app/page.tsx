'use client';

// session is per-user, so never statically pre-render this page
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import AppShell from './components/AppShell';
import AppHeader from './components/AppHeader';
import CartBar from './components/CartBar';
import ProfileDrawer from './components/ProfileDrawer';
import BiteAgentIntro, { Goal } from './components/BiteAgentIntro';
import SpinTheThali from './components/SpinTheThali';
import MacroBucketBuilder from './components/MacroBucketBuilder';
import IndianFoodChooser from './components/IndianFoodChooser';
import ThaliBuilder, { ThaliConfig } from './components/ThaliBuilder';
import FlashDealBar from './components/FlashDealBar';
import StoreClosedBanner from './components/StoreClosedBanner';
import DesktopApp from './components/DesktopApp';
import LiveOrderCard from './components/LiveOrderCard';
import LaunchHero from './components/LaunchHero';
import { AppTiles, MenuSections, SiteFooter, TrustStrip } from './components/StorefrontParts';
import { useCatalog } from './lib/useCatalog';
import { useCart } from './providers/CartProvider';
import { fetchStoreSettings } from './lib/bite';
import { useStoreSettings } from './lib/useStoreSettings';
import { useDesktopLanding } from './lib/useDesktopLanding';

/**
 * Home — one clean ordering page, top to bottom:
 *   launch hero (Admin → Home page) · kitchen-closed notice · live order
 *   · trust strip · category chips · featured sections (Thali, Combos)
 *   · full menu · "You can also order from" · footer
 * Every dish, price, app price and section order comes from the backend.
 */
export default function HomePage() {
  const { products, categories, loading, error } = useCatalog();
  const { status: storeStatus } = useStoreSettings();
  const { add, addThali } = useCart();
  const { isDesktop } = useDesktopLanding();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // guided intro (admin-controlled in Store Settings) and the tools it opens
  const [showIntro, setShowIntro] = useState(false);
  const [showSpin, setShowSpin] = useState(false);
  const [showBucket, setShowBucket] = useState(false);
  const [showIndian, setShowIndian] = useState(false);
  const [showThali, setShowThali] = useState(false);

  /* The intro pops only as the admin configured it (off / once / daily /
     always). Settings unreachable → stay quiet. */
  useEffect(() => {
    let alive = true;
    fetchStoreSettings()
      .then((st) => {
        if (!alive || st?.bhaiyaIntroEnabled === false) return;
        const freq = st?.bhaiyaIntroFrequency || 'daily';
        try {
          const seen = localStorage.getItem('bt_intro_seen');
          if (freq === 'always') setShowIntro(true);
          else if (freq === 'once') { if (!seen) setShowIntro(true); }
          else if (seen !== new Date().toDateString()) setShowIntro(true);
        } catch {
          setShowIntro(true);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const scrollToCategory = (id: number) =>
    setTimeout(() => {
      document.getElementById(`sf-cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);

  function finishIntro(g: Goal | null) {
    setShowIntro(false);
    try {
      localStorage.setItem('bt_intro_seen', new Date().toDateString());
    } catch {}
    if (!g) return;
    if (g.key === 'surprise') return setShowSpin(true);
    if (g.key === 'healthy') return setShowBucket(true);
    if (g.key === 'indian') return setShowIndian(true);
    const hit = categories.find((c) => g.match(c));
    if (hit) scrollToCategory(hit.id);
  }

  // Desktop gets the full-width layout built from the same pieces.
  if (isDesktop) return <DesktopApp />;

  return (
    <AppShell
      header={<AppHeader variant="home" showSearch onMenu={() => setDrawerOpen(true)} />}
      footerExtra={<CartBar />}
      overlay={
        <>
          <ProfileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
          <FlashDealBar />
          {showIntro && <BiteAgentIntro onDone={finishIntro} />}
          {showSpin && !loading && (
            <SpinTheThali products={products} vegOnly onAdd={add} onClose={() => setShowSpin(false)} />
          )}
          {showBucket && !loading && (
            <MacroBucketBuilder
              products={products}
              vegOnly
              onAdd={add}
              onClose={() => setShowBucket(false)}
              onSkip={() => setShowBucket(false)}
            />
          )}
          {showIndian && !loading && (
            <IndianFoodChooser
              categories={categories}
              onSelectCategory={(catId) => {
                setShowIndian(false);
                if (catId !== 'all') scrollToCategory(catId);
              }}
              onCustomize={() => {
                setShowIndian(false);
                setShowThali(true);
              }}
              onSkip={() => setShowIndian(false)}
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
              onSkip={() => setShowThali(false)}
            />
          )}
        </>
      }
    >
      <LaunchHero />

      {!storeStatus.open && (
        <section style={{ padding: '12px 16px 0' }}>
          <StoreClosedBanner status={storeStatus} />
        </section>
      )}

      {/* the order on its way, if there is one */}
      <LiveOrderCard />

      <TrustStrip />

      <MenuSections products={products} categories={categories} loading={loading} error={error} />

      <AppTiles />
      <SiteFooter />
      <div style={{ height: 8 }} />
    </AppShell>
  );
}
