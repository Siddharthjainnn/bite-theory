'use client';

/**
 * Today's Special — now a popup (not an inline feed section, which was pushing
 * the real menu down and reading as distracting). Opened from the bottom-nav
 * "Special" tab via the 'bt:open-special' window event; the home page owns the
 * data and renders this. Same card design as before, in a bottom sheet.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { Product, money, effectivePrice, hasOffer } from '../lib/bite';
import { useCart } from '../providers/CartProvider';

export default function TodaysSpecialModal({
  open,
  onClose,
  specials,
}: {
  open: boolean;
  onClose: () => void;
  specials: Product[];
}) {
  const { cart, add, sub } = useCart();

  // lock body scroll + close on Escape while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="tsm-scrim" onClick={onClose} role="dialog" aria-modal="true" aria-label="Today's Special">
      <div className="tsm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tsm-grab" aria-hidden />
        <div className="tsm-head">
          <span className="tsm-title">
            <span className="zap">⚡</span> Today&apos;s Special
          </span>
          <span className="tsm-limited">LIMITED TIME</span>
          <button className="tsm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {specials.length === 0 ? (
          <div className="tsm-empty">No specials right now — check back soon!</div>
        ) : (
          <div className="tsm-grid">
            {specials.map((p) => (
              <div key={p.id} className="bt-sp-card">
                <Link href={`/product/${p.id}`} onClick={onClose} className="bt-sp-img" style={{ display: 'block' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.image ? <img src={p.image} alt={p.name} /> : <div className="food-emoji">🍛</div>}
                  <span className="bt-sp-tag">{p.specialTag || "TODAY'S SPECIAL"}</span>
                </Link>
                <div className="bt-sp-body">
                  <div className="bt-sp-name">{p.name}</div>
                  <div className="bt-sp-price">
                    <b>{money(effectivePrice(p))}</b>
                    {hasOffer(p) && <s>{money(p.price)}</s>}
                  </div>
                  {(cart[p.id] || 0) > 0 ? (
                    <div className="bt-qty bt-sp-qty">
                      <button onClick={() => sub(p.id)} aria-label={`Remove one ${p.name}`}>−</button>
                      <span>{cart[p.id]}</span>
                      <button onClick={() => add(p.id)} aria-label={`Add one ${p.name}`}>+</button>
                    </div>
                  ) : (
                    <button className="bt-sp-add" onClick={() => add(p.id)}>ADD +</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
