'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCart } from '../providers/CartProvider';

const TABS = [
  { href: '/', icon: '🏠', label: 'Home', match: (p: string) => p === '/' },
  { href: '/menu', icon: '🍽️', label: 'Menu', match: (p: string) => p.startsWith('/menu') || p.startsWith('/product') },
  { href: '/cart', icon: '🛒', label: 'Cart', match: (p: string) => p.startsWith('/cart') },
  { href: '/orders', icon: '📋', label: 'Orders', match: (p: string) => p.startsWith('/orders') },
];

export default function BottomNav() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { count } = useCart();

  function openSpecial() {
    if (pathname === '/') {
      window.dispatchEvent(new Event('bt:open-special'));
    } else {
      router.push('/');
      setTimeout(() => window.dispatchEvent(new Event('bt:open-special')), 350);
    }
  }

  return (
    <nav className="bt-nav">
      {TABS.map((t) => {
        const on = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`bt-nav-i ${on ? 'on' : ''}`}
          >
            <span className="bt-nav-ic">
              {t.icon}
              {t.href === '/cart' && count > 0 && (
                <em className="bt-nav-badge">{count}</em>
              )}
            </span>
            <span>{t.label}</span>
          </Link>
        );
      })}

      {/* Zomato-style floating circle, docked at the right of the pill */}
      <button
        type="button"
        className="bt-special-fab"
        onClick={openSpecial}
        aria-label="Today's Special"
      >
        <span className="bt-special-fab-ic">⚡</span>
        <span className="bt-special-fab-lbl">Special</span>
      </button>
    </nav>
  );
}
