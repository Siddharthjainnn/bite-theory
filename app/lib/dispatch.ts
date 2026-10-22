/**
 * External courier dispatch (Porter) — shared client helpers.
 * Backend: GET /orders/:id/dispatch-sheet, PATCH /orders/:id/book-courier,
 *          PATCH /orders/:id/cancel-courier  (src/orders/courier.util.ts)
 */

/** Porter's two-wheeler booking page for the kitchen's city. Override per city
    with NEXT_PUBLIC_PORTER_BOOKING_URL when a second kitchen opens. */
export const PORTER_BOOKING_URL =
  process.env.NEXT_PUBLIC_PORTER_BOOKING_URL || 'https://porter.in/two-wheelers/indore';

export type DispatchSheetData = {
  orderNumber: string;
  status: string;
  provider: 'in_house' | 'porter' | 'other';
  pickup: { name: string; phone: string; address: string; latLng: string; mapsUrl: string | null };
  drop: {
    name: string; mobile: string; address: string; landmark: string; pincode: string;
    instructions: string; latLng: string; mapsUrl: string | null;
  };
  cod: { isCod: boolean; amountToCollect: number };
  warnings: string[];
  copyAll: string;
  booking: {
    externalRef: string | null; trackingUrl: string | null; riderName: string | null;
    riderPhone: string | null; fee: number | null; bookedAt: string | null;
  } | null;
};

export type BookCourierBody = {
  provider: 'porter' | 'other';
  externalRef?: string; trackingUrl?: string; riderName?: string;
  riderPhone?: string; fee?: number; codAcknowledged?: boolean;
};

/** The slice of the admin `api` object the dispatch UI needs. */
export type DispatchApi = {
  dispatchSheet: (orderId: number) => Promise<DispatchSheetData>;
  bookCourier: (orderId: number, body: BookCourierBody) => Promise<unknown>;
  cancelCourier: (orderId: number, reason?: string) => Promise<unknown>;
};

/* Indore localities, longest first so "Vijay Nagar Extension" is not matched
   as plain "Vijay Nagar", and so "Scheme No 78" beats "Scheme". Matched
   against the free-text delivery address, which is all Google gives us for
   orders placed before address autocomplete existed. */
const LOCALITIES = [
  'Vijay Nagar', 'Scheme No 78', 'Scheme No 114', 'Scheme 78', 'Scheme 114',
  'BRK Business Park', 'Bholaram Ustad Marg', 'Bhawarkuan', 'Bhawarkua',
  'Mangal City', 'Sudama Nagar', 'Bajrang Nagar', 'Girdhar Nagar', 'Nanda Nagar',
  'Old Palasia', 'New Palasia', 'Palasia', 'Sukhliya', 'Sukliya', 'Patnipura',
  'Kanadia', 'Kajrana', 'Nakshatra', 'Winway', 'Rajendra Nagar', 'Annapurna',
  'Rau', 'Mhow', 'Bengali Square', 'Khajrana', 'Silicon City', 'Nipania',
  'Tilak Nagar', 'Geeta Bhawan', 'Saket', 'LIG', 'MIG', 'AB Road',
  'Badi Gwaltoli', 'Chhoti Gwaltoli', 'Malharganj', 'Sarafa', 'Rajwada',
  'Manorama Ganj', 'Snehlataganj', 'Navlakha', 'Musakhedi', 'Pipliyahana',
  'Scheme No 54', 'Scheme No 71', 'Scheme No 140', 'Dewas Naka', 'Bapat Square',
].sort((a, b) => b.length - a.length);

/** Best-effort locality from a free-text address. */
export function localityOf(addr?: string | null): string | null {
  if (!addr) return null;
  const hay = addr.toLowerCase();
  for (const l of LOCALITIES) if (hay.includes(l.toLowerCase())) return l;
  return null;
}

export const isExternalProvider = (p?: string | null) => !!p && p !== 'in_house';

/**
 * Copy text, including on kitchen tablets where navigator.clipboard is absent
 * (plain-HTTP origins, older Android WebViews). Must be CALLED inside the click
 * handler — browsers only allow clipboard writes during a user gesture.
 */
export function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true, () => legacyCopy(text));
  }
  return Promise.resolve(legacyCopy(text));
}

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

/** Board + popup talk through this so an action in one refreshes the other now, not in 20s. */
export const ORDERS_CHANGED_EVENT = 'bt:orders-changed';
export const announceOrdersChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ORDERS_CHANGED_EVENT));
};
