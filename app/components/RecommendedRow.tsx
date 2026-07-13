'use client';

/**
 * "Recommended for you" — a horizontal row of wide photo cards (Swiggy pattern,
 * Bite Theory brand). Each card: full-bleed food photo, discount ribbon (real
 * offer %), rating badge, name, price, and an add/qty control.
 *
 * Honest signals only: we show the real rating and real offer %. There's no
 * prep-time field in the data, so we don't invent minutes — a "Bestseller"
 * pill (top-rated) stands in, which is true to the sort.
 */

import Link from 'next/link';
import {
  Product, money, catEmoji, effectivePrice, hasOffer, offerPct,
} from '../lib/bite';
import { useCart } from '../providers/CartProvider';
import FoodImage from './FoodImage';

export default function RecommendedRow({ products }: { products: Product[] }) {
  const { cart, add, sub } = useCart();
  if (!products.length) return null;

  return (
    <section className="rec-wrap">
      <div className="rec-head">
        <h2 className="rec-title">Recommended for you</h2>
        <span className="rec-sub">Top-rated, freshly made</span>
      </div>

      <div className="rec-row">
        {products.map((p, i) => {
          const qty = cart[p.id] || 0;
          const soldOut = p.stockStatus === 'out_of_stock';
          const off = hasOffer(p);
          return (
            <div className="rec-card" key={p.id}>
              <Link href={`/product/${p.id}`} className="rec-img">
                <FoodImage src={p.image} alt={p.name} emoji={catEmoji(p.name)} />
                {off && <span className="rec-ribbon">{offerPct(p)}% OFF</span>}
                {i === 0 && !off && <span className="rec-ribbon rec-ribbon--gold">Bestseller</span>}
                {p.rating > 0 && (
                  <span className="rec-rating">★ {p.rating.toFixed(1)}</span>
                )}
                <span className="veg-dot sm" aria-label="Pure veg"><i /></span>
              </Link>

              <div className="rec-body">
                <Link href={`/product/${p.id}`} className="rec-name">{p.name}</Link>
                <div className="rec-foot">
                  <div className="rec-price">
                    <b>{money(effectivePrice(p))}</b>
                    {off && <s>{money(p.price)}</s>}
                  </div>
                  {soldOut ? (
                    <span className="rec-sold">Sold out</span>
                  ) : qty > 0 ? (
                    <div className="bt-qty rec-qty">
                      <button onClick={() => sub(p.id)} aria-label={`Remove one ${p.name}`}>−</button>
                      <span>{qty}</span>
                      <button onClick={() => add(p.id)} aria-label={`Add one ${p.name}`}>+</button>
                    </div>
                  ) : (
                    <button className="rec-add" onClick={() => add(p.id)}>ADD</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
