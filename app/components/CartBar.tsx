'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCatalog } from '../lib/useCatalog';
import { useCart } from '../providers/CartProvider';
import { money } from '../lib/bite';

/**
 * Sticky cart summary bar; only renders when the cart has items.
 * Dismissible (✕) so it stops covering content — and it re-appears
 * automatically the next time the cart count changes (new item added).
 */
export default function CartBar() {
  const { products } = useCatalog();
  const { count, totalFor } = useCart();
  const router = useRouter();
  const [hidden, setHidden] = useState(false);

  // any change in item count brings the bar back
  useEffect(() => { setHidden(false); }, [count]);

  if (count === 0 || hidden) return null;
  const total = totalFor(products);

  return (
    <div className="bt-cartbar">
      <button
        className="bt-cartbar-x"
        onClick={() => setHidden(true)}
        aria-label="Hide cart bar"
      >
        ✕
      </button>
      <div>
        <div className="bt-cartbar-c">
          {count} item{count > 1 ? 's' : ''}
        </div>
        <div className="bt-cartbar-t">{money(total)}</div>
      </div>
      <button className="bt-cartbar-btn" onClick={() => router.push('/cart')}>
        View Cart →
      </button>
    </div>
  );
}
