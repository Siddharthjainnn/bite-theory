'use client';
import { useEffect, useState } from 'react';
import { API_BASE } from './bite';

export interface FeaturedCoupon {
  code: string;
  label: string;   // e.g. "70% OFF up to ₹100" or "₹50 OFF"
}

/* Bug #46/#55: the home & cart pages used to hard-code "BITE70", a coupon that
   didn't exist in the DB — so it was advertised but failed on apply. This hook
   pulls the first REAL active coupon from GET /coupons and builds a label from
   its actual values, so we only ever promote coupons that genuinely work. If
   there are none, callers show nothing. */
export function useFeaturedCoupon(): FeaturedCoupon | null {
  const [coupon, setCoupon] = useState<FeaturedCoupon | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/coupons`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) => {
        if (!alive) return;
        const now = Date.now();
        const active = (data || []).filter((c) => {
          const isActive = (c.isActive ?? c.is_active) !== false;
          const until = c.validUntil ?? c.valid_until;
          const limit = Number(c.usageLimit ?? c.usage_limit ?? 0);
          const used = Number(c.usedCount ?? c.used_count ?? 0);
          const notExhausted = limit === 0 || used < limit;
          return isActive && notExhausted && (!until || new Date(until).getTime() > now);
        });
        if (!active.length) { setCoupon(null); return; }
        const c = active[0];
        const type = (c.discountType ?? c.discount_type ?? 'percentage').toLowerCase();
        const value = Number(c.discountValue ?? c.discount_value ?? 0);
        const maxD = Number(c.maxDiscount ?? c.max_discount ?? 0);
        const label = (type === 'flat' || type === 'fixed')
          ? `₹${value} OFF`
          : `${value}% OFF${maxD > 0 ? ` up to ₹${maxD}` : ''}`;
        setCoupon({ code: String(c.code || '').toUpperCase(), label });
      })
      .catch(() => { if (alive) setCoupon(null); });
    return () => { alive = false; };
  }, []);

  return coupon;
}
