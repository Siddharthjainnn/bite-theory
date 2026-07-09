'use client';

/**
 * DesktopLanding — the professional marketing landing shown ONLY to
 * desktop/laptop visitors on the customer home route ( / ).
 *
 * - All content comes from the DB (useLanding → GET /settings.landingContent),
 *   editable in /admin.
 * - Today's dishes come from the live catalog (real products).
 * - The map pins the store's real lat/lng (or an admin-provided embed URL).
 * - "Order Now" calls onEnter() → the parent swaps to the real ordering app.
 *
 * NOTE: this component is only ever rendered from app/page.tsx, so it can
 * never appear on /admin or /rider.
 */

import { useLanding } from '../lib/useLanding';
import { useCatalog } from '../lib/useCatalog';
import { C, money, effectivePrice } from '../lib/bite';

export default function DesktopLanding({ onEnter }: { onEnter: () => void }) {
  const { content, location } = useLanding();
  const { products } = useCatalog();

  // real dishes: prefer today's specials, else first few veg products
  const dishes = (() => {
    const specials = products.filter((p) => p.isTodaysSpecial);
    const base = specials.length >= 4 ? specials : products;
    return base.slice(0, 4);
  })();

  const hasPin = location.storeLat != null && location.storeLng != null;
  const mapsHref = hasPin
    ? `https://www.google.com/maps/search/?api=1&query=${location.storeLat},${location.storeLng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.storeAddress || 'Indore')}`;

  return (
    <div className="dl-root">
      {/* ── HEADER ── */}
      <header className="dl-head">
        <div className="dl-head-inner">
          <div className="dl-brand">
            {content.logoUrl ? (
              <img src={content.logoUrl} alt={content.brandName} className="dl-logo-img" />
            ) : (
              <div className="dl-logo">{(content.brandName || 'B').charAt(0)}</div>
            )}
            <div>
              <div className="dl-brand-name">{content.brandName}</div>
              <div className="dl-brand-loc">📍 {location.storeAddress || 'Indore'}</div>
            </div>
          </div>
          <nav className="dl-nav">
            <button className="dl-nav-link" onClick={onEnter}>Menu</button>
            <a className="dl-nav-link" href="#find-us">Find Us</a>
            <button className="dl-order-btn dl-pulse" onClick={onEnter}>🍽️ Order Now →</button>
          </nav>
        </div>

        {/* ── HERO ── */}
        <div className="dl-hero">
          <div className="dl-hero-text dl-rise">
            <div className="dl-badge">🌿 {content.heroBadge}</div>
            <h1 className="dl-h1">
              {content.tagline1}<br />
              <span className="dl-shimmer">{content.tagline2}</span>
            </h1>
            <p className="dl-sub">{content.heroSubtitle}</p>
            <div className="dl-cta-row">
              <button className="dl-cta" onClick={onEnter}>Order Now →</button>
              <button className="dl-cta-ghost" onClick={onEnter}>See Menu</button>
            </div>
            <div className="dl-stats">
              <div><div className="dl-stat-v">{content.stat1Value}</div><div className="dl-stat-l">{content.stat1Label}</div></div>
              <div><div className="dl-stat-v">{content.stat2Value}</div><div className="dl-stat-l">{content.stat2Label}</div></div>
              <div><div className="dl-stat-v">{content.stat3Value}</div><div className="dl-stat-l">{content.stat3Label}</div></div>
            </div>
          </div>
          <div className="dl-hero-art">
            <div className="dl-halo" />
            <span className="dl-food" style={{ right: 150, top: 20 }}>🍛</span>
            <span className="dl-food dl-food2" style={{ right: 40, top: 60, fontSize: 56 }}>🥘</span>
            <span className="dl-food dl-food2" style={{ right: 180, top: 150 }}>🫓</span>
            <span className="dl-food" style={{ right: 70, top: 200 }}>🍵</span>
            <span className="dl-food" style={{ right: 200, top: 240, fontSize: 34 }}>🌿</span>
          </div>
        </div>
        <svg className="dl-wave" viewBox="0 0 1200 40" preserveAspectRatio="none">
          <path d="M0,40 L0,20 Q300,40 600,20 T1200,20 L1200,40 Z" fill={C.bg} />
        </svg>
      </header>

      {/* ── TRUST STATS ── */}
      <section className="dl-features">
        <div className="dl-features-grid">
          {content.features.map((f, i) => (
            <div key={i} className="dl-feat">
              <div className="dl-feat-ic">{f.icon}</div>
              <div className="dl-feat-t">{f.title}</div>
              <div className="dl-feat-s">{f.subtitle}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TODAY'S DISHES (real catalog) ── */}
      {dishes.length > 0 && (
        <section className="dl-dishes">
          <div className="dl-dishes-inner">
            <div className="dl-eyebrow">इंदौर का स्वाद · TASTE OF INDORE</div>
            <h2 className="dl-h2">What's cooking today</h2>
            <p className="dl-h2-sub">Handpicked favourites, made fresh every morning</p>
            <div className="dl-dish-grid">
              {dishes.map((p) => (
                <button key={p.id} className="dl-dish" onClick={onEnter}>
                  <div className="dl-dish-img">
                    {p.image ? <img src={p.image} alt={p.name} /> : <span>🍛</span>}
                  </div>
                  <div className="dl-dish-body">
                    <div className="dl-dish-name">{p.name}</div>
                    <div className="dl-dish-meta">{p.isVeg ? '🟢 pure veg' : ''}</div>
                    <div className="dl-dish-foot">
                      <span className="dl-dish-price">{money(effectivePrice(p))}</span>
                      {p.isTodaysSpecial && <span className="dl-dish-tag">Today's special</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FIND US + MAP ── */}
      <section id="find-us" className="dl-find">
        <div className="dl-find-inner">
          <div>
            <div className="dl-eyebrow" style={{ color: C.orange }}>📍 FIND US</div>
            <h2 className="dl-h2" style={{ textAlign: 'left' }}>Come say namaste</h2>
            <p className="dl-find-addr">{location.storeAddress || 'Indore, Madhya Pradesh'}</p>
            <div className="dl-find-rows">
              <div>🕐 {content.hoursLine}</div>
              <div>🛵 Delivering within {location.deliveryRadiusKm} km</div>
              <div>📞 {content.phone}</div>
            </div>
            <a className="dl-dir-btn" href={mapsHref} target="_blank" rel="noreferrer">Get Directions →</a>
          </div>
          <div className="dl-map">
            {content.mapEmbedUrl ? (
              <iframe
                title="Our location"
                src={content.mapEmbedUrl}
                style={{ border: 0, width: '100%', height: '100%' }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : hasPin ? (
              <iframe
                title="Our location"
                src={`https://maps.google.com/maps?q=${location.storeLat},${location.storeLng}&z=15&output=embed`}
                style={{ border: 0, width: '100%', height: '100%' }}
                loading="lazy"
              />
            ) : (
              <div className="dl-map-fallback">
                <div className="dl-map-pin dl-pulse">📍</div>
                <div className="dl-map-label">{content.brandName}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="dl-final">
        <div className="dl-final-inner">
          <h2 className="dl-final-h">{content.ctaHeading}</h2>
          <p className="dl-final-sub">{content.ctaSubtitle}</p>
          <button className="dl-cta dl-pulse" onClick={onEnter}>Order Now →</button>
          <div className="dl-copy">© {new Date().getFullYear()} {content.brandName} · {location.storeAddress ? location.storeAddress.split(',').slice(-2).join(',').trim() : 'Indore'} · 100% Pure Veg</div>
        </div>
      </section>

      <style jsx>{`
        .dl-root { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: ${C.bg}; min-height: 100vh; overflow-x: hidden; }
        .dl-head { background: ${C.dark}; color: #fff; position: relative; overflow: hidden; }
        .dl-head::before { content: ''; position: absolute; inset: 0; opacity: .10; background-image: repeating-linear-gradient(90deg, ${C.orange} 0 2px, transparent 2px 46px); }
        .dl-head-inner { max-width: 1180px; margin: 0 auto; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 2; }
        .dl-brand { display: flex; align-items: center; gap: 12px; }
        .dl-logo { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, ${C.green}, ${C.orange}); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 22px; color: #fff; }
        .dl-logo-img { width: 44px; height: 44px; border-radius: 12px; object-fit: cover; }
        .dl-brand-name { font-weight: 800; font-size: 19px; letter-spacing: -.02em; }
        .dl-brand-loc { font-size: 11px; color: #8fb3a3; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dl-nav { display: flex; align-items: center; gap: 22px; }
        .dl-nav-link { background: none; border: none; color: #cfe3d8; font-size: 14px; font-weight: 600; cursor: pointer; }
        .dl-order-btn { background: linear-gradient(135deg, ${C.orange}, #f7a73a); color: #fff; border: none; padding: 11px 24px; border-radius: 24px; font-weight: 800; font-size: 14px; cursor: pointer; }
        .dl-hero { position: relative; max-width: 1180px; margin: 0 auto; padding: 52px 32px 66px; display: grid; grid-template-columns: 1.1fr .9fr; gap: 20px; align-items: center; z-index: 2; }
        .dl-badge { display: inline-block; background: rgba(76,175,80,.18); border: 1px solid rgba(76,175,80,.5); color: #a7e0ab; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 20px; letter-spacing: .04em; }
        .dl-h1 { font-size: 52px; line-height: 1.05; margin: 18px 0 8px; font-weight: 900; letter-spacing: -.03em; }
        .dl-shimmer { background: linear-gradient(90deg, ${C.orange}, #fff, ${C.orange}); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; animation: dlShimmer 4s linear infinite; }
        .dl-sub { font-size: 16px; color: #bcd3c8; line-height: 1.6; max-width: 440px; margin: 0 0 26px; }
        .dl-cta-row { display: flex; gap: 14px; align-items: center; }
        .dl-cta { background: linear-gradient(135deg, ${C.orange}, #f7a73a); color: #fff; border: none; padding: 15px 34px; border-radius: 30px; font-weight: 800; font-size: 16px; cursor: pointer; box-shadow: 0 10px 26px rgba(245,158,11,.4); }
        .dl-cta-ghost { background: transparent; color: #fff; border: 1.5px solid rgba(255,255,255,.35); padding: 15px 26px; border-radius: 30px; font-weight: 700; font-size: 15px; cursor: pointer; }
        .dl-stats { display: flex; gap: 26px; margin-top: 30px; }
        .dl-stat-v { font-size: 24px; font-weight: 900; color: ${C.orange}; }
        .dl-stat-l { font-size: 12px; color: #8fb3a3; }
        .dl-hero-art { position: relative; height: 320px; }
        .dl-halo { position: absolute; right: 20px; top: 20px; width: 250px; height: 250px; border-radius: 50%; background: radial-gradient(circle, ${C.green}33, transparent 68%); border: 2px dashed rgba(245,158,11,.3); }
        .dl-food { position: absolute; font-size: 44px; animation: dlFloat 6s ease-in-out infinite; filter: drop-shadow(0 8px 14px rgba(0,0,0,.18)); }
        .dl-food2 { animation-name: dlFloat2; }
        .dl-wave { display: block; width: 100%; height: 40px; position: relative; z-index: 1; }
        .dl-features { background: ${C.bg}; padding: 40px 32px; }
        .dl-features-grid { max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .dl-feat { background: #fff; border-radius: 16px; padding: 22px; text-align: center; border: 1px solid ${C.line}; }
        .dl-feat-ic { font-size: 30px; }
        .dl-feat-t { font-weight: 900; font-size: 22px; color: ${C.dark}; margin-top: 6px; }
        .dl-feat-s { font-size: 12px; color: ${C.muted}; }
        .dl-dishes { background: #fff; padding: 48px 32px; }
        .dl-dishes-inner { max-width: 1180px; margin: 0 auto; text-align: center; }
        .dl-eyebrow { font-size: 13px; font-weight: 800; color: ${C.orange}; letter-spacing: .08em; }
        .dl-h2 { font-size: 34px; font-weight: 900; color: ${C.dark}; margin: 10px 0 6px; letter-spacing: -.02em; }
        .dl-h2-sub { color: ${C.muted}; margin: 0 0 30px; }
        .dl-dish-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
        .dl-dish { border-radius: 18px; overflow: hidden; border: 1px solid ${C.line}; text-align: left; background: #fff; cursor: pointer; padding: 0; transition: transform .15s, box-shadow .15s; }
        .dl-dish:hover { transform: translateY(-4px); box-shadow: 0 14px 30px rgba(13,59,46,.12); }
        .dl-dish-img { height: 120px; background: linear-gradient(135deg, #fff3d6, #ffe0a3); display: flex; align-items: center; justify-content: center; font-size: 52px; overflow: hidden; }
        .dl-dish-img img { width: 100%; height: 100%; object-fit: cover; }
        .dl-dish-body { padding: 14px; }
        .dl-dish-name { font-weight: 800; color: ${C.dark}; }
        .dl-dish-meta { font-size: 12px; color: ${C.muted}; margin: 4px 0 8px; }
        .dl-dish-foot { display: flex; justify-content: space-between; align-items: center; }
        .dl-dish-price { font-weight: 900; color: ${C.dark}; }
        .dl-dish-tag { background: ${C.orangeSoft}; color: ${C.orangeDeep}; font-size: 11px; font-weight: 800; padding: 4px 8px; border-radius: 8px; }
        .dl-find { background: ${C.bg}; padding: 48px 32px; }
        .dl-find-inner { max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 28px; align-items: center; }
        .dl-find-addr { color: ${C.muted}; line-height: 1.6; margin: 8px 0 18px; }
        .dl-find-rows { display: flex; flex-direction: column; gap: 10px; }
        .dl-find-rows > div { font-size: 14px; color: ${C.dark}; font-weight: 600; }
        .dl-dir-btn { display: inline-block; margin-top: 20px; background: ${C.dark}; color: #fff; border: none; padding: 13px 26px; border-radius: 26px; font-weight: 800; font-size: 15px; cursor: pointer; }
        .dl-map { position: relative; height: 300px; border-radius: 20px; overflow: hidden; border: 1px solid ${C.line}; background: linear-gradient(135deg, #eef4f0, #dfe9e3); }
        .dl-map-fallback { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .dl-map-pin { width: 44px; height: 44px; border-radius: 50%; background: ${C.orange}; display: flex; align-items: center; justify-content: center; font-size: 22px; }
        .dl-map-label { margin-top: 6px; background: ${C.dark}; color: #fff; font-size: 11px; font-weight: 800; padding: 5px 10px; border-radius: 8px; }
        .dl-final { background: ${C.dark}; color: #fff; padding: 44px 32px; text-align: center; position: relative; overflow: hidden; }
        .dl-final::before { content: ''; position: absolute; inset: 0; opacity: .08; background-image: repeating-linear-gradient(90deg, ${C.orange} 0 2px, transparent 2px 46px); }
        .dl-final-inner { position: relative; z-index: 2; }
        .dl-final-h { font-size: 30px; font-weight: 900; margin: 0 0 8px; letter-spacing: -.02em; }
        .dl-final-sub { color: #bcd3c8; margin: 0 0 22px; }
        .dl-copy { margin-top: 26px; font-size: 12px; color: #6f8b7f; }
        .dl-pulse { animation: dlPulse 2.4s infinite; }
        .dl-rise { animation: dlRise .8s ease both; }
        @keyframes dlFloat { 0%,100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-14px) rotate(4deg); } }
        @keyframes dlFloat2 { 0%,100% { transform: translateY(0) rotate(6deg); } 50% { transform: translateY(-18px) rotate(-3deg); } }
        @keyframes dlShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes dlPulse { 0% { box-shadow: 0 0 0 0 rgba(245,158,11,.5); } 70% { box-shadow: 0 0 0 16px rgba(245,158,11,0); } 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); } }
        @keyframes dlRise { 0% { opacity: 0; transform: translateY(24px); } 100% { opacity: 1; transform: translateY(0); } }
        @media (max-width: 900px) {
          .dl-hero { grid-template-columns: 1fr; }
          .dl-hero-art { display: none; }
          .dl-features-grid, .dl-dish-grid { grid-template-columns: repeat(2, 1fr); }
          .dl-find-inner { grid-template-columns: 1fr; }
          .dl-h1 { font-size: 40px; }
        }
      `}</style>
    </div>
  );
}
