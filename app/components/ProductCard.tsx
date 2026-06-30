'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Product, money, catEmoji, effectivePrice, hasOffer, offerPct } from '../lib/bite';
import { useCart } from '../providers/CartProvider';
import FoodImage from './FoodImage';

export default function ProductCard({ p }: { p: Product }) {
  const { cart, add, sub } = useCart();
  const router = useRouter();
  const qty = cart[p.id] || 0;
  const off = hasOffer(p);

  return (
    <div className="bt-card">
      <Link
        href={`/product/${p.id}`}
        className="bt-card-img"
        aria-label={`View ${p.name}`}
      >
        <FoodImage src={p.image} alt={p.name} emoji={catEmoji(p.name)} />
        <span className="veg-dot" aria-label="Pure veg">
          <i />
        </span>
        {off && <span className="bt-card-off">{offerPct(p)}% OFF</span>}
      </Link>
      <div className="bt-card-body">
        <Link href={`/product/${p.id}`} className="bt-card-name-link">
          <div className="bt-card-name">{p.name}</div>
        </Link>
        {p.description && <div className="bt-card-desc">{p.description}</div>}
        <div className="bt-card-tags">
          {p.calories > 0 && <span className="tag">{p.calories} cal</span>}
          {p.protein > 0 && (
            <span className="tag green">{p.protein}g protein</span>
          )}
          {p.rating > 0 && (
            <span className="tag orange">★ {p.rating.toFixed(1)}</span>
          )}
        </div>
        <div className="bt-card-foot">
          <div className="bt-price">
            <b>{money(effectivePrice(p))}</b>
            {off && <s>{money(p.price)}</s>}
          </div>
          {qty > 0 ? (
            <div className="bt-qty">
              <button onClick={() => sub(p.id)} aria-label="Remove one">
                −
              </button>
              <span>{qty}</span>
              <button onClick={() => add(p.id)} aria-label="Add one">
                +
              </button>
            </div>
          ) : (
            <button className="bt-add" onClick={() => add(p.id)}>
              ADD
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
