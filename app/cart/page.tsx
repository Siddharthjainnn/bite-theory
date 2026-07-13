'use client';

// session is per-user, so never statically pre-render this page
export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import AppShell from '../components/AppShell';
import AppHeader from '../components/AppHeader';
import FoodImage from '../components/FoodImage';
import { useCatalog } from '../lib/useCatalog';
import { useCart } from '../providers/CartProvider';
import { Product, money, catEmoji, effectivePrice, hasOffer, C } from '../lib/bite';
import { useStoreSettings } from '../lib/useStoreSettings';
import { useFeaturedCoupon } from '../lib/useFeaturedCoupon';
import StoreClosedBanner from '../components/StoreClosedBanner';

export default function CartPage() {
  const { products, loading } = useCatalog();
  const { cart, add, sub, remove, clear } = useCart();
  const featuredCoupon = useFeaturedCoupon();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [placing, setPlacing] = useState(false);
  const { settings, status: storeStatus } = useStoreSettings();

  const lines = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const p = products.find((x) => x.id === Number(id));
        return p ? { p, qty } : null;
      })
      .filter(Boolean) as { p: Product; qty: number }[];
  }, [cart, products]);

  const subtotal = lines.reduce((s, l) => s + effectivePrice(l.p) * l.qty, 0);
  const savings = lines.reduce(
    (s, l) => s + (hasOffer(l.p) ? (l.p.price - l.p.offerPrice) * l.qty : 0),
    0,
  );
  const freeDelivery = subtotal >= settings.freeDeliveryAbove || subtotal === 0;
  const delivery = freeDelivery ? 0 : settings.deliveryCharge;
  const total = subtotal + delivery;

  function checkout() {
    // must be logged in to place an order
    if (status !== 'authenticated') {
      router.push('/login?callbackUrl=/checkout');
      return;
    }
    // must have a phone number for delivery
    if (!(session?.user as any)?.profileComplete) {
      router.push('/complete-profile');
      return;
    }
    setPlacing(true);
    router.push('/checkout');
  }

  const empty = !loading && lines.length === 0;

  return (
    <AppShell
      header={<AppHeader variant="page" title="Your Cart" />}
      footerExtra={
        !empty && !loading ? (
          <div className="checkout-bar">
            <div className="checkout-total">
              <b>{money(total)}</b>
              <span>{lines.reduce((a, l) => a + l.qty, 0)} items</span>
            </div>
            <button
              className="checkout-btn"
              onClick={checkout}
              disabled={placing}
            >
              {placing
                ? 'Placing…'
                : status !== 'authenticated'
                  ? 'Login to Order →'
                  : 'Place Order →'}
            </button>
          </div>
        ) : null
      }
    >
      <div className="bt-page-pad">
        {!storeStatus.open && <StoreClosedBanner status={storeStatus} />}
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="cart-item">
              <div className="cart-item-img skel" />
              <div className="cart-item-info">
                <div className="skel-txt" style={{ width: '60%' }} />
                <div className="skel-txt" style={{ width: '35%' }} />
              </div>
            </div>
          ))
        ) : empty ? (
          <div className="bt-empty" style={{ marginTop: 24 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🛒</div>
            Aapka cart khaali hai.
            <div style={{ marginTop: 14 }}>
              <Link
                href="/menu"
                style={{
                  background: C.green,
                  color: '#fff',
                  padding: '10px 22px',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 13,
                  display: 'inline-block',
                }}
              >
                Browse Menu →
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="cart-listhead">
              <span>{lines.reduce((a, l) => a + l.qty, 0)} item(s) in cart</span>
              <button
                type="button"
                className="cart-clear"
                onClick={() => { if (confirm('Remove all items from your cart?')) clear(); }}
              >
                Clear cart
              </button>
            </div>

            {/* free-delivery progress — nudges basket size */}
            {settings.freeDeliveryAbove > 0 && (
              <div className={`cart-fd ${freeDelivery ? 'done' : ''}`}>
                <div className="cart-fd-top">
                  <span>
                    {freeDelivery
                      ? '🎉 You’ve unlocked free delivery!'
                      : `Add ${money(Math.max(0, settings.freeDeliveryAbove - subtotal))} more for FREE delivery`}
                  </span>
                  <span aria-hidden>🛵</span>
                </div>
                <div className="cart-fd-track">
                  <div
                    className="cart-fd-fill"
                    style={{ width: `${Math.min(100, Math.round((subtotal / settings.freeDeliveryAbove) * 100))}%` }}
                  />
                </div>
              </div>
            )}
            {lines.map(({ p, qty }) => (
              <div key={p.id} className="cart-item">
                <div className="cart-item-img">
                  <FoodImage
                    src={p.image}
                    alt={p.name}
                    emoji={catEmoji(p.name)}
                  />
                </div>
                <div className="cart-item-info">
                  <div className="cart-item-name">{p.name}</div>
                  <div className="cart-item-price">
                    <b>{money(effectivePrice(p))}</b>
                    {hasOffer(p) && (
                      <s style={{ color: '#9aa8a0', marginLeft: 6 }}>
                        {money(p.price)}
                      </s>
                    )}
                  </div>
                  <button
                    className="cart-remove"
                    onClick={() => remove(p.id)}
                  >
                    Remove
                  </button>
                </div>
                <div className="bt-qty">
                  <button onClick={() => sub(p.id)} aria-label="Remove one">
                    −
                  </button>
                  <span>{qty}</span>
                  <button onClick={() => add(p.id)} aria-label="Add one">
                    +
                  </button>
                </div>
              </div>
            ))}

            {featuredCoupon && (
              <div className="coupon">
                🎟️ Apply <b>{featuredCoupon.code}</b> for {featuredCoupon.label}
              </div>
            )}

            <div className="bill">
              <div className="bill-row">
                <span>Item total</span>
                <span>{money(subtotal)}</span>
              </div>
              {savings > 0 && (
                <div className="bill-row free">
                  <span>Offer savings</span>
                  <span>− {money(savings)}</span>
                </div>
              )}
              <div className={`bill-row ${freeDelivery ? 'free' : ''}`}>
                <span>Delivery fee</span>
                <span>{freeDelivery ? 'FREE' : money(delivery)}</span>
              </div>
              {!freeDelivery && (
                <div
                  className="bill-row"
                  style={{ fontSize: 11, color: C.muted }}
                >
                  <span>
                    Add {money(settings.freeDeliveryAbove - subtotal)} more for free
                    delivery
                  </span>
                </div>
              )}
              <hr className="bill-hr" />
              <div className="bill-total">
                <span>To pay</span>
                <span>{money(total)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
