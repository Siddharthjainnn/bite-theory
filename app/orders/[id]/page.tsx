'use client';

/**
 * /orders/[id] — Swiggy-style live tracking.
 * Google Map with destination + rider markers, route line, ETA banner,
 * status timeline, items and bill. Polls /orders/:id/track every 10s
 * until delivered/cancelled. Works without a Maps key (timeline only).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppShell from '../../components/AppShell';
import AppHeader from '../../components/AppHeader';
import {
  C, money, ApiOrder, fetchOrderTrack, STATUS_META, TRACK_STEPS, ApiOrderStatus,
  cancelOrder, postReview,
} from '../../lib/bite';
import { loadGoogleMaps, MAPS_KEY } from '../../lib/maps';

const POLL_MS = 10000;

export default function OrderTrackPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const justPlaced = search.get('placed');

  const { data: session } = useSession();
  const userId = (session?.user as any)?.id ? Number((session?.user as any).id) : undefined;

  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [error, setError] = useState('');

  /* cancel */
  const [cancelling, setCancelling] = useState(false);
  async function handleCancel() {
    if (!order || !userId) return;
    if (!confirm('Cancel this order? Any payment will be refunded automatically.')) return;
    setCancelling(true);
    try {
      await cancelOrder(order.id, userId);
      await load();
    } catch (e: any) {
      alert(e.message || 'Could not cancel the order');
    } finally {
      setCancelling(false);
    }
  }

  /* post-delivery rating */
  const ratedKey = `bt_rated_order_`;
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingDone, setRatingDone] = useState(false);
  const [ratingSaving, setRatingSaving] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem(ratedKey + id)) setRatingDone(true); } catch {}
  }, [id, ratedKey]);
  async function submitRating() {
    if (!order || !userId || rating < 1) return;
    setRatingSaving(true);
    try {
      const items = order.items || [];
      await Promise.all(items.map((it) => postReview({
        userId, productId: Number(it.productId), rating,
        comment: ratingComment.trim() || undefined, orderId: Number(order.id),
      })));
      try { localStorage.setItem(ratedKey + id, '1'); } catch {}
      setRatingDone(true);
    } catch (e: any) {
      alert(e.message || 'Could not save your rating');
    } finally {
      setRatingSaving(false);
    }
  }

  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const destMarker = useRef<google.maps.Marker | null>(null);
  const riderMarker = useRef<google.maps.Marker | null>(null);
  const storeMarker = useRef<google.maps.Marker | null>(null);
  const routeLine = useRef<google.maps.Polyline | null>(null);

  const load = useCallback(async () => {
    try {
      const o = await fetchOrderTrack(id);
      setOrder(o);
      return o;
    } catch (e: any) {
      setError(e.message || 'Could not load order');
      return null;
    }
  }, [id]);

  /* poll until terminal state */
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    load().then((o) => {
      if (o && o.status !== 'delivered' && o.status !== 'cancelled') {
        timer = setInterval(async () => {
          const next = await load();
          if (next && (next.status === 'delivered' || next.status === 'cancelled')) {
            if (timer) clearInterval(timer);
          }
        }, POLL_MS);
      }
    });
    return () => { if (timer) clearInterval(timer); };
  }, [load]);

  /* map: init + update markers whenever order changes */
  useEffect(() => {
    if (!order || !MAPS_KEY || !mapDiv.current) return;
    const dest = order.deliveryLat != null && order.deliveryLng != null
      ? { lat: Number(order.deliveryLat), lng: Number(order.deliveryLng) } : null;
    if (!dest) return;
    const rider = order.partner?.lat != null && order.partner?.lng != null
      ? { lat: Number(order.partner.lat), lng: Number(order.partner.lng) } : null;

    loadGoogleMaps().then((g) => {
      if (!mapDiv.current) return;
      if (!mapRef.current) {
        mapRef.current = new g.maps.Map(mapDiv.current, {
          center: dest, zoom: 15, disableDefaultUI: true, zoomControl: true, clickableIcons: false,
        });
      }
      const map = mapRef.current;

      /* kitchen pin — visible even before a rider is assigned */
      const store = order.store?.lat != null
        ? { lat: Number(order.store.lat), lng: Number(order.store.lng) } : null;
      if (store) {
        if (!storeMarker.current) {
          storeMarker.current = new g.maps.Marker({
            map, position: store, title: 'Bite Theory kitchen',
            label: { text: '🍳', fontSize: '22px' } as any,
          });
        } else storeMarker.current.setPosition(store);
      }

      if (!destMarker.current) {
        destMarker.current = new g.maps.Marker({
          map, position: dest, title: 'Delivery location',
          label: { text: '🏠', fontSize: '22px' } as any,
        });
      } else destMarker.current.setPosition(dest);

      if (rider) {
        if (!riderMarker.current) {
          riderMarker.current = new g.maps.Marker({
            map, position: rider, title: order.partner?.name || 'Rider',
            label: { text: '🛵', fontSize: '22px' } as any,
          });
        } else riderMarker.current.setPosition(rider);

        if (!routeLine.current) {
          routeLine.current = new g.maps.Polyline({
            map, path: [rider, dest], strokeColor: '#2e7d32',
            strokeOpacity: 0.85, strokeWeight: 4,
          });
        } else routeLine.current.setPath([rider, dest]);

        const bounds = new g.maps.LatLngBounds();
        bounds.extend(dest); bounds.extend(rider);
        map.fitBounds(bounds, 60);
      } else if (store) {
        /* no rider yet: line kitchen → home, "preparing" view */
        if (!routeLine.current) {
          routeLine.current = new g.maps.Polyline({
            map, path: [store, dest], strokeColor: '#f39c12',
            strokeOpacity: 0.7, strokeWeight: 3,
          });
        } else routeLine.current.setPath([store, dest]);
        const bounds = new g.maps.LatLngBounds();
        bounds.extend(dest); bounds.extend(store);
        map.fitBounds(bounds, 60);
      }
    }).catch(() => { /* no-map fallback: timeline still shows */ });
  }, [order]);

  const meta = order ? STATUS_META[order.status as ApiOrderStatus] : null;
  const currentStep = meta?.step ?? 0;
  const cancelled = order?.status === 'cancelled';
  const delivered = order?.status === 'delivered';

  const card: React.CSSProperties = {
    background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 14, marginBottom: 14,
  };

  return (
    <AppShell header={<AppHeader variant="page" title={order ? `Order ${order.orderNumber}` : 'Order'} />}>
      <div className="bt-page-pad">
        {error && <div style={{ padding: 30, textAlign: 'center', color: '#c0392b' }}>{error}</div>}
        {!order && !error && <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Loading…</div>}

        {order && (
          <>
            {justPlaced && (
              <div style={{ background: C.greenSoft, border: `1px solid ${C.green}`, borderRadius: 14, padding: '12px 14px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 24 }}>🎉</span>
                <div style={{ fontSize: 13 }}>
                  <b style={{ color: C.greenDeep }}>Order placed!</b>{' '}
                  We&apos;ve sent it to the kitchen.
                </div>
              </div>
            )}

            {/* ── STATUS BANNER ── */}
            <div style={{ ...card, background: cancelled ? '#fdecea' : C.dark, color: cancelled ? '#c0392b' : '#fff', border: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{cancelled ? 'Order cancelled' : delivered ? 'Enjoy your meal!' : 'Estimated arrival'}</div>
                  <div style={{ fontWeight: 800, fontSize: 20 }}>
                    {cancelled ? '—' : delivered ? 'Delivered ✅' : `${order.etaMinutes || 35} mins`}
                  </div>
                </div>
                <div style={{ fontSize: 34 }}>{meta?.emoji}</div>
              </div>
              {!cancelled && !delivered && (
                <div style={{ fontSize: 12.5, marginTop: 4, opacity: 0.9 }}>{meta?.label}</div>
              )}
              {/* stale GPS: rider assigned but no location ping in >60s */}
              {!cancelled && !delivered && order.partner &&
                (!order.partner.locationUpdatedAt ||
                  Date.now() - new Date(order.partner.locationUpdatedAt).getTime() > 60_000) && (
                <div style={{ fontSize: 12, marginTop: 6, padding: '4px 8px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.15)', display: 'inline-block' }}>
                  📡 Rider location updating…
                </div>
              )}
            </div>

            {/* ── CANCEL (only before cooking starts) ── */}
            {['order_received', 'order_confirmed'].includes(order.status) && userId && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                style={{
                  width: '100%', background: '#fff', color: '#c0392b',
                  border: '1px solid #f5c6cb', borderRadius: 12, padding: '11px',
                  fontWeight: 800, fontSize: 13, cursor: 'pointer', marginBottom: 14,
                }}
              >
                {cancelling ? 'Cancelling…' : '✖ Cancel order (free until cooking starts)'}
              </button>
            )}

            {/* ── RATE YOUR ORDER (after delivery) ── */}
            {delivered && !ratingDone && (
              <div style={{ ...card, border: `1px solid ${C.green}` }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>⭐ How was your food?</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setRating(n)}
                      style={{
                        fontSize: 28, background: 'none', border: 'none', cursor: 'pointer',
                        filter: n <= rating ? 'none' : 'grayscale(1) opacity(0.4)',
                      }}
                      aria-label={`${n} star`}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
                <textarea
                  placeholder="Anything to add? (optional)"
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  maxLength={300}
                  style={{
                    width: '100%', border: `1px solid ${C.line}`, borderRadius: 10,
                    padding: '10px 12px', fontSize: 13, minHeight: 56, resize: 'vertical',
                    outline: 'none', marginBottom: 10,
                  }}
                />
                <button
                  onClick={submitRating}
                  disabled={rating < 1 || ratingSaving}
                  style={{
                    width: '100%', background: rating < 1 ? C.line : C.green, color: '#fff',
                    border: 'none', borderRadius: 10, padding: '11px', fontWeight: 800,
                    fontSize: 13, cursor: rating < 1 ? 'default' : 'pointer',
                  }}
                >
                  {ratingSaving ? 'Saving…' : 'Submit rating'}
                </button>
              </div>
            )}
            {delivered && ratingDone && (
              <div style={{ ...card, textAlign: 'center', color: C.greenDeep, fontWeight: 700, fontSize: 13 }}>
                🙏 Thanks for rating your order!
              </div>
            )}

            {/* ── LIVE MAP ── */}
            {MAPS_KEY && order.deliveryLat != null ? (
              <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.line}`, marginBottom: 14 }}>
                <div ref={mapDiv} style={{ width: '100%', height: 260 }} />
              </div>
            ) : null}

            {/* ── RIDER CARD ── */}
            {order.partner && (
              <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, overflow: 'hidden' }}>
                  {order.partner.photo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={order.partner.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : '🛵'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{order.partner.name}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    {order.partner.vehicleNo || 'Your delivery partner'}
                  </div>
                </div>
                {order.partner.mobile && (
                  <a href={`tel:${order.partner.mobile}`} style={{ background: C.green, color: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>
                    📞 Call
                  </a>
                )}
              </div>
            )}

            {/* ── TIMELINE ── */}
            {!cancelled && (
              <div style={card}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>Order status</div>
                {TRACK_STEPS.map((s, i) => {
                  const done = i <= currentStep;
                  const active = i === currentStep;
                  return (
                    <div key={s} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%', fontSize: 13,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: done ? C.green : C.bg,
                          color: done ? '#fff' : C.muted,
                          border: `2px solid ${done ? C.green : C.line}`,
                          boxShadow: active ? `0 0 0 4px ${C.greenSoft}` : 'none',
                        }}>
                          {done ? '✓' : ''}
                        </div>
                        {i < TRACK_STEPS.length - 1 && (
                          <div style={{ width: 2, height: 22, background: i < currentStep ? C.green : C.line }} />
                        )}
                      </div>
                      <div style={{ paddingTop: 3, paddingBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: active ? 800 : 600, color: done ? C.ink : C.muted }}>
                          {STATUS_META[s].emoji} {STATUS_META[s].label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── DELIVERY ADDRESS ── */}
            {order.deliveryAddress && (
              <div style={card}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>📍 Delivering to</div>
                <div style={{ fontSize: 13, color: C.muted }}>{order.deliveryAddress}</div>
              </div>
            )}

            {/* ── ITEMS + BILL ── */}
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>🧾 Bill</div>
              {(order.items || []).map((it) => (
                <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                  <span>{it.productName} × {it.quantity}</span>
                  <span>{money(Number(it.lineTotal))}</span>
                </div>
              ))}
              <div style={{ borderTop: `1px dashed ${C.line}`, marginTop: 8, paddingTop: 8, fontSize: 13, color: C.muted }}>
                {[
                  ['Item total', money(Number(order.subtotal))],
                  ...(Number(order.discount) > 0 ? [['Discount', `− ${money(Number(order.discount))}`]] : []),
                  ['Delivery', Number(order.deliveryCharge) === 0 ? 'FREE' : money(Number(order.deliveryCharge))],
                  ...(Number((order as any).tip) > 0 ? [['Rider tip', money(Number((order as any).tip))]] : []),
                  ...(Number(order.walletUsed) > 0 ? [['Wallet', `− ${money(Number(order.walletUsed))}`]] : []),
                ].map(([k, v]) => (
                  <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span>{k}</span><span>{v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, color: C.ink, marginTop: 6 }}>
                  <span>Paid / To pay</span><span>{money(Number(order.total))}</span>
                </div>
              </div>
            </div>
            <div style={{ height: 20 }} />
          </>
        )}
      </div>
    </AppShell>
  );
}
