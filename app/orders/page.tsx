'use client';

/**
 * /orders — order history, fetched from the backend by session user id.
 * Tap any order → live tracking page. Reorder puts items back in cart.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppShell from '../components/AppShell';
import AppHeader from '../components/AppHeader';
import { useCart } from '../providers/CartProvider';
import {
  C, money, ApiOrder, ApiOrderStatus, STATUS_META, fetchMyOrders, fetchOrderTrack,
} from '../lib/bite';

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
}

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { add } = useCart();
  const [orders, setOrders] = useState<ApiOrder[] | null>(null);
  const [error, setError] = useState('');

  const userId = (session?.user as any)?.id;

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login?callbackUrl=/orders');
  }, [status, router]);

  useEffect(() => {
    if (!userId) return;
    fetchMyOrders(Number(userId))
      .then(setOrders)
      .catch((e) => setError(e.message || 'Could not load orders'));
  }, [userId]);

  async function reorder(o: ApiOrder) {
    try {
      const full = o.items?.length ? o : await fetchOrderTrack(o.id);
      (full.items || []).forEach((it) => {
        for (let i = 0; i < it.quantity; i++) add(Number(it.productId));
      });
      router.push('/cart');
    } catch {
      /* item may be delisted; cart just stays as-is */
    }
  }

  const live = (s: ApiOrderStatus) => s !== 'delivered' && s !== 'cancelled';

  return (
    <AppShell header={<AppHeader variant="page" title="Your Orders" />}>
      <div className="bt-page-pad">
        {error && <div style={{ padding: 30, textAlign: 'center', color: '#c0392b' }}>{error}</div>}
        {!orders && !error && (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Loading…</div>
        )}
        {orders && orders.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🍽️</div>
            No orders yet.{' '}
            <Link href="/menu" style={{ color: C.greenDeep, fontWeight: 700 }}>
              Order something tasty →
            </Link>
          </div>
        )}
        {orders?.map((o) => {
          const meta = STATUS_META[o.status as ApiOrderStatus] || STATUS_META.order_received;
          const isLive = live(o.status as ApiOrderStatus);
          return (
            <div
              key={o.id}
              style={{
                background: '#fff',
                border: `1px solid ${isLive ? C.green : 'rgba(13,59,46,.06)'}`,
                borderRadius: 18, padding: 15, marginBottom: 12,
                boxShadow: isLive
                  ? '0 6px 18px rgba(76,175,80,.18)'
                  : '0 4px 14px rgba(13,59,46,.05)',
              }}
            >
              <Link href={`/orders/${o.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: C.ink }}>
                      {meta.emoji} {o.orderNumber}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                      {timeAgo(o.placedAt)} · {money(Number(o.total))}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11.5, fontWeight: 800, padding: '5px 10px', borderRadius: 999,
                      background: o.status === 'cancelled' ? '#fdecea' : isLive ? C.orangeSoft : C.greenSoft,
                      color: o.status === 'cancelled' ? '#c0392b' : isLive ? C.orangeDeep : C.greenDeep,
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
                {isLive && (
                  <div style={{ fontSize: 12.5, color: C.greenDeep, fontWeight: 700, marginTop: 8 }}>
                    Track live on map →
                  </div>
                )}
              </Link>
              {!isLive && o.status !== 'cancelled' && (
                <button
                  onClick={() => reorder(o)}
                  style={{
                    marginTop: 10, background: 'none', border: `1px solid ${C.green}`,
                    color: C.greenDeep, borderRadius: 10, padding: '8px 14px',
                    fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  ↻ Reorder
                </button>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
