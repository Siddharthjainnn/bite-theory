'use client';

/**
 * MenuProvider — mounts ONE ProfileDrawer for the whole app and exposes
 * openMenu() through context. AppHeader falls back to this context when a
 * page doesn't pass its own `onMenu`, so the hamburger works on EVERY page
 * (orders, cart, checkout, coupons, product, info, account/*) — previously
 * it was dead on all pages except home and menu.
 *
 * Mounted once in app/layout.tsx.
 */

import { createContext, useContext, useState, ReactNode } from 'react';
import ProfileDrawer from './ProfileDrawer';

const MenuContext = createContext<{ openMenu: () => void }>({ openMenu: () => {} });

export function useMenu() {
  return useContext(MenuContext);
}

export default function MenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <MenuContext.Provider value={{ openMenu: () => setOpen(true) }}>
      {children}
      <ProfileDrawer open={open} onClose={() => setOpen(false)} />
    </MenuContext.Provider>
  );
}
