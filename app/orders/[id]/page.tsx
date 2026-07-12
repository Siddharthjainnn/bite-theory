'use client';

/**
 * /orders/[id] — Swiggy-style live tracking.
 * Google Map with destination + rider markers, route line, ETA banner,
 * status timeline, items and bill. Polls /orders/:id/track every 10s
 * until delivered/cancelled. Works without a Maps key (timeline only).
 */
import ScratchCard from '../../components/ScratchCard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppShell from '../../components/AppShell';
import AppHeader from '../../components/AppHeader';
import {
  C, money, ApiOrder, fetchOrderTrack, STATUS_META, TRACK_STEPS, ApiOrderStatus,
  cancelOrder, postReview, fetchStoreSettings, InvoiceConfig,
} from '../../lib/bite';
import { customerInvoice, printHtml, InvoiceOrder } from '../../lib/invoice';
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
  const [invoiceCfg, setInvoiceCfg] = useState<InvoiceConfig | null>(null);

  useEffect(() => {
    fetchStoreSettings()
      .then((s) => setInvoiceCfg(s?.invoiceConfig || null))
      .catch(() => {});
  }, []);

  function handlePrintInvoice() {
    if (!order) return;
    const inv: InvoiceOrder = {
      orderNumber: order.orderNumber,
      placedAt: order.placedAt,
      items: (order.items || []).map((it) => ({
        productName: it.productName, quantity: it.quantity,
        unitPrice: Number(it.unitPrice), lineTotal: Number(it.lineTotal),
      })),
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      deliveryCharge: Number(order.deliveryCharge),
      tax: Number((order as any).tax || 0),
      walletUsed: Number(order.walletUsed),
      tip: Number((order as any).tip || 0),
      total: Number(order.total),
      deliveryAddress: order.deliveryAddress,
      paymentMethod: (order as any).paymentMethod,
      status: order.status,
    };
    printHtml(customerInvoice(inv, invoiceCfg));
  }

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
  /* live-navigation extras */
  const dirService = useRef<google.maps.DirectionsService | null>(null);
  const riderAnim = useRef<number | null>(null);              // requestAnimationFrame id
  const riderPos = useRef<google.maps.LatLng | null>(null);   // marker's current on-screen position
  const routePath = useRef<google.maps.LatLng[] | null>(null); // the drawn road route, to measure rider deviation
  const routeDest = useRef<string>('');                        // destination the current route was drawn to
  const didFit = useRef<boolean>(false);                      // fit bounds only once

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

  /* poll until terminal state — faster cadence once the rider is moving */
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const intervalFor = (status?: string) =>
      status === 'out_for_delivery' || status === 'arriving_soon' ? 5000 : POLL_MS;
    load().then((o) => {
      if (o && o.status !== 'delivered' && o.status !== 'cancelled') {
        let ms = intervalFor(o.status);
        const start = (delay: number) => {
          timer = setInterval(async () => {
            const next = await load();
            if (next && (next.status === 'delivered' || next.status === 'cancelled')) {
              if (timer) clearInterval(timer);
              return;
            }
            /* if the delivery leg just began, resample faster */
            const want = intervalFor(next?.status);
            if (want !== ms && timer) {
              clearInterval(timer);
              ms = want;
              start(ms);
            }
          }, delay);
        };
        start(ms);
      }
    });
    return () => { if (timer) clearInterval(timer); };
  }, [load]);

  /* Glide the rider marker from its current on-screen spot to the newest GPS
     fix over ~1s using requestAnimationFrame + linear interpolation, so the
     scooter visibly drives instead of jumping every poll. */
  const animateRiderTo = useCallback((g: typeof google, target: google.maps.LatLng) => {
    const marker = riderMarker.current;
    if (!marker) return;
    const from = riderPos.current || marker.getPosition() || target;
    // no meaningful move → snap, skip animation
    if (g.maps.geometry?.spherical &&
        g.maps.geometry.spherical.computeDistanceBetween(from, target) < 2) {
      marker.setPosition(target);
      riderPos.current = target;
      return;
    }
    if (riderAnim.current) cancelAnimationFrame(riderAnim.current);
    const start = performance.now();
    const DURATION = 1000; // ms
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const lat = from.lat() + (target.lat() - from.lat()) * t;
      const lng = from.lng() + (target.lng() - from.lng()) * t;
      const pos = new g.maps.LatLng(lat, lng);
      marker.setPosition(pos);
      riderPos.current = pos;
      if (t < 1) riderAnim.current = requestAnimationFrame(step);
    };
    riderAnim.current = requestAnimationFrame(step);
  }, []);

  /* cancel any in-flight animation on unmount */
  useEffect(() => () => { if (riderAnim.current) cancelAnimationFrame(riderAnim.current); }, []);

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
            map, position: store, title: 'Bites Theory kitchen',
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
        const target = new g.maps.LatLng(rider.lat, rider.lng);

        /* create the rider marker once, then GLIDE it to each new fix
           instead of teleporting — this is what makes it look like it's
           actually driving between polls (Swiggy/Zomato style). */
        if (!riderMarker.current) {
          riderMarker.current = new g.maps.Marker({
            map, position: target, title: order.partner?.name || 'Rider',
            label: { text: '🛵', fontSize: '22px' } as any,
            zIndex: 999,
          });
          riderPos.current = target;
        } else {
          animateRiderTo(g, target);
        }

        /* Bug 5: if the rider has drifted near/outside the visible map, gently
           pan to keep them and the home pin in frame (like Google Maps) rather
           than making the customer chase the marker by hand. */
        if (didFit.current) {
          const b = map.getBounds();
          if (b && !b.contains(target)) {
            const follow = new g.maps.LatLngBounds();
            follow.extend(dest); follow.extend(target);
            map.panToBounds(follow, 60);
          }
        }

        /* ── COST-OPTIMISED ROUTING ──────────────────────────────────────
           Each Directions call is a billable event. The old code re-routed
           every ~11m of rider movement (~30 calls/delivery). Instead we:
             1. draw the road route ONCE when the rider first appears,
             2. keep gliding the marker along it every poll (free),
             3. only re-request a route if the rider has strayed far from the
                drawn path (took a different road) OR the destination changed.
           This drops ~30 calls/delivery to ~2–3, keeping you inside the free
           10,000/month tier well into thousands of orders. */
        const destKey = `${dest.lat},${dest.lng}`;
        let needsRoute = !routePath.current || routeDest.current !== destKey;

        if (!needsRoute && routePath.current && g.maps.geometry?.spherical) {
          /* how far is the rider from the nearest point of the drawn route?
             if they've strayed > ~150m, they're on a different road — re-route. */
          let minDist = Infinity;
          for (const p of routePath.current) {
            const d = g.maps.geometry.spherical.computeDistanceBetween(target, p);
            if (d < minDist) minDist = d;
            if (minDist < 150) break; // close enough, stop scanning early
          }
          if (minDist > 150) needsRoute = true;
        }

        if (needsRoute) {
          routeDest.current = destKey;
          if (!dirService.current) dirService.current = new g.maps.DirectionsService();
          dirService.current.route(
            {
              origin: rider, destination: dest,
              travelMode: g.maps.TravelMode.DRIVING,
            },
            (res, status) => {
              const ok = status === 'OK' && res?.routes?.[0]?.overview_path;
              if (!ok) {
                /* Bug 3: surface failures instead of silently drawing a line. */
                console.warn(
                  `[tracking] Directions API returned "${status}" — drawing straight-line ` +
                  `fallback. If this is REQUEST_DENIED, enable the Directions API (and billing) ` +
                  `for this Maps key in Google Cloud.`);
              }
              const path = ok
                ? res!.routes[0].overview_path
                : [target, new g.maps.LatLng(dest.lat, dest.lng)]; // fallback: straight line
              routePath.current = path as google.maps.LatLng[]; // remember for deviation checks
              if (!routeLine.current) {
                routeLine.current = new g.maps.Polyline({
                  map, path, strokeColor: '#2e7d32', strokeOpacity: 0.9, strokeWeight: 5,
                });
              } else {
                routeLine.current.setPath(path);
                routeLine.current.setOptions({ strokeColor: '#2e7d32', strokeOpacity: 0.9, strokeWeight: 5 });
              }
            },
          );
        }

        /* Bug 2: fit ALL relevant pins (kitchen + rider + home) once, so the
           customer sees the whole journey, not just rider→home. */
        if (!didFit.current) {
          const bounds = new g.maps.LatLngBounds();
          bounds.extend(dest); bounds.extend(rider);
          if (store) bounds.extend(store);
          map.fitBounds(bounds, 60);
          didFit.current = true;
        }
      } else if (store) {
        /* no rider yet: dashed kitchen → home line, "preparing" view */
        if (!routeLine.current) {
          routeLine.current = new g.maps.Polyline({
            map, path: [store, dest], strokeColor: '#f39c12',
            strokeOpacity: 0.7, strokeWeight: 3,
          });
        } else routeLine.current.setPath([store, dest]);
        if (!didFit.current) {
          const bounds = new g.maps.LatLngBounds();
          bounds.extend(dest); bounds.extend(store);
          map.fitBounds(bounds, 60);
          didFit.current = true;
        }
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
                    {cancelled ? '—' : delivered ? 'Delivered ✅'
                      : order.etaMinutes == null ? 'Calculating…'
                      : `${order.etaMinutes} ${order.etaMinutes === 1 ? 'min' : 'mins'}`}
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

            {/* ── PREP VIDEO (signature feature): watch your food being made ── */}
            {order.prepVideoUrl && !cancelled && (
              <div style={{ ...card, border: `1px solid ${C.green}`, overflow: 'hidden', padding: 0 }}>
                <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🎬</span>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>Your food, being made fresh</div>
                </div>
                <video
                  src={order.prepVideoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  style={{ width: '100%', maxHeight: 320, background: '#000', display: 'block' }}
                />
                <div style={{ padding: '8px 14px 12px', fontSize: 12, color: C.muted }}>
                  Made with care in our kitchen just for you. 💚
                </div>
              </div>
            )}

            {/* ── DELIVERY OTP (§4.5): share with the rider at handoff ── */}
            {!cancelled && !delivered && order.deliveryOtp &&
              ['out_for_delivery', 'arriving_soon'].includes(order.status) && (
              <div style={{ ...card, background: '#fff8e6', border: '1px solid #f3e3b3', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 26 }}>🔐</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: C.muted }}>Share this OTP with your rider to receive your order</div>
                  <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: 6, color: C.ink }}>{order.deliveryOtp}</div>
                </div>
              </div>
            )}

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

            {delivered && userId ? <ScratchCard orderId={Number(order.id)} userId={userId} /> : null}

            {/* ── ITEMS + BILL ── */}
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>🧾 Bill</div>
              {(order.items || []).map((it) => (
                <div key={it.id} style={{ padding: '4px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>{it.thaliConfig ? '🍛 ' : ''}{it.productName} × {it.quantity}</span>
                    <span>{money(Number(it.lineTotal))}</span>
                  </div>
                  {it.thaliConfig?.items && (
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 1, paddingLeft: 4 }}>
                      {it.thaliConfig.items
                        .map((x: { name: string; qty: number }) => (x.qty > 1 ? `${x.qty} × ${x.name}` : x.name))
                        .join(', ')}
                    </div>
                  )}
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
              <button
                onClick={handlePrintInvoice}
                style={{
                  width: '100%', marginTop: 12, background: '#fff', color: C.greenDeep,
                  border: `1px solid ${C.green}`, borderRadius: 10, padding: '10px',
                  fontWeight: 800, fontSize: 13, cursor: 'pointer',
                }}
              >
                🧾 Download / print invoice
              </button>
            </div>
            <div style={{ height: 20 }} />
          </>
        )}
      </div>
    </AppShell>
  );
}
