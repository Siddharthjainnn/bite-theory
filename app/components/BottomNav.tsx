'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCart } from '../providers/CartProvider';

const TABS = [
  { href: '/', icon: '🏠', label: 'Home', match: (p: string) => p === '/' },
  { href: '/menu', icon: '🍽️', label: 'Menu', match: (p: string) => p.startsWith('/menu') || p.startsWith('/product') },
  { href: '__special', icon: '⚡', label: 'Special', match: () => false },
  { href: '/cart', icon: '🛒', label: 'Cart', match: (p: string) => p.startsWith('/cart') },
  { href: '/orders', icon: '📋', label: 'Orders', match: (p: string) => p.startsWith('/orders') },
];

export default function BottomNav() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { count } = useCart();

  function openSpecial() {
    // If we're on the home page, the popup listener is mounted → fire the event.
    // From any other page, go home first, then fire once it can be heard.
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

        if (t.href === '__special') {
          return (
            <button
              key="special"
              type="button"
              onClick={openSpecial}
              className="bt-nav-i bt-nav-special"
              aria-label="Today's Special"
            >
              <span className="bt-nav-ic">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        }

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
    </nav>
  );
}
