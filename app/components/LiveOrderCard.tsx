'use client';

/**
 * LiveOrderCard — the "where's my food?" card on the home screen.
 *
 * Why this exists: a customer with an order in flight had no sign of it on the
 * home page. They had to remember Orders exists, open it, then tap through —
 * three taps to answer the single most urgent question they have. Every food
 * app puts this front and centre because it's the #1 reason people reopen the
 * app, and it's the #1 support ticket ("where is my order?").
 *
 * Renders nothing when there's no live order, so it never adds noise.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  C, ApiOrder, ApiOrderStatus, STATUS_META, TRACK_STEPS, fetchMyOrders, money,
} from '../lib/bite';

const LIVE: ApiOrderStatus[] = [
  'order_received', 'order_confirmed', 'preparing_food', 'food_ready',
  'assigned_to_delivery', 'out_for_delivery', 'arriving_soon',
];

export default function LiveOrderCard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [order, setOrder] = useState<ApiOrder | null>(null);

  const userId = (session?.user as any)?.id as number | undefined;

  useEffect(() => {
    if (status !== 'authenticated' || !userId) return;
    let alive = true;

    const load = () => {
      fetchMyOrders(userId)
        .then((rows) => {
          if (!alive) return;
          const live = rows.find((o) => LIVE.includes(o.status as ApiOrderStatus));
          setOrder(live || null);
        })
        .catch(() => { /* home must never break because of this card */ });
    };

    load();
    /* Poll while an order is in flight. 20s is a deliberate compromise: fast
       enough that the status feels live, slow enough that a phone sitting on a
       table all evening isn't hammering the API. The tracking page itself
       polls faster (5s) once you're actually watching the map. */
    const t = setInterval(load, 20000);
    return () => { alive = false; clearInterval(t); };
  }, [status, userId]);

  if (!order) return null;

  const meta = STATUS_META[order.status as ApiOrderStatus];
  const step = meta?.step ?? 0;
  const pct = Math.round((step / (TRACK_STEPS.length - 1)) * 100);
  const arriving = order.status === 'arriving_soon' || order.status === 'out_for_delivery';

  return (
    <section className="loc-wrap">
      <button className={`loc-card ${arriving ? 'loc-card--hot' : ''}`}
        onClick={() => router.push(`/orders/${order.id}`)}>
        <span className="loc-live">● LIVE</span>

        <div className="loc-top">
          <span className="loc-emoji">{meta?.emoji || '🍳'}</span>
          <div className="loc-txt">
            <b>{meta?.label || 'On the way'}</b>
            <span>
              {order.orderNumber}
              {order.etaMinutes != null && !['food_ready', 'preparing_food'].includes(order.status)
                ? ` · ${order.etaMinutes} min away`
                : ''}
            </span>
          </div>
          <span className="loc-total">{money(Number(order.total))}</span>
        </div>

        <div className="loc-track">
          <div className="loc-fill" style={{ width: `${pct}%` }} />
        </div>

        <span className="loc-cta">Track order →</span>
      </button>
    </section>
  );
}
