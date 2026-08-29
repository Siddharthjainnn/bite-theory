'use client';

/**
 * TiffinPrompt — the "Hi, are you looking for daily tiffin?" card on the home
 * page. This is the bridge between the Meta ad and the /tiffin funnel.
 *
 * It sits high on the page because ad traffic bounces fast, but it is
 * dismissible and remembers the dismissal for the rest of the session, so a
 * regular à-la-carte customer isn't nagged on every visit.
 */

import { useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { C, money } from '../lib/bite';
import { TIFFIN_PHONE, TIFFIN_PLAN } from '../tiffin/config';

/* ── dismissal store ──────────────────────────────────────────────────────
   sessionStorage is external to React, so it is read through
   useSyncExternalStore rather than an effect. The server snapshot reports
   "dismissed", which means the card is absent from the SSR HTML and the
   hydration render matches exactly; it then appears on the client. */
const listeners = new Set<() => void>();
let cache: boolean | null = null;

function isDismissed() {
  if (cache === null) {
    try { cache = !!sessionStorage.getItem('bt_tiffin_dismissed'); }
    catch { cache = false; }
  }
  return cache;
}

function dismissTiffin() {
  try { sessionStorage.setItem('bt_tiffin_dismissed', '1'); } catch {}
  cache = true;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export default function TiffinPrompt() {
  const router = useRouter();
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);

  if (dismissed) return null;

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    dismissTiffin();
  };

  return (
    <section style={{ padding: '4px 14px 0' }}>
      <div
        onClick={() => router.push('/tiffin')}
        role="button"
        tabIndex={0}
        style={{
          position: 'relative', overflow: 'hidden', cursor: 'pointer',
          borderRadius: 20, padding: '16px 16px 15px', color: '#fff',
          background: `radial-gradient(120% 150% at 88% -15%, ${C.orange} 0%, ${C.orangeDeep} 40%, ${C.dark} 100%)`,
          boxShadow: '0 8px 26px rgba(183,110,0,.32)',
          animation: 'tpRise .5s cubic-bezier(.34,1.3,.64,1) both',
        }}
      >
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{
            position: 'absolute', top: 9, right: 9, zIndex: 3,
            width: 26, height: 26, borderRadius: '50%', cursor: 'pointer',
            border: '1px solid rgba(255,255,255,.32)', background: 'rgba(0,0,0,.26)',
            color: '#fff', fontSize: 14, lineHeight: 1, fontFamily: 'inherit',
          }}
        >
          ×
        </button>

        <span style={{ fontSize: 30, position: 'absolute', right: 14, bottom: 8, opacity: .9 }}
          aria-hidden>🍱</span>

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '80%' }}>
          <span style={{
            fontSize: 10.5, fontWeight: 900, letterSpacing: .6,
            background: 'rgba(0,0,0,.24)', border: '1px solid rgba(255,255,255,.28)',
            padding: '3px 9px', borderRadius: 99,
          }}>
            👋 NEW · DAILY TIFFIN SERVICE
          </span>

          <h3 style={{
            fontSize: 18.5, fontWeight: 900, letterSpacing: -.5,
            margin: '9px 0 4px', lineHeight: 1.15,
          }}>
            Looking for daily tiffin?
          </h3>
          <p style={{ fontSize: 12.5, opacity: .95, margin: '0 0 11px', lineHeight: 1.45 }}>
            Home-style veg meals delivered every day — from{' '}
            <b>{money(TIFFIN_PLAN.price)} {TIFFIN_PLAN.duration}</b>. Enrol in a minute.
          </p>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: '#fff', color: C.ink, padding: '8px 15px',
              borderRadius: 20, fontSize: 12.5, fontWeight: 900,
            }}>
              Enrol now <i style={{ fontStyle: 'normal' }}>→</i>
            </span>
            <a
              href={`tel:${TIFFIN_PHONE}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                border: '1px solid rgba(255,255,255,.5)', color: '#fff',
                padding: '8px 14px', borderRadius: 20, fontSize: 12.5,
                fontWeight: 800, textDecoration: 'none',
              }}
            >
              📞 Call
            </a>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tpRise{from{opacity:0;transform:translateY(10px) scale(.985)}
          to{opacity:1;transform:none}}
      `}</style>
    </section>
  );
}
