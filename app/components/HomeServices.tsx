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

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { money } from '../lib/bite';
import { TIFFIN_PHONE, TIFFIN_PLAN } from '../tiffin/config';

/* Kept in sync with PromoBannerDeck — both read the same offer window. */
const SWIGGY_URL = 'https://www.swiggy.com/menu/1429311?source=sharing';
const SWIGGY_OFFER_ENDS = new Date('2026-09-01T23:59:59+05:30');

function fmtShort(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export default function HomeServices() {
  const router = useRouter();

  /* Null through SSR *and* the hydration render so both agree; the first
     effect pass fills it in. Reading the clock during render would mismatch. */
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(SWIGGY_OFFER_ENDS.getTime() - Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  const swiggyLive = left === null || left > 0;

  return (
    <section className="hsv">
      <div className="hsv-head">
        <h2 className="hsv-title">How can we feed you today?</h2>
        <span className="hsv-sub">Three ways to eat with us</span>
      </div>

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
            <b>{money(TIFFIN_PLAN.price)}</b>
            <span>{TIFFIN_PLAN.duration}</span>
          </div>
          <div className="hsv-note">{TIFFIN_PLAN.note}</div>

          <div className="hsv-actions">
            <span className="hsv-btn hsv-btn--solid">Enrol now <i>→</i></span>
            <a
              href={`tel:${TIFFIN_PHONE}`}
              className="hsv-btn hsv-btn--ghost"
              onClick={(e) => e.stopPropagation()}
            >
              📞 Call
            </a>
          </div>
        </div>
      </div>

      {/* ── secondary pair ── */}
      <div className="hsv-pair">
        <div
          className="hsv-tile hsv-tile--swiggy"
          role="button"
          tabIndex={0}
          onClick={() => window.open(SWIGGY_URL, '_blank', 'noopener,noreferrer')}
        >
          <span className="hsv-tile-art" aria-hidden>🛵</span>
          <span className="hsv-tile-eyebrow">NOW LIVE ON</span>
          <b className="hsv-tile-h">Swiggy</b>
          <span className="hsv-tile-p">Same kitchen, same menu</span>
          {swiggyLive && (
            <span className="hsv-timer">
              {left === null ? 'Offer on now' : `Ends in ${fmtShort(left)}`}
            </span>
          )}
        </div>

        <div
          className="hsv-tile hsv-tile--menu"
          role="button"
          tabIndex={0}
          onClick={() => router.push('/menu')}
        >
          <span className="hsv-tile-art" aria-hidden>🥗</span>
          <span className="hsv-tile-eyebrow">ORDER DIRECT</span>
          <b className="hsv-tile-h">Full menu</b>
          <span className="hsv-tile-p">Best price, no commission</span>
          <span className="hsv-timer hsv-timer--calm">Under ₹99 combos</span>
        </div>
      </div>
    </section>
  );
}
