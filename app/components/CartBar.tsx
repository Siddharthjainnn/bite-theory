'use client';

import { useRouter } from 'next/navigation';
import { useCatalog } from '../lib/useCatalog';
import { useCart } from '../providers/CartProvider';
import { money } from '../lib/bite';

/** Sticky cart summary bar; only renders when the cart has items. */
export default function CartBar() {
  const { products } = useCatalog();
  const { count, totalFor } = useCart();
  const router = useRouter();

  if (count === 0) return null;
  const total = totalFor(products);

  return (
    <div className="bt-cartbar">
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
