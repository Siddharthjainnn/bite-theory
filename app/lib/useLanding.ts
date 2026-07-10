'use client';

/**
 * useLanding — fetches the admin-editable desktop landing content plus the
 * store's map coordinates/address, both from GET /settings (public route).
 * Falls back to sensible defaults so the page never renders blank.
 */

import { useEffect, useState } from 'react';
import { API_BASE } from './bite';

export interface LandingFeature { icon: string; title: string; subtitle: string }
export interface LandingContent {
  logoUrl: string; brandName: string; city: string;
  tagline1: string; tagline2: string; heroSubtitle: string; heroBadge: string;
  stat1Value: string; stat1Label: string;
  stat2Value: string; stat2Label: string;
  stat3Value: string; stat3Label: string;
  features: LandingFeature[];
  phone: string; hoursLine: string; mapEmbedUrl: string;
  ctaHeading: string; ctaSubtitle: string;
}
export interface StoreLocation {
  storeAddress: string | null;
  storeLat: number | null;
  storeLng: number | null;
  deliveryRadiusKm: number;
}

const DEFAULT_LANDING: LandingContent = {
  logoUrl: '',
  brandName: 'Bites Theory',
  city: 'Indore',
  tagline1: 'Smart Food.',
  tagline2: 'Better Living.',
  heroSubtitle:
    'Fresh, healthy, homestyle food made in Indore — served with that unmistakable Malwa warmth. From poha mornings to protein-packed thalis.',
  heroBadge: '100% PURE VEG · INDORE KA APNA',
  stat1Value: '4.8★', stat1Label: '1,200+ ratings',
  stat2Value: '25 min', stat2Label: 'avg delivery',
  stat3Value: '100%', stat3Label: 'pure veg',
  features: [
    { icon: '🏆', title: '#1 in Indore', subtitle: 'most-loved veg kitchen' },
    { icon: '🛵', title: 'Free Delivery', subtitle: 'within 5 km, over ₹199' },
    { icon: '🌱', title: 'Farm Fresh', subtitle: 'sourced daily, Malwa region' },
    { icon: '💚', title: '50k+ Orders', subtitle: 'served with love' },
  ],
  phone: '+91 90000 00000',
  hoursLine: 'Open 8:00 AM – 11:00 PM · all days',
  mapEmbedUrl: '',
  ctaHeading: 'Bhookh lagi? Order kar do 😋',
  ctaSubtitle: 'Fresh, hot and homestyle — delivered to your door in Indore.',
};

export function useLanding() {
  const [content, setContent] = useState<LandingContent>(DEFAULT_LANDING);
  const [location, setLocation] = useState<StoreLocation>({
    storeAddress: null, storeLat: null, storeLng: null, deliveryRadiusKm: 8,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/settings`, { cache: 'no-store' });
        if (!alive) return;
        if (res.ok) {
          const s = await res.json();
          if (s.landingContent) {
            setContent({ ...DEFAULT_LANDING, ...s.landingContent });
          }
          setLocation({
            storeAddress: s.storeAddress ?? null,
            storeLat: s.storeLat != null ? Number(s.storeLat) : null,
            storeLng: s.storeLng != null ? Number(s.storeLng) : null,
            deliveryRadiusKm: Number(s.deliveryRadiusKm ?? 8),
          });
        }
      } catch {
        /* keep defaults */
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  return { content, location, loaded };
}
