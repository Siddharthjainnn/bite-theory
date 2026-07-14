'use client';

/**
 * /account/reviews — reviews the user has written.
 * Backed by GET /reviews?userId= (joined with product name/image).
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppShell from '../../components/AppShell';
import AppHeader from '../../components/AppHeader';
import FoodImage from '../../components/FoodImage';
import { API_BASE, C, catEmoji, imgUrl, MyReview, fetchMyReviews, deleteReview } from '../../lib/bite';

function Stars({ n }: { n: number }) {
  return (
    <span style={{ color: C.orange, fontSize: 13, letterSpacing: 1 }}>
      {'★'.repeat(Math.max(0, Math.min(5, n)))}
      <span style={{ color: '#d8ded9' }}>{'★'.repeat(Math.max(0, 5 - n))}</span>
    </span>
  );
}

function fmtDate(s?: string | null) {
  if (!s) return '';
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MyReviewsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = (session?.user as any)?.id ? Number((session?.user as any).id) : undefined;

  const [rows, setRows] = useState<MyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login?callbackUrl=/account/reviews');
  }, [status, router]);

  useEffect(() => {
    if (!userId) return;
    fetchMyReviews(userId)
      .then(setRows)
      .catch(() => setError('Could not load your reviews'))
      .finally(() => setLoading(false));
  }, [userId]);

  async function removeReview(r: MyReview) {
    if (!confirm('Delete this review?')) return;
    const prev = rows;
    setRows((x) => x.filter((y) => y.id !== r.id));
    try {
      await deleteReview(r.id); // sends x-user-token; backend checks ownership
    } catch { setRows(prev); }
  }

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid rgba(13,59,46,.06)', borderRadius: 18, padding: 15, marginBottom: 12,
    boxShadow: '0 5px 16px rgba(13,59,46,.06)',
  };

  return (
    <AppShell header={<AppHeader variant="page" title="My Reviews" />}>
      <div style={{ padding: '14px 14px 28px' }}>
        {error && (
          <div style={{ ...card, borderColor: '#f3c1c1', background: '#fdf0f0', color: '#c0392b', fontSize: 13 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ ...card, color: C.muted, fontSize: 13 }}>Loading your reviews…</div>
        ) : rows.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: 30 }}>
            <div style={{ fontSize: 34 }}>⭐</div>
            <div style={{ fontWeight: 800, color: C.ink, marginTop: 6 }}>No reviews yet</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>
              Order something tasty, then come back and tell us how it was!
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
          rows.map((r) => (
            <div key={r.id} style={card}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div
                  onClick={() => router.push(`/product/${r.productId}`)}
                  style={{ width: 52, height: 52, borderRadius: 12, overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}
                >
                  <FoodImage src={r.productImage || ''} alt={r.productName || 'Item'} emoji={catEmoji(r.productName || '')} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    onClick={() => router.push(`/product/${r.productId}`)}
                    style={{ fontSize: 14, fontWeight: 800, color: C.ink, cursor: 'pointer' }}
                  >
                    {r.productName || `Item #${r.productId}`}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    <Stars n={Number(r.rating) || 0} />
                    <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(r.createdAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => removeReview(r)}
                  aria-label="Delete review"
                  style={{ background: 'none', border: 'none', color: '#d64545', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}
                >
                  Delete
                </button>
              </div>
              {r.comment && (
                <p style={{ fontSize: 13, color: C.ink, lineHeight: 1.5, margin: '10px 0 0' }}>{r.comment}</p>
              )}
              {(r.image1 || r.image2 || r.image3) && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  {[r.image1, r.image2, r.image3].filter(Boolean).map((img, i) => (
                    <img
                      key={i} src={imgUrl(img as string)} alt="review"
                      style={{ width: 62, height: 62, borderRadius: 10, objectFit: 'cover', border: `1px solid ${C.line}` }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
