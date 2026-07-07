/**
 * Bite Theory — shared library
 * Types, theme tokens, API helpers, and small utilities used by every page.
 */

/* ───────────── config ───────────── */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001/api';
export const AVATAR_FULL = `${API_BASE}/uploads/theory-bhaiya-avatar.png`;
export const AVATAR_FACE = `${API_BASE}/uploads/theory-bhaiya-face.png`;

/* ───────────── theme ───────────── */
export const C = {
  green: '#4CAF50',
  greenDeep: '#2e7d32',
  dark: '#0D3B2E',
  darkSoft: '#13503c',
  orange: '#F59E0B',
  orangeDeep: '#b76e00',
  ink: '#0D3B2E',
  muted: '#6b7d74',
  line: '#e4ebe6',
  bg: '#f4f6f3',
  greenSoft: '#e8f5e9',
  orangeSoft: '#fef3e2',
};

/* ───────────── utils ───────────── */
export const money = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

export function imgUrl(src: string) {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  return `${API_BASE}/uploads/${src.replace(/^\/+/, '')}`;
}

export function catEmoji(name: string): string {
  const n = (name || '').toLowerCase();
  if (/thali/.test(n)) return '🍛';
  if (/health|salad|diet/.test(n)) return '🥗';
  if (/protein|gym|muscle/.test(n)) return '💪';
  if (/break/.test(n)) return '🍳';
  if (/drink|bever|juice|shake/.test(n)) return '🥤';
  if (/snack|fast/.test(n)) return '🍔';
  if (/sweet|dessert/.test(n)) return '🍮';
  if (/roll|wrap/.test(n)) return '🌯';
  if (/pizza|pasta/.test(n)) return '🍕';
  return '🍽️';
}

/* ───────────── types ───────────── */
export interface Category {
  id: number;
  name: string;
  slug: string;
  image: string;
  emoji?: string;
}

export interface Product {
  id: number;
  categoryId: number;
  name: string;
  slug: string;
  description: string;
  image: string;
  price: number;
  offerPrice: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  rating: number;
  isTodaysSpecial: boolean;
  isVeg: boolean;
  specialTag: string;
}

export interface OrderItem {
  id: number;
  name: string;
  image: string;
  price: number;
  qty: number;
}

export interface Order {
  id: string;
  createdAt: number; // epoch ms
  items: OrderItem[];
  total: number;
  status: 'placed' | 'preparing' | 'on_the_way' | 'delivered';
}

/* ───────────── API ───────────── */
function normalizeProduct(p: any): Product {
  return {
    id: Number(p.id),
    categoryId: Number(p.categoryId ?? p.category_id),
    name: p.name || 'Item',
    slug: p.slug || '',
    description: p.description || '',
    image: p.image || '',
    price: Number(p.price) || 0,
    offerPrice: Number(p.offerPrice ?? p.offer_price) || 0,
    calories: Number(p.calories) || 0,
    protein: Number(p.protein) || 0,
    carbs: Number(p.carbs) || 0,
    fat: Number(p.fat) || 0,
    rating: Number(p.rating) || 0,
    isTodaysSpecial: Boolean(p.isTodaysSpecial ?? p.is_todays_special),
    isVeg: p.isVeg === undefined && p.is_veg === undefined ? true : Boolean(p.isVeg ?? p.is_veg),
    specialTag: p.specialTag || p.special_tag || '',
  };
}

function normalizeCategory(c: any): Category {
  return {
    id: Number(c.id),
    name: c.name || 'Category',
    slug: c.slug || '',
    image: c.image || '',
    emoji: catEmoji(c.name || ''),
  };
}

export async function fetchCatalog(): Promise<{
  products: Product[];
  categories: Category[];
}> {
  const [pRes, cRes] = await Promise.all([
    fetch(`${API_BASE}/products`),
    fetch(`${API_BASE}/categories`),
  ]);
  if (!pRes.ok || !cRes.ok) throw new Error('load failed');
  const pRows = await pRes.json();
  const cRows = await cRes.json();
  return {
    products: (pRows as any[]).map(normalizeProduct),
    categories: (cRows as any[])
      .filter((c) => c.isActive === undefined || c.isActive || c.is_active)
      .map(normalizeCategory),
  };
}

/* price actually charged for a product (offer if valid, else base) */
export function effectivePrice(p: Product): number {
  return p.offerPrice > 0 && p.offerPrice < p.price ? p.offerPrice : p.price;
}
export function hasOffer(p: Product): boolean {
  return p.offerPrice > 0 && p.offerPrice < p.price;
}
export function offerPct(p: Product): number {
  return hasOffer(p) ? Math.round((1 - p.offerPrice / p.price) * 100) : 0;
}


/* ───────────── API orders (backend-driven, Swiggy-style) ───────────── */
export type ApiOrderStatus =
  | 'order_received' | 'order_confirmed' | 'preparing_food' | 'food_ready'
  | 'assigned_to_delivery' | 'out_for_delivery' | 'arriving_soon'
  | 'delivered' | 'cancelled';

