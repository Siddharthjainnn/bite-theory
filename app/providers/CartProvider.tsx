'use client';

/**
 * CartProvider — single source of truth for cart and recently-viewed (orders live in the backend).
 * Persisted to localStorage so it survives refresh and is shared across pages.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { Product, effectivePrice } from '../lib/bite';

type CartMap = Record<number, number>; // productId -> qty

/** A customized thali held in the cart (priced/validated server-side at checkout). */
export interface ThaliCartItem {
  key: string;                       // local unique key
  templateId: number;
  templateName: string;
  total: number;                     // display only — server recomputes
  selections: Record<string, string[]>;
  portions: { optionId: number; qty: number }[];
}

interface CartCtx {
  /* cart */
  cart: CartMap;
  add: (id: number) => void;
  sub: (id: number) => void;
  remove: (id: number) => void;
  setQty: (id: number, qty: number) => void;
  clear: () => void;
  count: number;
  /* customized thalis */
  thalis: ThaliCartItem[];
  addThali: (t: Omit<ThaliCartItem, 'key'>) => void;
  removeThali: (key: string) => void;
  /* derive totals against a product list (includes thalis) */
  totalFor: (products: Product[]) => number;
  /* recently viewed */
  recent: number[];
  markViewed: (id: number) => void;
}

const Ctx = createContext<CartCtx | null>(null);

const LS_CART = 'bt_cart_v1';
const LS_RECENT = 'bt_recent_v1';
const LS_THALI = 'bt_thali_v1';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartMap>({});
  const [thalis, setThalis] = useState<ThaliCartItem[]>([]);
  const [recent, setRecent] = useState<number[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // hydrate once on mount (client only)
  useEffect(() => {
    setCart(load<CartMap>(LS_CART, {}));
    setThalis(load<ThaliCartItem[]>(LS_THALI, []));
    setRecent(load<number[]>(LS_RECENT, []));
    setHydrated(true);
  }, []);

  // persist after hydration
  useEffect(() => {
    if (hydrated) save(LS_CART, cart);
  }, [cart, hydrated]);
  useEffect(() => {
    if (hydrated) save(LS_RECENT, recent);
  }, [recent, hydrated]);
  useEffect(() => {
    if (hydrated) save(LS_THALI, thalis);
  }, [thalis, hydrated]);

  const add = (id: number) =>
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));

  const sub = (id: number) =>
    setCart((c) => {
      const n = { ...c };
      if ((n[id] || 0) > 1) n[id] -= 1;
      else delete n[id];
      return n;
    });

  const remove = (id: number) =>
    setCart((c) => {
      const n = { ...c };
      delete n[id];
      return n;
    });

  const setQty = (id: number, qty: number) =>
    setCart((c) => {
      const n = { ...c };
      if (qty <= 0) delete n[id];
      else n[id] = qty;
      return n;
    });

  const addThali = (t: Omit<ThaliCartItem, 'key'>) =>
    setThalis((arr) => [
      ...arr,
      { ...t, key: `th_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}` },
    ]);

  const removeThali = (key: string) =>
    setThalis((arr) => arr.filter((t) => t.key !== key));

  // clearing the cart clears thalis too (post-order semantics)
  const clear = () => { setCart({}); setThalis([]); };

  const count = useMemo(
    () => Object.values(cart).reduce((a, b) => a + b, 0) + thalis.length,
    [cart, thalis],
  );

  const totalFor = (products: Product[]) =>
    Object.entries(cart).reduce((sum, [id, qty]) => {
      const p = products.find((x) => x.id === Number(id));
      return sum + (p ? effectivePrice(p) * qty : 0);
    }, 0) + thalis.reduce((s, t) => s + t.total, 0);

  const markViewed = (id: number) =>
    setRecent((r) => [id, ...r.filter((x) => x !== id)].slice(0, 12));

  const value: CartCtx = {
    cart,
    thalis,
    addThali,
    removeThali,
    add,
    sub,
    remove,
    setQty,
    clear,
    count,
    totalFor,
    recent,
    markViewed,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
