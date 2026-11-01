'use client';

/**
 * ProductCard — one dish, the way the storefront shows it everywhere
 * (home sections, /menu, "more like this"):
 *
 *   [veg · tag]                         [photo]
 *   Name                                 [ADD]
 *   ★ rating · description · kcal/protein
 *   [ Zomato | Swiggy | Toing | Order here ]   ← only when app prices are set
 *   ✓ You save up to ₹X by ordering here
 *
 * Dishes without a photo show as a clean text row with ADD on the right
 * (the way the big apps list them), never a broken image.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Product, money, effectivePrice, hasOffer, imgUrl } from '../lib/bite';
import { compareFor, useStorefront } from '../lib/storefront';
import { useCart } from '../providers/CartProvider';
import PriceCompare from './PriceCompare';

export default function ProductCard({ p }: { p: Product }) {
  const { cart, add, sub } = useCart();
  const { storefront } = useStorefront();
  const [imgFailed, setImgFailed] = useState(false);
  const qty = cart[p.id] || 0;
  const off = hasOffer(p);
  const soldOut = p.stockStatus === 'out_of_stock';
  const lowStock = p.stockStatus === 'low_stock' || p.stockStatus === 'low';
  const cmp = soldOut ? null : compareFor(p, storefront);
  const showImg = !!p.image && !imgFailed;

  const action = soldOut ? (
    <span className="sf-sold">Sold out</span>
  ) : qty > 0 ? (
    <div className="sf-qty">
      <button type="button" onClick={() => sub(p.id)} aria-label={`Remove one ${p.name}`}>−</button>
      <span aria-live="polite">{qty}</span>
      <button type="button" onClick={() => add(p.id, p.stockQty)} aria-label={`Add one more ${p.name}`}>+</button>
    </div>
  ) : (
    <button type="button" className="sf-add" onClick={() => add(p.id, p.stockQty)} aria-label={`Add ${p.name} to cart`}>
      ADD
    </button>
  );

  return (
    <article className={`sf-dish ${soldOut ? 'out' : ''}`}>
      <div className="sf-dish-row">
        <div className="sf-dish-info">
          <div className="sf-tagrow">
            {p.isVeg !== false && (
              <span className="sf-veg" role="img" aria-label="Veg"><i /></span>
            )}
            {p.specialTag && <span className="sf-tag">{p.specialTag}</span>}
            {off && <span className="sf-tag">{Math.round((1 - p.offerPrice / p.price) * 100)}% off</span>}
            {lowStock && !soldOut && <span className="sf-tag red">Only a few left</span>}
          </div>
          <h3 className="sf-dish-name">
            <Link href={`/product/${p.id}`}>{p.name}</Link>
          </h3>
          {p.rating > 0 && (
            <div className="sf-rating">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#1F7A3A" aria-hidden="true">
                <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
              </svg>
              {p.rating.toFixed(1)}
            </div>
          )}
          {p.description && <p className="sf-desc">{p.description}</p>}
          {(p.calories > 0 || p.protein > 0) && (
            <span className="sf-macros">
              {[p.calories > 0 ? `${p.calories} kcal` : '', p.protein > 0 ? `${p.protein}g protein` : '']
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
          {!cmp && (
            <div className="sf-price">
              {money(effectivePrice(p))}
              {off && <s>{money(p.price)}</s>}
            </div>
          )}
        </div>
        <div className={`sf-media ${showImg ? '' : 'noimg'}`}>
          {showImg && (
            <Link href={`/product/${p.id}`} className="sf-img" aria-label={`View ${p.name}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl(p.image)} alt="" loading="lazy" onError={() => setImgFailed(true)} />
            </Link>
          )}
          <div className="sf-act">{action}</div>
        </div>
      </div>
      {cmp && <PriceCompare cmp={cmp} name={p.name} />}
    </article>
  );
}