export const STATUS_META: Record<ApiOrderStatus, { label: string; emoji: string; step: number }> = {
  order_received:       { label: 'Order received',   emoji: '🧾', step: 0 },
  order_confirmed:      { label: 'Confirmed',        emoji: '✅', step: 1 },
  preparing_food:       { label: 'Preparing food',   emoji: '👨\u200d🍳', step: 2 },
  food_ready:           { label: 'Food ready',       emoji: '🍱', step: 3 },
  assigned_to_delivery: { label: 'Rider assigned',   emoji: '🛵', step: 4 },
  out_for_delivery:     { label: 'Out for delivery', emoji: '🛣️', step: 5 },
  arriving_soon:        { label: 'Arriving soon',    emoji: '📍', step: 6 },
  delivered:            { label: 'Delivered',        emoji: '🎉', step: 7 },
  cancelled:            { label: 'Cancelled',        emoji: '❌', step: -1 },
};
export const TRACK_STEPS: ApiOrderStatus[] = [
  'order_received', 'order_confirmed', 'preparing_food', 'food_ready',
  'assigned_to_delivery', 'out_for_delivery', 'arriving_soon', 'delivered',
];

export interface ApiOrderItem {
  id: number; productId: number; productName: string;
  unitPrice: number; quantity: number; lineTotal: number;
}
export interface ApiOrder {
  id: number; orderNumber: string; userId: number;
  subtotal: number; discount: number; deliveryCharge: number;
  walletUsed: number; total: number;
  status: ApiOrderStatus;
  placedAt: string;
  deliveryAddress?: string | null;
  deliveryLat?: number | null; deliveryLng?: number | null;
  etaMinutes?: number | null;
  items?: ApiOrderItem[];
  history?: { status: string; note?: string; createdAt: string }[];
  partner?: {
    id: number; name: string; mobile: string; vehicleNo?: string;
    photo?: string; lat?: number | null; lng?: number | null;
  } | null;
}

export interface SavedAddress {
  id: number; userId: number; label?: string; fullAddress: string;
  landmark?: string; pincode?: string; city?: string; state?: string;
  isDefault?: boolean; latitude?: number | null; longitude?: number | null;
}

async function jsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message?.toString?.() || data?.message || 'Request failed');
  return data;
}

export async function fetchMyOrders(userId: number): Promise<ApiOrder[]> {
  const res = await fetch(`${API_BASE}/orders?userId=${userId}`, { cache: 'no-store' });
  return jsonOrThrow(res);
}
export async function fetchOrderTrack(orderId: number | string): Promise<ApiOrder> {
  const res = await fetch(`${API_BASE}/orders/${orderId}/track`, { cache: 'no-store' });
  return jsonOrThrow(res);
}
export async function fetchAddresses(userId: number): Promise<SavedAddress[]> {
  const res = await fetch(`${API_BASE}/addresses?userId=${userId}`, { cache: 'no-store' });
  return jsonOrThrow(res);
}
export async function createAddress(a: Partial<SavedAddress>): Promise<SavedAddress> {
  const res = await fetch(`${API_BASE}/addresses`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a),
  });
  return jsonOrThrow(res);
}
export async function validateCoupon(code: string, subtotal: number):
  Promise<{ valid: boolean; discount: number; message: string; couponId: number | null }> {
  const res = await fetch(`${API_BASE}/coupons/validate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, subtotal }),
  });
  return res.json();
}
export interface CheckoutPayload {
  userId: number;
  items: { productId: number; quantity: number }[];
  addressId?: number;
  deliveryAddress?: string; deliveryLat?: number; deliveryLng?: number;
  couponCode?: string; useWallet?: boolean;
  paymentMethod?: 'cod' | 'online';
}
export async function checkoutOrder(payload: CheckoutPayload): Promise<ApiOrder & { pointsEarned?: number }> {
  const res = await fetch(`${API_BASE}/orders/checkout`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}


/* ───────────── banners ───────────── */
export interface Banner {
  id: number; title: string; imageUrl: string; linkUrl: string;
  position: string; sortOrder: number;
}
export async function fetchBanners(): Promise<Banner[]> {
  try {
    const res = await fetch(`${API_BASE}/banners`, { cache: 'no-store' });
    if (!res.ok) return [];
    const rows = await res.json();
    return (rows as any[])
      .filter((b) => b.isActive ?? b.is_active ?? true)
      .map((b) => ({
        id: Number(b.id), title: b.title || '',
        imageUrl: b.imageUrl || b.image_url || '',
        linkUrl: b.linkUrl || b.link_url || '',
        position: b.position || 'hero',
        sortOrder: Number(b.sortOrder ?? b.sort_order) || 0,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  } catch { return []; }
}
