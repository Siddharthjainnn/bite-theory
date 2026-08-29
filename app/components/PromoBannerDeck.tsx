'use client';

/**
 * PromoBannerDeck — fully-animated, code-built promo banners
 * (Swiggy/Zomato energy, zero image uploads needed, Bite Theory brand).
 *
 * Shown when the admin hasn't uploaded banner images; the moment real
 * banners exist in Admin → Banners, those take over automatically.
 *
 * Slides are wired to REAL data:
 *   0. Swiggy launch + 3-day countdown (external)  → Swiggy menu
 *   1. Featured coupon (live code + label)         → /menu
 *   2. Build-your-own Thali                        → /thali
 *   3. High-protein / healthy pitch                → /menu (protein filter)
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

/* ── Swiggy promo: edit these two lines to retime or retarget the offer ──
   SWIGGY_OFFER_ENDS is the hard cut-off. When the clock passes it the slide
   removes itself from the deck on its own — no deploy needed to take it down. */
const SWIGGY_URL = 'https://www.swiggy.com/menu/1429311?source=sharing';
const SWIGGY_OFFER_ENDS = new Date('2026-09-01T23:59:59+05:30');

type Slide = {
  key: string;
  cls: string;
  eyebrow: string;
  big: string;
  sub: ReactNode;
  cta: string;
  href: string;
  art: string;
  external?: boolean;
  countdown?: boolean;
};

/** ms → "2d 13:45:09" (or "13:45:09" inside the last day). */
function fmtLeft(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return d > 0
    ? `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}`
    : `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export default function PromoBannerDeck({
  coupon,
}: {
  coupon: { code: string; label: string } | null;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);

  /* Countdown ticks client-side only. It stays null through the server render
     AND the hydration render, so both agree; the first effect pass fills it in.
     Reading the clock during render instead would mismatch every second. */
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(SWIGGY_OFFER_ENDS.getTime() - Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const now = new Date();

  // Launch-combos slide leads the carousel through the promo window (Aug 12-26 2026),
  // then drops off automatically.
  const showLaunch =
    now >= new Date('2026-08-12T00:00:00+05:30') &&
    now <= new Date('2026-08-26T23:59:59+05:30');

  // Before the countdown has ticked once we fall back to a plain date compare,
  // which server and client both agree on.
  const showSwiggy =
    left !== null ? left > 0 : now.getTime() < SWIGGY_OFFER_ENDS.getTime();

  const swiggySlide: Slide = {
    key: 'swiggy',
    cls: 'pbd--swiggy',
    eyebrow: '🛵 NOW LIVE ON SWIGGY',
    big: 'ORDER US ON SWIGGY',
    sub: <>Bites Theory is live on Swiggy — same kitchen, same menu, delivered to your door</>,
    cta: 'Order on Swiggy',
    href: SWIGGY_URL,
    art: '🛵',
    external: true,
    countdown: true,
  };

  const launchSlide: Slide = {
    key: 'launch49',
    cls: 'pbd--gold pbd--launch',
    eyebrow: '🎉 GRAND OPENING · 12 AUG',
    big: 'LAUNCH COMBOS @ ₹49',
    sub: <>Paneer thali · Rajma rice · Chole rice · Fries + coffee — FREE delivery above ₹99</>,
    cta: 'Grab ₹49 combos',
    href: '/menu?cat=launch49',
    art: '🍱',
  };

  const baseSlides: Slide[] = [
    coupon
      ? {
          key: 'coupon',
          cls: 'pbd--gold',
          eyebrow: 'LIMITED TIME',
          big: coupon.label,
          sub: <>Use code <b>{coupon.code}</b> at checkout</>,
          cta: 'Order now',
          href: '/menu',
          art: '🎟️',
        }
      : {
          key: 'fresh',
          cls: 'pbd--gold',
          eyebrow: '100% PURE VEG',
          big: 'FRESH. FAST. HONEST.',
          sub: <>Healthy meals made to order, every day</>,
          cta: 'See menu',
          href: '/menu',
          art: '🥗',
        },
    {
      key: 'thali',
      cls: 'pbd--green',
      eyebrow: 'BUILD YOUR OWN',
      big: 'THALI, YOUR WAY',
      sub: <>Pick your portions · pay for what you eat</>,
      cta: 'Build thali',
      href: '/thali',
      art: '🍛',
    },
    {
      key: 'protein',
      cls: 'pbd--dark',
      eyebrow: 'FUEL UP',
      big: 'HIGH-PROTEIN MEALS',
      sub: <>15g+ protein bowls, chef-made fresh</>,
      cta: 'Explore',
      href: '/menu',
      art: '💪',
    },
  ];

  const slides: Slide[] = [
    ...(showSwiggy ? [swiggySlide] : []),
    ...(showLaunch ? [launchSlide] : []),
    ...baseSlides,
  ];

  // auto-advance every 3.8s
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 3800);
    return () => clearInterval(t);
  }, [slides.length]);

  const s = slides[Math.min(idx, slides.length - 1)];
  if (!s) return null;

  const go = () => {
    if (s.external) {
      window.open(s.href, '_blank', 'noopener,noreferrer');
      return;
    }
    router.push(s.href);
  };

  return (
    <section className="pbd-wrap">
      <div key={s.key} className={`pbd ${s.cls}`} onClick={go} role="button" tabIndex={0}>
        {/* animated background layers */}
        <span className="pbd-rays" aria-hidden />
        <span className="pbd-sheen" aria-hidden />
        <span className="pbd-tkt t1" aria-hidden>🎟️</span>
        <span className="pbd-tkt t2" aria-hidden>✦</span>
        <span className="pbd-tkt t3" aria-hidden>🎟️</span>

        <div className="pbd-body">
          <span className="pbd-eyebrow">{s.eyebrow}</span>
          <span className="pbd-big">{s.big}</span>
          <span className="pbd-sub">{s.sub}</span>
          {s.countdown && left !== null && left > 0 && (
            <span className="pbd-timer">
              <i aria-hidden>⏱</i> Offer ends in <b>{fmtLeft(left)}</b>
            </span>
          )}
          <span className="pbd-cta">{s.cta} <i>→</i></span>
        </div>
        <span className="pbd-art" aria-hidden>{s.art}</span>
      </div>

      <div className="bt-banner-dots">
        {slides.map((sl, i) => (
          <i
            key={sl.key}
            className={i === idx ? 'on' : ''}
            onClick={(e) => { e.stopPropagation(); setIdx(i); }}
            role="button"
            aria-label={`Banner ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
