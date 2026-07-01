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
