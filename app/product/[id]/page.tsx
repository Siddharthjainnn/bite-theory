'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
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
  fetchFavoriteIds,
  toggleFavorite,
  fetchProductReviews,
  postReview,
  ProductReview,
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

  /* ── favorite (❤️) state ── */
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id ? Number((session?.user as any).id) : undefined;
  const [fav, setFav] = useState(false);
  const [favBusy, setFavBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetchFavoriteIds(userId)
      .then((ids) => setFav(ids.includes(pid)))
      .catch(() => {});
  }, [userId, pid]);

  async function onHeart() {
    if (!userId) { router.push(`/login?callbackUrl=/product/${pid}`); return; }
    if (favBusy) return;
    setFavBusy(true);
    setFav((f) => !f); // optimistic
    try {
      const r = await toggleFavorite(userId, pid);
      setFav(r.favorited);
    } catch {
      setFav((f) => !f); // roll back
    } finally {
      setFavBusy(false);
    }
  }

  /* ── reviews ── */
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [revLoading, setRevLoading] = useState(true);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [revBusy, setRevBusy] = useState(false);
  const [revError, setRevError] = useState('');
  const [revDone, setRevDone] = useState(false);

  function loadReviews() {
    fetchProductReviews(pid)
      .then(setReviews)
      .catch(() => {})
      .finally(() => setRevLoading(false));
  }
  useEffect(() => { loadReviews(); /* eslint-disable-next-line */ }, [pid]);

  const avgRating = useMemo(() => {
    if (!reviews.length) return 0;
    return reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length;
  }, [reviews]);

  async function submitReview() {
    if (!userId) { router.push(`/login?callbackUrl=/product/${pid}`); return; }
    if (!myRating) { setRevError('Please pick a star rating'); return; }
    setRevBusy(true); setRevError('');
    try {
      await postReview({ userId, productId: pid, rating: myRating, comment: myComment.trim() || undefined });
      setMyRating(0); setMyComment(''); setRevDone(true);
      loadReviews();
      setTimeout(() => setRevDone(false), 2500);
    } catch (e: any) {
      setRevError(e.message || 'Could not post review');
    } finally {
      setRevBusy(false);
    }
  }

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
        <button
          onClick={onHeart}
          aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
          style={{
            position: 'absolute', bottom: 12, right: 12, zIndex: 3,
            width: 42, height: 42, borderRadius: '50%', border: 'none',
            background: '#fff', boxShadow: '0 3px 12px rgba(13,59,46,.18)',
            fontSize: 20, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            opacity: favBusy ? 0.7 : 1,
          }}
        >
          {fav ? '❤️' : '🤍'}
        </button>
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

      {/* reviews */}
      <h2 className="bt-section-h">
        Ratings & Reviews {reviews.length > 0 && <span style={{ color: C.muted, fontWeight: 600, fontSize: 14 }}>({reviews.length})</span>}
      </h2>
      <div style={{ padding: '0 14px 4px' }}>
        {avgRating > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: C.ink }}>{avgRating.toFixed(1)}</span>
            <div>
              <div style={{ color: '#f5a623', fontSize: 16 }}>
                {'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))}
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>{reviews.length} review{reviews.length === 1 ? '' : 's'}</div>
            </div>
          </div>
        )}

        {/* write a review */}
        <div style={{ background: '#fff', border: `1.5px solid ${C.line}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 8 }}>Rate this dish</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setMyRating(n)} aria-label={`${n} star`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 28, lineHeight: 1, color: n <= myRating ? '#f5a623' : '#d9e2dd', padding: 0 }}>
                ★
              </button>
            ))}
          </div>
          <textarea rows={2} value={myComment} onChange={(e) => setMyComment(e.target.value)}
            placeholder="Share a few words (optional)…"
            style={{ width: '100%', border: `1.5px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', fontSize: 13.5, color: C.ink, outline: 'none', resize: 'vertical', background: '#fff' }} />
          {revError && <div style={{ color: '#c0392b', fontSize: 12, marginTop: 6 }}>{revError}</div>}
          {revDone && <div style={{ color: C.greenDeep, fontSize: 12, marginTop: 6, fontWeight: 700 }}>Thanks for your review! 🙌</div>}
          <button onClick={submitReview} disabled={revBusy}
            style={{ marginTop: 10, width: '100%', background: `linear-gradient(135deg,${C.green},${C.greenDeep})`, color: '#fff', border: 'none', fontSize: 14, fontWeight: 800, padding: 11, borderRadius: 11, cursor: 'pointer' }}>
            {revBusy ? 'Posting…' : 'Submit review'}
          </button>
        </div>

        {/* review list */}
        {revLoading ? (
          <div style={{ color: C.muted, fontSize: 13, paddingBottom: 8 }}>Loading reviews…</div>
        ) : reviews.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 13, paddingBottom: 8 }}>No reviews yet — be the first! ⭐</div>
        ) : (
          reviews.map((r) => (
            <div key={r.id} style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: '11px 13px', marginBottom: 9 }}>
              <div style={{ color: '#f5a623', fontSize: 14 }}>
                {'★'.repeat(Number(r.rating) || 0)}{'☆'.repeat(5 - (Number(r.rating) || 0))}
              </div>
              {r.comment && <div style={{ fontSize: 13.5, color: C.ink, marginTop: 4, lineHeight: 1.5 }}>{r.comment}</div>}
              {r.createdAt && (
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                  {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
          ))
        )}
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
