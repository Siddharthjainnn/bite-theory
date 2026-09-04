'use client';

/**
 * HomeServices — the "how do you want to eat today?" block on the home page.
 *
 * WHY THIS EXISTS
 * Bites Theory now sells three different ways: one-off orders on this site, the
 * same menu on Swiggy, and a daily tiffin subscription. Before this block, each
 * of those had its own banner competing for the same strip of screen directly
 * under the header, and the customer had to work out which one applied to them.
 *
 * The bento layout answers that in one glance: tiffin is the primary tile
 * because it is the highest-value (recurring) product and the destination for
 * the Meta ad spend; Swiggy and the à-la-carte menu sit beneath it as equal
 * secondary options.
 *
 * The Swiggy tile carries its own countdown so the promo urgency survives even
 * when a customer never waits for the carousel to reach the Swiggy slide.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { money } from '../lib/bite';
import { TIFFIN_PHONE_TEL, MONTHLY_PLAN, TRIAL_PLAN } from '../tiffin/config';
import { LIVE_PLATFORMS, FREE_DELIVERY_ABOVE } from '../lib/platforms';

/**
 * Platform logo, falling back to a wordmark.
 *
 * The image is only trusted once it has actually loaded: a missing file would
 * otherwise leave a blank space on the busiest tile on the page. onError flips
 * to the styled name instead, so the tile always reads correctly whether or
 * not the logo files have been added.
 */
function PlatformMark({ platform }: { platform: (typeof LIVE_PLATFORMS)[number] }) {
  const [failed, setFailed] = useState(false);
  if (platform.logo && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={platform.logo}
        alt={platform.name}
        className="hsv-plat-logo"
        onError={() => setFailed(true)}
      />
    );
  }
  return <b className="hsv-tile-h hsv-plat-word">{platform.name}</b>;
}

export default function HomeServices() {
  const router = useRouter();

  return (
    <section className="hsv">
      <div className="hsv-head">
        <h2 className="hsv-title">Order now</h2>
        <span className="hsv-sub">Live on Toing &amp; Swiggy</span>
      </div>

      {/* ── marketplaces first ──
          Ordered for VOLUME, not margin. A direct order is worth more (no
          commission), but early on the marketplaces are where the customers
          already are, and their ranking rewards order count — so the tiles
          that win orders today lead the page. Revisit once direct demand
          is established. */}
      {LIVE_PLATFORMS.length > 0 && (
        <div className="hsv-pair hsv-pair--lead">
          {LIVE_PLATFORMS.map((p) => (
            <div
              key={p.key}
              className="hsv-tile hsv-tile--platform"
              role="button"
              tabIndex={0}
              style={{ background: p.gradient, boxShadow: p.shadow }}
              onClick={() => window.open(p.url, '_blank', 'noopener,noreferrer')}
            >
              <span className="hsv-tile-art" aria-hidden>{p.art}</span>
              <span className="hsv-plat-badge">ORDER NOW ON</span>
              <PlatformMark platform={p} />
              <span className="hsv-tile-p">{p.blurb}</span>
              {p.offer && <span className="hsv-timer">🎉 {p.offer}</span>}
              <span className="hsv-cta-mini hsv-cta-mini--tight">Order →</span>
            </div>
          ))}
        </div>
      )}

      {/* ── primary: daily tiffin ── */}
      <div
        className="hsv-hero"
        role="button"
        tabIndex={0}
        onClick={() => router.push('/tiffin')}
      >
        <span className="hsv-glow" aria-hidden />
        <span className="hsv-hero-art" aria-hidden>🍱</span>

        <div className="hsv-hero-body">
          <span className="hsv-chip">👋 NEW · DAILY TIFFIN</span>
          <h3 className="hsv-hero-h">Looking for daily tiffin?</h3>
          <p className="hsv-hero-p">
            Home-style veg meals, delivered to your desk every single day.
            Pick your days, your address, your time.
          </p>

          <div className="hsv-price">
            <b>{money(MONTHLY_PLAN.total)}</b>
            <span>{MONTHLY_PLAN.duration}</span>
          </div>
          {/* The trial is the actual hook for cold ad traffic — the monthly
              number anchors the value, this line removes the risk. */}
          <div className="hsv-note">
            or try 1 day for {money(TRIAL_PLAN.total)} · delivery included
          </div>

          <div className="hsv-actions">
            <span className="hsv-btn hsv-btn--solid">Enrol now <i>→</i></span>
            <a
              href={`tel:${TIFFIN_PHONE_TEL}`}
              className="hsv-btn hsv-btn--ghost"
              onClick={(e) => e.stopPropagation()}
            >
              📞 Call
            </a>
          </div>
        </div>
      </div>

      {/* ── order direct: lowest price for the customer, best margin for us ── */}
      <div
        className="hsv-tile hsv-tile--menu hsv-wide"
        role="button"
        tabIndex={0}
        onClick={() => router.push('/menu')}
      >
        <span className="hsv-tile-art" aria-hidden>🥗</span>
        <span className="hsv-tile-eyebrow">ORDER DIRECT · BEST PRICE</span>
        <b className="hsv-tile-h">Our full menu</b>
        <span className="hsv-tile-p">
          No commission, so you get our lowest price. Free delivery above ₹{FREE_DELIVERY_ABOVE}.
        </span>
        <span className="hsv-cta-mini">Browse menu →</span>
      </div>
    </section>
  );
}
