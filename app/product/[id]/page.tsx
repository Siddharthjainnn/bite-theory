'use client';

import { use, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../components/AppShell';
import AppHeader from '../../components/AppHeader';
import FoodImage from '../../components/FoodImage';
import ProductCard from '../../components/ProductCard';
import CartBar from '../../components/CartBar';
import { useCatalog } from '../../lib/useCatalog';
import { useCart } from '../../providers/CartProvider';
import {
  Product,
  money,
  catEmoji,
  effectivePrice,
  hasOffer,
  offerPct,
  C,
} from '../../lib/bite';

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const pid = Number(id);
  const { products, loading } = useCatalog();
  const { cart, add, sub, markViewed } = useCart();
  const router = useRouter();

  const product = products.find((p) => p.id === pid);

  useEffect(() => {
    if (product) markViewed(product.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  // recommended = same category first, then fill with top-rated others
  const recommended = useMemo(() => {
    if (!product) return [];
    const sameCat = products
      .filter((p) => p.categoryId === product.categoryId && p.id !== product.id)
      .sort((a, b) => b.rating - a.rating);
    const others = products
      .filter((p) => p.categoryId !== product.categoryId && p.id !== product.id)
      .sort((a, b) => b.rating - a.rating);
    return [...sameCat, ...others].slice(0, 6);
  }, [product, products]);

  const qty = product ? cart[product.id] || 0 : 0;

  if (loading) {
    return (
      <AppShell header={<AppHeader variant="page" title="Loading…" />}>
        <div className="pd-hero skel" style={{ height: 300 }} />
        <div className="bt-page-pad">
          <div className="skel-txt" style={{ width: '60%', height: 22 }} />
          <div className="skel-txt" style={{ width: '90%' }} />
          <div className="skel-txt" style={{ width: '40%' }} />
        </div>
      </AppShell>
    );
  }

  if (!product) {
    return (
      <AppShell header={<AppHeader variant="page" title="Not found" />}>
        <div className="bt-empty" style={{ margin: 20 }}>
          Ye item nahi mila. Wapas menu dekhein.
        </div>
      </AppShell>
    );
  }

  const off = hasOffer(product);

  return (
    <AppShell
      header={<AppHeader variant="page" title={product.name} />}
      footerExtra={<CartBar />}
    >
      {/* hero */}
      <div className="pd-hero">
        <FoodImage
          src={product.image}
          alt={product.name}
          emoji={catEmoji(product.name)}
        />
        {off && <span className="pd-hero-off">{offerPct(product)}% OFF</span>}
        <span className="pd-veg" aria-label="Pure veg">
          <i />
        </span>
      </div>

      <div className="pd-body">
        <h1 className="pd-name">{product.name}</h1>
        {product.rating > 0 && (
          <span className="pd-rating">★ {product.rating.toFixed(1)} rating</span>
        )}
        {product.description && (
          <p className="pd-desc">{product.description}</p>
        )}

        <div className="pd-price">
          <b>{money(effectivePrice(product))}</b>
          {off && <s>{money(product.price)}</s>}
          {off && (
            <span className="pd-save">
              Save {money(product.price - product.offerPrice)}
            </span>
          )}
        </div>

        {/* macros */}
        <div className="pd-macros">
          <div className="pd-macro cal">
            <b>{product.calories}</b>
            <span>calories</span>
          </div>
          <div className="pd-macro pro">
            <b>{product.protein}g</b>
            <span>protein</span>
          </div>
          <div className="pd-macro">
            <b>{product.carbs}g</b>
            <span>carbs</span>
          </div>
          <div className="pd-macro">
            <b>{product.fat}g</b>
            <span>fat</span>
          </div>
        </div>

        {/* add / qty */}
        <div style={{ margin: '18px 0 6px' }}>
          {qty > 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                justifyContent: 'space-between',
                background: C.greenSoft,
                borderRadius: 13,
                padding: '10px 14px',
              }}
            >
              <span style={{ fontWeight: 700, color: C.greenDeep }}>
                {qty} in cart
              </span>
              <div className="bt-qty">
                <button onClick={() => sub(product.id)}>−</button>
                <span>{qty}</span>
                <button onClick={() => add(product.id)}>+</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => add(product.id)}
              style={{
                width: '100%',
                background: `linear-gradient(135deg,${C.green},${C.greenDeep})`,
                color: '#fff',
                border: 'none',
                fontSize: 16,
                fontWeight: 800,
                padding: 14,
                borderRadius: 13,
                cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(76,175,80,.35)',
              }}
            >
              Add to Cart · {money(effectivePrice(product))}
            </button>
          )}
        </div>
      </div>

      {/* recommended */}
      {recommended.length > 0 && (
        <>
          <h2 className="bt-section-h">You might also like 😋</h2>
          <div style={{ padding: '0 12px 12px' }}>
            {recommended.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
