'use client';

/**
 * useStoreSettings — one hook, two payloads:
 *  - settings: delivery charge, free-delivery threshold, min/max order
 *  - status:   is the kitchen open right now + friendly closed message
 *
 * Replaces every hardcoded DELIVERY_CHARGE / FREE_DELIVERY_ABOVE constant
 * in cart + checkout (which currently disagree with each other: cart says
 * ₹199, checkout says ₹500 — this hook makes both read the admin's value).
 */

import { useEffect, useState } from 'react';
import { API_BASE } from './bite';

export interface StoreSettings {
  deliveryCharge: number;
  freeDeliveryAbove: number;
  minOrderAmount: number;
  maxOrderAmount: number;
}
export interface StoreStatus {
  open: boolean;
  message: string;
  nextOpenAt: string | null;
  reason: 'open' | 'force_closed' | 'holiday' | 'outside_hours';
}

const DEFAULTS: StoreSettings = {
  deliveryCharge: 30, freeDeliveryAbove: 500, minOrderAmount: 0, maxOrderAmount: 0,
};

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULTS);
  const [status, setStatus] = useState<StoreStatus>({
    open: true, message: '', nextOpenAt: null, reason: 'open',
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [sRes, stRes] = await Promise.all([
          fetch(`${API_BASE}/settings`, { cache: 'no-store' }),
          fetch(`${API_BASE}/settings/status`, { cache: 'no-store' }),
        ]);
        if (!alive) return;
        if (sRes.ok) {
          const s = await sRes.json();
          setSettings({
            deliveryCharge: Number(s.deliveryCharge) || 0,
            freeDeliveryAbove: Number(s.freeDeliveryAbove) || 0,
            minOrderAmount: Number(s.minOrderAmount) || 0,
            maxOrderAmount: Number(s.maxOrderAmount) || 0,
          });
        }
        if (stRes.ok) setStatus(await stRes.json());
      } catch {
        /* fail open with defaults — never block ordering on a settings hiccup */
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  return { settings, status, loaded };
}
