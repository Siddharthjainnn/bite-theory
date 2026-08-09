'use client';

/**
 * PromoBannerDeck — three fully-animated, code-built promo banners
 * (Swiggy/Zomato energy, zero image uploads needed, Bite Theory brand).
 *
 * Shown when the admin hasn't uploaded banner images; the moment real
 * banners exist in Admin → Banners, those take over automatically.
 *
 * Slides are wired to REAL data:
 *   1. Featured coupon (live code + label)      → /menu
 *   2. Build-your-own Thali                     → /thali
 *   3. High-protein / healthy pitch             → /menu (protein filter)
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PromoBannerDeck({
  coupon,
}: {
  coupon: { code: string; label: string } | null;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);

  // Launch-combos slide leads the carousel through the promo window (Aug 12-26 2026),
  // then drops off automatically.
  const now = new Date();
  const showLaunch =
    now >= new Date('2026-08-12T00:00:00+05:30') &&
    now <= new Date('2026-08-26T23:59:59+05:30');

  const launchSlide = {
    key: 'launch49',
    cls: 'pbd--gold pbd--launch',
    eyebrow: '🎉 GRAND OPENING · 12 AUG',
    big: 'LAUNCH COMBOS @ ₹49',
    sub: <>Paneer thali · Rajma rice · Chole rice · Fries + coffee — FREE delivery above ₹99</>,
    cta: 'Grab ₹49 combos',
    href: '/menu?cat=launch49',
    art: '🍱',
  };

  const baseSlides = [
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

  const slides = showLaunch ? [launchSlide, ...baseSlides] : baseSlides;

  // auto-advance every 3.8s
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 3800);
    return () => clearInterval(t);
  }, [slides.length]);

  const s = slides[idx];

  return (
    <section className="pbd-wrap">
      <div key={s.key} className={`pbd ${s.cls}`} onClick={() => router.push(s.href)} role="button" tabIndex={0}>
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
