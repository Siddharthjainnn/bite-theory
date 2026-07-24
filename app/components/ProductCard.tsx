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
  const soldOut = p.stockStatus === 'out_of_stock';
  const lowStock = p.stockStatus === 'low_stock' || p.stockStatus === 'low';

  return (
    <div className="bt-card" style={soldOut ? { opacity: 0.55 } : undefined}>
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
          {lowStock && !soldOut && (
            <span className="tag orange" style={{ fontWeight: 800 }}>Only few left!</span>
          )}
        </div>
        <div className="bt-card-foot">
          <div className="bt-price">
            <b>{money(effectivePrice(p))}</b>
            {off && <s>{money(p.price)}</s>}
          </div>
          {soldOut ? (
            <span style={{ fontSize: 11, fontWeight: 800, color: '#c62828',
              background: '#fdecec', padding: '5px 10px', borderRadius: 20 }}>
              Sold out
            </span>
          ) : qty > 0 ? (
            <div className="bt-qty">
              <button onClick={() => sub(p.id)} aria-label="Remove one">
                −
              </button>
              <span>{qty}</span>
              <button onClick={() => add(p.id, soldOut ? 0 : p.stockQty)} aria-label="Add one">
                +
              </button>
            </div>
          ) : (
            <button className="bt-add" onClick={() => add(p.id, soldOut ? 0 : p.stockQty)}>
              ADD
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
