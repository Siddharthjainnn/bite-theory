'use client';

/**
 * OfferStrip — the timed campaign carousel on the home page.
 *
 * The countdown is computed from the offer's ABSOLUTE `endsAt`, re-read every
 * tick — not by decrementing a number the server sent. Two reasons that
 * matters:
 *   1. A device clock running fast would otherwise show an expired offer as
 *      live; the customer taps it and gets refused at checkout, which feels
 *      like a bug in your app rather than a clock on their phone.
 *   2. Browsers throttle timers in background tabs. A decrementing counter
 *      drifts badly if the phone sleeps for ten minutes; re-deriving from a
 *      timestamp is always correct on wake.
 *
 * Offers vanish from the strip the instant they hit zero — no dead cards.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, LiveOffer, fetchOffers, money } from '../lib/bite';

/** Absolute time → parts. Never negative. */
function parts(endsAt: string) {
  const ms = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const total = Math.floor(ms / 1000);
  return {
    total,
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

function Countdown({ endsAt }: { endsAt: string }) {
  const [t, setT] = useState(() => parts(endsAt));
  useEffect(() => {
    setT(parts(endsAt));
    const id = setInterval(() => setT(parts(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  /* Under an hour, drop the days box — "00 Days" next to "04 Mins" reads as
     noise and buries the urgency that actually converts. */
  const showDays = t.d > 0;
  const cell = (v: string, l: string) => (
    <span className="ofr-tcell">
      <b>{v}</b><i>{l}</i>
    </span>
  );

  return (
    <span className={`ofr-timer ${t.total < 3600 ? 'ofr-timer--hot' : ''}`}>
      {showDays && cell(pad(t.d), 'Days')}
      {cell(pad(t.h), 'Hrs')}
      {cell(pad(t.m), 'Min')}
      {cell(pad(t.s), 'Sec')}
    </span>
  );
}

export default function OfferStrip() {
  const router = useRouter();
  const [offers, setOffers] = useState<LiveOffer[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetchOffers().then(setOffers);
    /* Re-fetch every 2 min: an admin may start a campaign mid-session, and a
       phone left open all evening should pick it up without a reload. */
    const t = setInterval(() => fetchOffers().then(setOffers), 120000);
    /* Separate 1s tick purely so expired cards disappear on time. */
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); clearInterval(tick); };
  }, []);

  // drop anything that has expired since the last fetch
  const liveOffers = offers.filter((o) => new Date(o.endsAt).getTime() > now);
  if (!liveOffers.length) return null;

  const rewardLine = (o: LiveOffer) => {
    switch (o.offerType) {
      case 'free_item':
        return o.freeProductName ? `${o.freeProductName} FREE` : 'FREE ITEM';
      case 'free_delivery':
        return 'FREE DELIVERY';
      case 'percentage':
        return `${Number(o.rewardValue)}% OFF`;
      default:
        return `${money(Number(o.rewardValue))} OFF`;
    }
  };

  return (
    <section className="ofr-wrap">
      <div className="ofr-head">
        <h2 className="ofr-title">⚡ Limited time offers</h2>
        <span className="ofr-sub">Grab them before the clock runs out</span>
      </div>

      <div className="ofr-row">
        {liveOffers.map((o) => (
          <button
            key={o.id}
            className={`ofr-card ${o.exhausted ? 'ofr-card--used' : ''}`}
            style={{ ['--ofr-accent' as any]: o.accent || C.orange }}
            onClick={() => router.push('/menu')}
          >
            <span className="ofr-rays" aria-hidden />
            {o.badge && <span className="ofr-badge">{o.badge}</span>}

            <span className="ofr-body">
              <span className="ofr-reward">{rewardLine(o)}</span>
              <span className="ofr-name">{o.title}</span>
              {o.minOrder > 0 && (
                <span className="ofr-min">on orders above {money(Number(o.minOrder))}</span>
              )}
            </span>

            {o.freeProductImage && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img className="ofr-pic" src={o.freeProductImage} alt={o.freeProductName || ''} />
            )}

            <Countdown endsAt={o.endsAt} />

            {/* Scarcity, but only when it's REAL — a fake counter is a lie
                customers eventually notice, and then trust nothing. */}
            {o.remaining != null && o.remaining <= 20 && !o.exhausted && (
              <span className="ofr-left">Only {o.remaining} left</span>
            )}

            {o.exhausted && <span className="ofr-used">Already claimed</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
