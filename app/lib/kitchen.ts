'use client';

/**
 * Which kitchen is this screen? Bhawarkua staff should see (and hear) only
 * the takeaway orders being collected at Bhawarkua; the Vijay Nagar cloud
 * kitchen sees every delivery order plus its own takeaways. Chosen once per
 * device on Live Orders and remembered.
 */
import type { PublicOutlet } from './bite';

export const KITCHEN_KEY = 'bt_kitchen_outlet';
export type KitchenFilter = 'all' | number;

export function readKitchen(): KitchenFilter {
  if (typeof window === 'undefined') return 'all';
  try {
    const v = Number(localStorage.getItem(KITCHEN_KEY));
    return v > 0 ? v : 'all';
  } catch { return 'all'; }
}

export function saveKitchen(v: KitchenFilter) {
  try { localStorage.setItem(KITCHEN_KEY, String(v === 'all' ? '' : v)); } catch { /* private mode */ }
}

type OrderLike = {
  fulfillment?: string | null;
  pickupOutletId?: number | string | null;
  pickup_outlet_id?: number | string | null;
};

export const isPickupOrder = (o: OrderLike) => o.fulfillment === 'pickup';

/** Does this order belong on this kitchen's screen? */
export function forKitchen(o: OrderLike, k: KitchenFilter, outlets: Pick<PublicOutlet, 'id' | 'cooksDelivery'>[]): boolean {
  if (k === 'all') return true;
  if (isPickupOrder(o)) return Number(o.pickupOutletId ?? o.pickup_outlet_id) === k;
  return !!outlets.find((x) => x.id === k)?.cooksDelivery;
}
