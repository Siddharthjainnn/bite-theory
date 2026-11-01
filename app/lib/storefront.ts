'use client';

/**
 * Storefront — everything on the home page that is not a dish, read from
 * Admin → Home page (store settings → storefrontConfig), plus the pure helpers
 * the home page uses to lay the menu out and compare app prices.
 */

import { useEffect, useState } from 'react';
import { API_BASE, Category, Product, effectivePrice } from './bite';

export type PlatformKey = 'zomato' | 'swiggy' | 'toing';

export interface LaunchConfig {
  enabled: boolean;
  badge: string;
  lead: string;
  area: string;
  city: string;
  opensAt: string;
  showCountdown: boolean;
  buttonText: string;
  smallPrint: string;
  openBadge: string;
  openLead: string;
  mapsUrl: string;
  autoNotify: boolean;
}
export interface PlatformTile {
  key: PlatformKey;
  name: string;
  url: string;
  enabled: boolean;
}
/** the restaurant's real Zomato rating, entered by the owner; shown labelled "on Zomato" */
export interface ZomatoRating {
  enabled: boolean;
  value: number;
  count: number;
}
export interface StorefrontConfig {
  launch: LaunchConfig;
  priceCompare: boolean;
  platforms: PlatformTile[];
  zomatoRating?: ZomatoRating;
}

/** name = how we refer to it; mark = the wordmark-style label on the tile */
export const PLATFORM_LOOK: Record<PlatformKey, { name: string; mark: string; color: string; italic?: boolean }> = {
  zomato: { name: 'Zomato', mark: 'zomato', color: '#E23744', italic: true },
  swiggy: { name: 'Swiggy', mark: 'Swiggy', color: '#FC8019' },
  toing: { name: 'Toing', mark: 'Toing', color: '#E0246F' },
};

/** Used only until /settings answers (and if it never does): launch off, nothing to compare. */
export const FALLBACK_STOREFRONT: StorefrontConfig = {
  launch: {
    enabled: false, badge: '', lead: '', area: '', city: '', opensAt: '', showCountdown: false,
    buttonText: '', smallPrint: '', openBadge: '', openLead: '', mapsUrl: '', autoNotify: false,
  },
  priceCompare: false,
  platforms: [],
};

export interface StorefrontState {
  storefront: StorefrontConfig;
  freeDeliveryAbove: number;
  loaded: boolean;
}

/* one request per page load, shared by every component that asks */
let pending: Promise<StorefrontState> | null = null;
function load(): Promise<StorefrontState> {
  if (!pending) {
    pending = fetch(`${API_BASE}/settings`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((s: { storefrontConfig?: Partial<StorefrontConfig>; freeDeliveryAbove?: unknown }) => ({
        storefront: { ...FALLBACK_STOREFRONT, ...(s?.storefrontConfig || {}) },
        freeDeliveryAbove: Number(s?.freeDeliveryAbove) || 0,
        loaded: true,
      }))
      .catch(() => {
        pending = null; // let the next mount retry
        return { storefront: FALLBACK_STOREFRONT, freeDeliveryAbove: 0, loaded: true };
      });
  }
  return pending;
}

export function useStorefront(): StorefrontState {
  const [state, setState] = useState<StorefrontState>({
    storefront: FALLBACK_STOREFRONT,
    freeDeliveryAbove: 0,
    loaded: false,
  });
  useEffect(() => {
    let alive = true;
    load().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/* ───────────── price comparison ───────────── */

export interface AppPrice {
  key: PlatformKey;
  name: string;
  price: number;
}
export interface PriceComparison {
  apps: AppPrice[]; // in the owner's tile order (Zomato first by default)
  ours: number;
  saveUpTo: number; // highest app price minus ours; 0 when we're not cheaper
}

/**
 * The comparison row for one dish, or null when there is nothing honest to show:
 * comparison switched off, no app price entered, or no app is dearer than us.
 */
export function compareFor(p: Product, cfg: StorefrontConfig): PriceComparison | null {
  if (!cfg.priceCompare) return null;
  const ours = effectivePrice(p);
  const byKey: Record<PlatformKey, number | null | undefined> = {
    zomato: p.zomatoPrice,
    swiggy: p.swiggyPrice,
    toing: p.toingPrice,
  };
  const order: PlatformKey[] = cfg.platforms.length
    ? cfg.platforms.map((t) => t.key)
    : ['zomato', 'swiggy', 'toing'];
  const apps: AppPrice[] = [];
  for (const key of order) {
    const price = Number(byKey[key]);
    if (price > 0) apps.push({ key, name: PLATFORM_LOOK[key].name, price });
  }
  if (!apps.length) return null;
  const saveUpTo = Math.max(...apps.map((a) => a.price)) - ours;
  if (saveUpTo <= 0) return null;
  return { apps, ours, saveUpTo: Math.round(saveUpTo) };
}

/* ───────────── menu layout ───────────── */

export interface MenuSection {
  category: Category;
  featured: boolean;
  items: Product[];
}

/**
 * Featured categories first (Thali, Combos …), then the rest of the menu, each
 * in the admin's category order; dishes in their own sort order. Empty
 * categories are left out. Dishes whose category is unknown go last as "More".
 */
export function menuSections(products: Product[], categories: Category[], q = ''): MenuSection[] {
  const t = q.trim().toLowerCase();
  const list = t
    ? products.filter((p) => p.name.toLowerCase().includes(t) || (p.description || '').toLowerCase().includes(t))
    : products;
  const byCat = new Map<number, Product[]>();
  for (const p of list) {
    const arr = byCat.get(p.categoryId) || [];
    arr.push(p);
    byCat.set(p.categoryId, arr);
  }
  const cats = [...categories].sort(
    (a, b) =>
      Number(!!b.featured) - Number(!!a.featured) ||
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
      a.name.localeCompare(b.name),
  );
  const sortItems = (arr: Product[]) =>
    [...arr].sort((a, b) => {
      const aOut = a.stockStatus === 'out_of_stock' ? 1 : 0;
      const bOut = b.stockStatus === 'out_of_stock' ? 1 : 0;
      return aOut - bOut || (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);
    });
  const out: MenuSection[] = [];
  const seen = new Set<number>();
  for (const c of cats) {
    const items = byCat.get(c.id);
    seen.add(c.id);
    if (items?.length) out.push({ category: c, featured: !!c.featured, items: sortItems(items) });
  }
  const orphans = list.filter((p) => !seen.has(p.categoryId));
  if (orphans.length) {
    out.push({
      category: { id: -1, name: 'More', slug: 'more', image: '' },
      featured: false,
      items: sortItems(orphans),
    });
  }
  return out;
}

/** time left until an instant, split for a countdown; null once it has passed */
export function timeLeft(iso: string, now: number) {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return null;
  const s = Math.floor((at - now) / 1000);
  if (s <= 0) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    days: pad(Math.floor(s / 86400)),
    hrs: pad(Math.floor((s % 86400) / 3600)),
    min: pad(Math.floor((s % 3600) / 60)),
    sec: pad(s % 60),
  };
}

/** "21 November" in India time */
export function openingDay(iso: string): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return '';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }).format(at);
}
