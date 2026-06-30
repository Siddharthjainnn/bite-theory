'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '../components/AppShell';
import AppHeader from '../components/AppHeader';
import FoodImage from '../components/FoodImage';
import { useCart } from '../providers/CartProvider';
import { Order, money, catEmoji, C } from '../lib/bite';

const STATUS_LABEL: Record<Order['status'], string> = {
  placed: 'Placed',
  preparing: 'Preparing',
  on_the_way: 'On the way',
  delivered: 'Delivered',
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
}

function OrdersInner() {
  const { orders, add } = useCart();
  const params = useSearchParams();
  const justPlaced = params.get('placed');

  function reorder(o: Order) {
    o.items.forEach((it) => {
      for (let i = 0; i < it.qty; i++) add(it.id);
    });
  }

  return (
    <AppShell header={<AppHeader variant="page" title="Your Orders" />}>
      <div className="bt-page-pad">
        {justPlaced && (
          <div
            style={{
              background: C.greenSoft,
              border: `1px solid ${C.green}`,
              borderRadius: 14,
              padding: '14px 16px',
              marginBottom: 14,
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 26 }}>🎉</span>
            <div>
              <div style={{ fontWeight: 800, color: C.greenDeep }}>
                Order placed!
              </div>
              <div style={{ fontSize: 12, color: '#3a5a4d', marginTop: 2 }}>
                #{justPlaced} · Theory Bhaiya is on it 🧪
              </div>
            </div>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="bt-empty" style={{ marginTop: 24 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
            Abhi tak koi order nahi.
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
                Order something →
              </Link>
            </div>
          </div>
        ) : (
          orders.map((o) => (
            <div key={o.id} className="order-card">
              <div className="order-top">
                <div>
                  <div className="order-id">#{o.id}</div>
                  <div className="order-date">{timeAgo(o.createdAt)}</div>
                </div>
                <span className={`order-status ${o.status}`}>
                  {STATUS_LABEL[o.status]}
                </span>
              </div>
              <div className="order-items">
                {o.items.map((it) => (
                  <div key={it.id} className="order-line">
                    <span>
                      {it.qty}× {it.name}
                    </span>
                    <span>{money(it.price * it.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="order-foot">
                <span className="order-total">{money(o.total)}</span>
                <button className="order-reorder" onClick={() => reorder(o)}>
                  Reorder
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersInner />
    </Suspense>
  );
}
