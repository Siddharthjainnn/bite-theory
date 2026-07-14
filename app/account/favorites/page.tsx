'use client';

/**
 * /account/favorites — the user's hearted items.
 * Backed by GET /favorites?userId= (joined with products), with one-tap
 * un-heart and add-to-cart. Hearts are set from the product detail page.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppShell from '../../components/AppShell';
import AppHeader from '../../components/AppHeader';
import FoodImage from '../../components/FoodImage';
import CartBar from '../../components/CartBar';
import { useCart } from '../../providers/CartProvider';
import {
  C, money, catEmoji, FavoriteRow, fetchFavorites, toggleFavorite,
} from '../../lib/bite';

export default function FavoritesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = (session?.user as any)?.id ? Number((session?.user as any).id) : undefined;
  const { add } = useCart();

  const [rows, setRows] = useState<FavoriteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login?callbackUrl=/account/favorites');
  }, [status, router]);

  useEffect(() => {
    if (!userId) return;
    fetchFavorites(userId)
      .then(setRows)
      .catch(() => setError('Could not load favorites'))
      .finally(() => setLoading(false));
  }, [userId]);

  async function unheart(f: FavoriteRow) {
    if (!userId) return;
    setRows((r) => r.filter((x) => x.productId !== f.productId)); // optimistic
    try { await toggleFavorite(userId, f.productId); }
    catch { setRows((r) => [f, ...r]); } // roll back
  }

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid rgba(13,59,46,.06)', borderRadius: 18, padding: 13,
    marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center',
    boxShadow: '0 5px 16px rgba(13,59,46,.06)',
  };

  return (
    <AppShell header={<AppHeader variant="page" title="Favorites" />} footerExtra={<CartBar />}>
      <div style={{ padding: '14px 14px 28px' }}>
        {error && (
          <div style={{ ...card, borderColor: '#f3c1c1', background: '#fdf0f0', color: '#c0392b', fontSize: 13 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ ...card, color: C.muted, fontSize: 13 }}>Loading favorites…</div>
        ) : rows.length === 0 ? (
          <div style={{ ...card, flexDirection: 'column', textAlign: 'center', padding: 30 }}>
            <div style={{ fontSize: 34 }}>❤️</div>
            <div style={{ fontWeight: 800, color: C.ink, marginTop: 6 }}>No favorites yet</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>
              Tap the ♡ on any dish to save it here.
            </div>
            <button
              onClick={() => router.push('/menu')}
              style={{
                marginTop: 14, background: C.orange, color: '#fff', border: 'none',
                borderRadius: 20, padding: '10px 22px', fontWeight: 800, fontSize: 13, cursor: 'pointer',
              }}
            >
              Browse Menu →
            </button>
          </div>
        ) : (
          rows.map((f) => {
            const hasOff = Number(f.offerPrice) > 0 && Number(f.offerPrice) < Number(f.price);
            const price = hasOff ? Number(f.offerPrice) : Number(f.price);
            const inactive = f.status && f.status !== 'active';
            return (
              <div key={f.id} style={{ ...card, opacity: inactive ? 0.6 : 1 }}>
                <div
                  onClick={() => router.push(`/product/${f.productId}`)}
                  style={{ width: 68, height: 68, borderRadius: 14, overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}
                >
                  <FoodImage src={f.image} alt={f.name} emoji={catEmoji(f.name)} />
                </div>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => router.push(`/product/${f.productId}`)}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{f.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <b style={{ fontSize: 14, color: C.ink }}>{money(price)}</b>
                    {hasOff && <s style={{ fontSize: 12, color: C.muted }}>{money(Number(f.price))}</s>}
                  </div>
                  {Number(f.rating) > 0 && (
                    <span style={{ fontSize: 11.5, color: C.orangeDeep, fontWeight: 700 }}>★ {Number(f.rating).toFixed(1)}</span>
                  )}
                  {inactive && <span style={{ fontSize: 11, color: '#c0392b', marginLeft: 8 }}>Currently unavailable</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  <button
                    onClick={() => unheart(f)}
                    aria-label="Remove from favorites"
                    style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
                  >
                    ❤️
                  </button>
                  {!inactive && (
                    <button
                      onClick={() => add(f.productId)}
                      style={{
                        background: C.greenSoft, color: C.greenDeep, border: `1px solid ${C.green}`,
                        borderRadius: 10, padding: '6px 14px', fontWeight: 800, fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      ADD
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
