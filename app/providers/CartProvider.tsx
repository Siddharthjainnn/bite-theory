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

interface CartCtx {
  /* cart */
  cart: CartMap;
  add: (id: number) => void;
  sub: (id: number) => void;
  remove: (id: number) => void;
  setQty: (id: number, qty: number) => void;
  clear: () => void;
  count: number;
  /* derive totals against a product list */
  totalFor: (products: Product[]) => number;
  /* recently viewed */
  recent: number[];
  markViewed: (id: number) => void;
}

const Ctx = createContext<CartCtx | null>(null);

const LS_CART = 'bt_cart_v1';
const LS_RECENT = 'bt_recent_v1';

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
  const [recent, setRecent] = useState<number[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // hydrate once on mount (client only)
  useEffect(() => {
    setCart(load<CartMap>(LS_CART, {}));
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

  const clear = () => setCart({});

  const count = useMemo(
    () => Object.values(cart).reduce((a, b) => a + b, 0),
    [cart],
  );

  const totalFor = (products: Product[]) =>
    Object.entries(cart).reduce((sum, [id, qty]) => {
      const p = products.find((x) => x.id === Number(id));
      return sum + (p ? effectivePrice(p) * qty : 0);
    }, 0);

  const markViewed = (id: number) =>
    setRecent((r) => [id, ...r.filter((x) => x !== id)].slice(0, 12));

  const value: CartCtx = {
    cart,
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
