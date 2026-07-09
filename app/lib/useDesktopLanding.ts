'use client';

/**
 * useDesktopLanding — decides whether the marketing landing should show.
 *
 * Rules:
 *  - Mobile / narrow screens  → never show the landing (showLanding = false),
 *    so the app renders exactly as it always has.
 *  - Desktop (≥ 1024px)       → show the landing UNTIL the visitor clicks
 *    "Order Now" (enterApp), remembered for the browser session.
 *
 * This hook is only ever called from app/page.tsx (the customer "/" route),
 * so /admin and /rider are never affected — they don't mount this at all.
 *
 * Session memory: sessionStorage means returning within the same tab skips
 * the landing; closing the tab shows it again on the next visit.
 */

import { useEffect, useState } from 'react';

const DESKTOP_MIN = 1024;
const ENTERED_KEY = 'bt_entered_app';

export function useDesktopLanding() {
  // start false to match server render (avoids hydration flash); decide on mount
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    const decide = () => {
      let entered = false;
      try { entered = sessionStorage.getItem(ENTERED_KEY) === '1'; } catch {}
      const isDesktop = window.innerWidth >= DESKTOP_MIN;
      setShowLanding(isDesktop && !entered);
    };
    decide();
    window.addEventListener('resize', decide);
    return () => window.removeEventListener('resize', decide);
  }, []);

  const enterApp = () => {
    try { sessionStorage.setItem(ENTERED_KEY, '1'); } catch {}
    setShowLanding(false);
  };

  return { showLanding, enterApp };
}
