'use client';

/**
 * LiveOrderBoard — the kitchen's order screen, Zomato-partner style.
 *
 * FOUR STEPS, ONE BUTTON EACH
 *   Preparing         new orders pop up; Accept → cooking; "Food ready" →
 *   Assign rider      pick a delivery partner (or book Porter) → "Assign & send out" →
 *   Out for delivery  "Delivered" →
 *   Delivered         today's finished orders
 *
 * (Earlier notes kept below.)
 *
 * LiveOrderBoard — Swiggy-partner-style order routing for the kitchen.
 *
 * WHY THIS EXISTS
 * The existing Orders screen is a table: open an order, open a dialog, pick a
 * status, save. That is fine for looking things up and wrong for a kitchen at
 * 1pm. This screen is built for one job — move the order to its next state in
 * a single tap — and orders re-file themselves into the correct tab as they go.
 *
 * FOUR TAPS, NOT NINE
 * The backend has nine statuses, but a kitchen should not tap nine times.
 * Where the state machine permits a skip, this screen takes it:
 *
 *   Accept      order_received -> preparing_food   (skips order_confirmed,
 *                                                   which the machine allows)
 *   Ready       preparing_food -> food_ready
 *   Picked up   food_ready -> assigned_to_delivery -> out_for_delivery
 *                                                   (two calls, one button)
 *   Delivered   out_for_delivery -> delivered       (skips arriving_soon)
 *
 * Nothing is bypassed on the server: every hop is a legal transition and every
 * one is written to order_status_history. The customer still sees the full
 * granular timeline; only the staff tap count shrinks.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { C, money, fetchStoreSettings } from '../lib/bite';
import { chefTicket, customerInvoice, printHtml } from '../lib/invoice';
import DispatchSheet from './DispatchSheet';
import {
  isExternalProvider, localityOf, ORDERS_CHANGED_EVENT,
  type DispatchApi, type RiderStatus, type Suggestion, type TripsApi,
} from '../lib/dispatch';

type Order = {
  id: number;
  orderNumber?: string | null;
  order_number?: string | null;
  status: string;
  total?: number | string | null;
  placedAt?: string | null;
  placed_at?: string | null;
  deliveryAddress?: string | null;
  delivery_address?: string | null;
  deliverySlot?: string | null;
  items?: { productName?: string; product_name?: string; quantity: number }[];
  deliveryPartnerId?: number | null;
  delivery_partner_id?: number | null;
  customerName?: string | null;
  customerMobile?: string | null;
  distanceKm?: number | string | null;
  distance_km?: number | string | null;
  zone?: string | null;
  /* external courier (Porter) — see backend courier.util.ts */
  deliveryProvider?: string | null;
  externalRef?: string | null;
  externalRiderName?: string | null;
  externalRiderPhone?: string | null;
  /* delivery system: shared trips + the promise made at checkout */
  tripId?: number | string | null;
  promisedAt?: string | null;
  readyAt?: string | null;
};
type Rider = { id: number; name: string; isAvailable?: boolean };

/* Each entry is ONE button. `chain` is the sequence of server transitions it
   performs, every hop legal per src/orders/order-status.machine.ts. */
const NEXT: Record<string, { chain: string[]; label: string }> = {
  order_received:       { chain: ['preparing_food'],                          label: 'Accept' },
  order_confirmed:      { chain: ['preparing_food'],                          label: 'Accept' },
  preparing_food:       { chain: ['food_ready'],                              label: 'Food ready' },
  food_ready:           { chain: ['assigned_to_delivery', 'out_for_delivery'], label: 'Assign & send out' },
  assigned_to_delivery: { chain: ['out_for_delivery'],                        label: 'Out for delivery' },
  out_for_delivery:     { chain: ['delivered'],                               label: 'Delivered' },
  arriving_soon:        { chain: ['delivered'],                               label: 'Delivered' },
};

/* Porter orders: the kitchen never picks a rider, and "Ready" means "waiting
   for the Porter driver". So Ready stays in the Ready tab, and the one tap at
   hand-over walks food_ready -> assigned_to_delivery -> out_for_delivery. The
   backend accepts assigned_to_delivery without a house rider once a courier
   is booked. */
const NEXT_PORTER: Record<string, { chain: string[]; label: string }> = {
  ...NEXT,
  preparing_food:       { chain: ['food_ready'],                              label: 'Food ready' },
  food_ready:           { chain: ['assigned_to_delivery', 'out_for_delivery'], label: 'Out for delivery' },
  assigned_to_delivery: { chain: ['out_for_delivery'],                        label: 'Out for delivery' },
};

const nextStep = (o: { status: string; deliveryProvider?: string | null }) =>
  (isExternalProvider(o.deliveryProvider) ? NEXT_PORTER : NEXT)[o.status];

/* Rider availability order for every rider picker: free, returning, waiting, out, offline. */
const STATE_ORDER: Record<string, number> = { at_kitchen: 0, returning: 1, assigned: 2, on_trip: 3, offline: 9 };

const CANCELLABLE = new Set([
  'order_received', 'order_confirmed', 'preparing_food',
  'food_ready', 'assigned_to_delivery',
]);

const TABS = [
  /* new orders sit here too (with Accept) until someone taps the pop-up */
  { key: 'preparing', label: 'Preparing',        statuses: ['order_received', 'order_confirmed', 'preparing_food'] },
  { key: 'assign',    label: 'Assign rider',     statuses: ['food_ready'] },
  { key: 'out',       label: 'Out for delivery', statuses: ['assigned_to_delivery', 'out_for_delivery', 'arriving_soon'] },
  { key: 'past',      label: 'Delivered',        statuses: ['delivered', 'cancelled'] },
];


const STATUS_LABEL: Record<string, string> = {
  order_received: 'New', order_confirmed: 'Accepted', preparing_food: 'Cooking',
  food_ready: 'Ready', assigned_to_delivery: 'Rider assigned',
  out_for_delivery: 'Out for delivery', arriving_soon: 'Arriving soon',
  delivered: 'Delivered', cancelled: 'Cancelled',
};

/** Local YYYY-MM-DD. Uses local parts, not toISOString(), which would shift
    an IST evening order back to the previous UTC day. */
const ymd = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

const PRESETS = [
  { key: 'today',  label: 'Today',      from: () => ymd(new Date()),  to: () => ymd(new Date()) },
  { key: 'yday',   label: 'Yesterday',  from: () => ymd(addDays(-1)), to: () => ymd(addDays(-1)) },
  { key: 'week',   label: 'Last 7 days', from: () => ymd(addDays(-6)), to: () => ymd(new Date()) },
  { key: 'month',  label: 'Last 30 days', from: () => ymd(addDays(-29)), to: () => ymd(new Date()) },
  { key: 'all',    label: 'All time',   from: () => '', to: () => '' },
];

const since = (iso?: string | null) => {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
};

export default function LiveOrderBoard({
  api, showToast,
}: {
  /* Structurally typed against the admin page's `api` object — only the four
     calls this board needs, so it stays usable without importing that file. */
  api: {
    genericList: (r: string) => Promise<unknown[]>;
    advanceOrderStatus: (id: number, status: string, note?: string) => Promise<unknown>;
    assignRider: (id: number, partnerId: number) => Promise<unknown>;
    listRidersForAssignment: () => Promise<unknown[]>;
    getOrderFull: (id: number) => Promise<Record<string, unknown>>;
  } & DispatchApi & TripsApi;
  showToast: (m: string) => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [tab, setTab] = useState('preparing');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [riderPick, setRiderPick] = useState<Record<number, number>>({});
  const [err, setErr] = useState('');
  const [dispatchFor, setDispatchFor] = useState<number | null>(null);
  /* dispatch: who should carry each order, and rider states */
  const [sugg, setSugg] = useState<Record<number, Suggestion>>({});
  /* "now" for render-time comparisons (late promises), refreshed every poll */
  const [now, setNow] = useState(() => Date.now());
  const [riderStates, setRiderStates] = useState<RiderStatus[]>([]);
  /* Defaults to today: a kitchen screen should show today's work, not every
     order ever placed. Presets and an explicit from/to cover the rest. */
  const [preset, setPreset] = useState('today');
  const [from, setFrom] = useState(ymd(new Date()));
  const [to, setTo] = useState(ymd(new Date()));

  const load = useCallback(async () => {
    try {
      const [o, r, d] = await Promise.all([
        api.genericList('orders'),
        api.listRidersForAssignment().catch(() => []),
        /* older backend without /delivery: the board still works without it */
        api.dispatchSuggestions().catch(() => null),
      ]);
      setOrders((o || []) as Order[]);
      setRiders((r || []) as Rider[]);
      setNow(Date.now());
      if (d) {
        const m: Record<number, Suggestion> = {};
        for (const x of d.suggestions) m[x.orderId] = x;
        setSugg(m);
        setRiderStates(d.riders);
      }
      setErr('');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Could not load orders.');
    }
  }, [api]);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) load(); });
    /* A kitchen screen left open must not go stale — new orders have to appear
       without anyone remembering to refresh. */
    const t = setInterval(() => { if (alive) load(); }, 20000);
    /* The new-order popup and the Porter sheet announce changes, so the board
       re-files the order now instead of up to 20s later. */
    const onChanged = () => { if (alive) load(); };
    window.addEventListener(ORDERS_CHANGED_EVENT, onChanged);
    return () => { alive = false; clearInterval(t); window.removeEventListener(ORDERS_CHANGED_EVENT, onChanged); };
  }, [load]);

  const inRange = useCallback((o: Order) => {
    if (!from && !to) return true;              // "All time"
    const raw = o.placedAt || o.placed_at;
    if (!raw) return false;
    const d = ymd(new Date(raw));
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }, [from, to]);

  /* Delivered tab: the chosen dates (today by default). Live tabs: every
     unfinished order, whatever day it was placed, so nothing is ever hidden. */
  const pool = useMemo(() => orders.filter(inRange), [orders, inRange]);
  const inTab = useCallback(
    (t: (typeof TABS)[number], o: Order) => t.statuses.includes(o.status) && (t.key !== 'past' || inRange(o)),
    [inRange],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of TABS) c[t.key] = orders.filter((o) => inTab(t, o)).length;
    return c;
  }, [orders, inTab]);

  const applyPreset = (key: string) => {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    setPreset(key); setFrom(p.from()); setTo(p.to());
  };

  const newCount = useMemo(
    () => orders.filter((o) => o.status === 'order_received' || o.status === 'order_confirmed').length,
    [orders],
  );

  const revenue = useMemo(
    () => pool.filter((o) => o.status === 'delivered')
              .reduce((n, o) => n + Number(o.total || 0), 0),
    [pool],
  );

  const visible = useMemo(() => {
    const t = TABS.find((x) => x.key === tab)!;
    return orders
      .filter((o) => inTab(t, o))
      .sort((a, b) => {
        const at = new Date(a.placedAt || a.placed_at || 0).getTime();
        const bt = new Date(b.placedAt || b.placed_at || 0).getTime();
        // Live tabs: oldest first, because the oldest order is the one going
        // cold. Past: newest first, because that is a lookup list.
        return tab === 'past' ? bt - at : at - bt;
      });
  }, [orders, tab, inTab]);

  const advance = async (o: Order) => {
    const step = nextStep(o);
    const porter = isExternalProvider(o.deliveryProvider);
    if (!step) return;
    setBusyId(o.id);
    try {
      /* Run the chain in order. Each hop is a separate server call because the
         state machine validates one transition at a time; if a later hop fails
         the earlier ones stand, which is correct — the order really did reach
         that stage. */
      for (const to of step.chain) {
        if (to === 'assigned_to_delivery' && !porter) {
          const reserved = Number(o.deliveryPartnerId ?? o.delivery_partner_id) || null;
          const rid = defaultRiderFor(o);
          if (rid && stateOf(rid)?.state === 'offline'
              && !confirm(`${stateOf(rid)?.name} is offline. Give them this order anyway?`)) {
            throw new Error('Pick a rider who is on shift.');
          }
          if (!rid) throw new Error('No rider available. Add one in Delivery Partners.');
          if (reserved && rid === reserved) {
            /* Rider was reserved while it cooked (it is already on their trip):
               just hand it over, don't re-plan the trip. */
            await api.advanceOrderStatus(o.id, 'assigned_to_delivery');
          } else {
            // assign-rider moves the order into assigned_to_delivery itself.
            await api.assignRider(o.id, rid);
          }
        } else {
          await api.advanceOrderStatus(o.id, to);
        }
      }
      const last = step.chain[step.chain.length - 1];
      showToast(`${o.orderNumber || o.order_number || `#${o.id}`} → ${STATUS_LABEL[last]}`);
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not update');
      await load();
    } finally { setBusyId(null); }
  };

  /* ── dispatch actions ── */
  const stateOf = (id?: number | null) => riderStates.find((r) => r.id === Number(id));

  /* Riders for a dropdown: free first, out on a trip next, offline last. */
  const ridersSorted = [...riders].sort((a, b) =>
    (STATE_ORDER[stateOf(a.id)?.state ?? 'at_kitchen'] ?? 5) - (STATE_ORDER[stateOf(b.id)?.state ?? 'at_kitchen'] ?? 5));

  /** Default rider for an order: the admin's pick, the reserved rider, the
      suggested rider, else the first rider actually available. Never an
      offline rider by accident (the old default was simply riders[0]). */
  const defaultRiderFor = (o: Order): number | undefined => {
    const reserved = Number(o.deliveryPartnerId ?? o.delivery_partner_id) || null;
    const suggested = sugg[o.id]?.riderId;
    const available = ridersSorted.find((r) => stateOf(r.id)?.state !== 'offline');
    return riderPick[o.id] ?? reserved ?? suggested ?? available?.id ?? ridersSorted[0]?.id;
  };

  /**
   * One tap = chef ticket + customer bill.
   *
   * The list payload has no line items (deliberately — 400 orders with items
   * would be a heavy response), so fetch the full order first. Both windows
   * are opened from the SAME click: browsers block a popup opened after an
   * await unless it descends from a user gesture, so the second print is
   * queued on a short timer rather than nested inside another await.
   */
  const printBoth = async (o: Order) => {
    setBusyId(o.id);
    try {
      const full = await api.getOrderFull(o.id);
      /* Same source the order-detail printer uses, so the ticket and bill
         printed here are byte-identical to the ones printed there. */
      const settings = await fetchStoreSettings().catch(() => null);
      const cfg = settings?.invoiceConfig ?? null;
      printHtml(chefTicket(full as never, cfg as never));
      // Small gap so the first print dialog is dismissed before the second.
      setTimeout(() => {
        try { printHtml(customerInvoice(full as never, cfg as never, false, { reorder: '', insta: '' })); }
        catch { showToast('Bill could not be printed'); }
      }, 700);
      showToast('Printing chef ticket + bill');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not print');
    } finally { setBusyId(null); }
  };

  const cancel = async (o: Order) => {
    if (!confirm(`Cancel ${o.orderNumber || o.order_number || `#${o.id}`}? This refunds any payment and cannot be undone.`)) return;
    setBusyId(o.id);
    try {
      await api.advanceOrderStatus(o.id, 'cancelled', 'Cancelled from order board');
      showToast('Order cancelled');
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not cancel');
    } finally { setBusyId(null); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 900, color: C.ink, margin: 0 }}>Live Orders</h2>
          <p style={{ fontSize: 12.5, color: C.muted, margin: '3px 0 0' }}>
            Accept → Food ready → Assign rider → Out for delivery → Delivered
          </p>
        </div>
        <button onClick={load} style={{
          background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10,
          padding: '8px 14px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', color: C.ink,
        }}>↻ Refresh</button>
      </div>

      {err && (
        <div style={{ background: '#fdecea', color: '#c0392b', padding: '11px 14px', borderRadius: 12, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          {err}
        </div>
      )}

      {/* date range: only for the Delivered tab */}
      {tab === 'past' && (
      <div style={{
        background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14,
        padding: '12px 14px', marginBottom: 12,
      }}>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 10 }}>
          {PRESETS.map((p) => {
            const on = preset === p.key;
            return (
              <button key={p.key} onClick={() => applyPreset(p.key)} style={{
                padding: '7px 14px', borderRadius: 18, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 12.5, fontWeight: 800,
                border: on ? `1.5px solid ${C.green}` : `1px solid ${C.line}`,
                background: on ? C.greenSoft : '#fff',
                color: on ? C.greenDeep : C.muted,
              }}>{p.label}</button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, fontWeight: 800, color: C.muted }}>From</label>
          <input type="date" value={from} max={to || undefined}
            onChange={(e) => { setFrom(e.target.value); setPreset('custom'); }}
            style={{ padding: '7px 10px', borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 12.5, fontFamily: 'inherit', color: C.ink }} />
          <label style={{ fontSize: 12, fontWeight: 800, color: C.muted }}>To</label>
          <input type="date" value={to} min={from || undefined}
            onChange={(e) => { setTo(e.target.value); setPreset('custom'); }}
            style={{ padding: '7px 10px', borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 12.5, fontFamily: 'inherit', color: C.ink }} />
          <span style={{ marginLeft: 'auto', fontSize: 12.5, color: C.muted, fontWeight: 700 }}>
            {pool.length} order{pool.length === 1 ? '' : 's'}
            {revenue > 0 && <> · <b style={{ color: C.greenDeep }}>{money(revenue)}</b> delivered</>}
          </span>
        </div>
      </div>
      )}

      {/* tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', borderBottom: `1px solid ${C.line}`, paddingBottom: 10 }}>
        {TABS.map((t) => {
          const on = t.key === tab;
          const n = counts[t.key] || 0;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} aria-pressed={on} style={{
              padding: '10px 18px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13.5, fontWeight: 800,
              border: on ? `1.5px solid ${C.dark}` : `1px solid ${C.line}`,
              background: on ? C.dark : '#fff',
              color: on ? '#fff' : C.ink,
            }}>
              {t.label} ({t.key === 'preparing' && newCount > 0 ? `${n} · ${newCount} new` : n})
            </button>
          );
        })}
      </div>

      {!visible.length && (
        <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: 34, textAlign: 'center' }}>
          <div style={{ fontSize: 34 }}>🍽️</div>
          <p style={{ fontWeight: 800, color: C.ink, margin: '8px 0 3px' }}>Nothing here</p>
          <p style={{ fontSize: 12.5, color: C.muted, margin: 0 }}>
            Orders appear in this tab as they reach that stage.
          </p>
        </div>
      )}

      {visible.map((o) => {
        const step = nextStep(o);
        const porter = isExternalProvider(o.deliveryProvider);
        const num = o.orderNumber || o.order_number || `#${o.id}`;
        const when = o.placedAt || o.placed_at;
        const addr = o.deliveryAddress || o.delivery_address;
        const busy = busyId === o.id;
        const needsRider = !porter && step?.chain.includes('assigned_to_delivery');
        const canBookPorter = !porter && o.status === 'food_ready';
        const km = Number(o.distanceKm ?? o.distance_km ?? 0);
        const area = localityOf(addr) || o.zone || null;
        const reservedId = Number(o.deliveryPartnerId ?? o.delivery_partner_id) || null;
        const reserved = reservedId ? (stateOf(reservedId)?.name || riders.find((r) => r.id === reservedId)?.name || `Rider #${reservedId}`) : null;
        const onTrip = !!o.tripId;
        const promisedAt = o.promisedAt ? new Date(o.promisedAt) : null;
        const late = !!promisedAt && promisedAt.getTime() < now && !['delivered', 'cancelled'].includes(o.status);

        return (
          <div key={o.id} style={{
            background: '#fff',
            border: `1px solid ${o.status === 'order_received' ? '#f0c9c9' : C.line}`,
            borderLeft: `4px solid ${o.status === 'order_received' ? '#c0392b' : C.green}`,
            borderRadius: 14, padding: 14, marginBottom: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 210, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 15.5, color: C.ink }}>{num}</b>
                  <span style={{
                    fontSize: 10.5, fontWeight: 900, padding: '3px 9px', borderRadius: 99,
                    background: C.greenSoft, color: C.greenDeep, textTransform: 'uppercase',
                  }}>{STATUS_LABEL[o.status] || o.status}</span>
                  <span style={{ fontSize: 11.5, color: C.muted }}>{since(when)}</span>
                  {promisedAt && !['delivered', 'cancelled'].includes(o.status) && (
                    <span title="Promised to the customer at checkout" style={{
                      fontSize: 10.5, fontWeight: 900, padding: '3px 9px', borderRadius: 99,
                      background: late ? '#fdecea' : '#eef2ef', color: late ? '#a93226' : C.muted,
                    }}>
                      {late ? 'LATE · ' : 'Promise '}{promisedAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {!!o.items?.length && (
                  <div style={{ fontSize: 12.5, color: C.ink, marginTop: 6, lineHeight: 1.5 }}>
                    {o.items.map((it, i) => (
                      <span key={i}>
                        {i > 0 && ' · '}
                        <b>{it.quantity}×</b> {it.productName || it.product_name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Who and where — the two things the kitchen asks first. */}
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 7, alignItems: 'center' }}>
                  {area && (
                    <span style={{
                      fontSize: 11, fontWeight: 900, background: C.greenSoft, color: C.greenDeep,
                      padding: '3px 9px', borderRadius: 99,
                    }}>📍 {area}</span>
                  )}
                  {km > 0 && (
                    <span style={{
                      fontSize: 11, fontWeight: 900,
                      background: km > 6 ? '#fff4e0' : '#eef2ef',
                      color: km > 6 ? '#8a6100' : C.muted,
                      padding: '3px 9px', borderRadius: 99,
                    }}>
                      🛵 {km.toFixed(1)} km{km > 6 ? ' · far' : ''}
                    </span>
                  )}
                  {o.customerName && (
                    <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 700 }}>
                      👤 {o.customerName}
                    </span>
                  )}
                  {o.customerMobile && (
                    <a href={`tel:${o.customerMobile}`} style={{
                      fontSize: 11.5, color: C.greenDeep, fontWeight: 800, textDecoration: 'none',
                    }}>📞 {o.customerMobile}</a>
                  )}
                </div>

                {addr && (
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 5, lineHeight: 1.45 }}>
                    {addr}
                  </div>
                )}
                <div style={{ fontSize: 13, fontWeight: 900, color: C.ink, marginTop: 5 }}>
                  {money(Number(o.total || 0))}
                </div>

                {reserved && !porter && (
                  <div style={{
                    marginTop: 8, display: 'inline-flex', gap: 6, alignItems: 'center',
                    background: '#e3eefc', color: '#1d4f91', borderRadius: 10, padding: '6px 10px',
                    fontSize: 12, fontWeight: 800,
                  }}>
                    🛵 {['preparing_food', 'order_confirmed', 'food_ready'].includes(o.status) ? 'Reserved for' : 'With'} {reserved}
                    {onTrip && (stateOf(reservedId)?.plannedOrders ?? 0) > 1 ? ' · shared trip' : ''}
                  </div>
                )}

                {porter && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8,
                    background: C.orangeSoft, border: '1px solid #f6d8a6', borderRadius: 10,
                    padding: '7px 10px', fontSize: 12, fontWeight: 800, color: C.orangeDeep,
                  }}>
                    <span>🛵 Porter{o.externalRef ? ` · ${o.externalRef}` : ' booked'}</span>
                    {o.externalRiderName && <span style={{ color: C.ink }}>{o.externalRiderName}</span>}
                    {o.externalRiderPhone && (
                      <a href={`tel:${o.externalRiderPhone}`} style={{ color: C.greenDeep, textDecoration: 'none' }}>
                        📞 {o.externalRiderPhone}
                      </a>
                    )}
                    {!o.externalRiderName && o.status === 'food_ready' && (
                      <span style={{ color: C.muted, fontWeight: 700 }}>waiting for driver</span>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 190 }}>
                {needsRider && (
                  <select
                    value={defaultRiderFor(o) ?? ''}
                    onChange={(e) => setRiderPick((p) => ({ ...p, [o.id]: Number(e.target.value) }))}
                    style={{
                      padding: '8px 10px', borderRadius: 9, border: `1px solid ${C.line}`,
                      fontSize: 12.5, fontFamily: 'inherit', color: C.ink,
                    }}
                  >
                    {riders.length === 0 && <option value="">No riders available</option>}
                    {ridersSorted.map((r) => {
                      const st = stateOf(r.id);
                      return <option key={r.id} value={r.id}>{r.name}{st ? ` — ${st.label}` : ''}</option>;
                    })}
                  </select>
                )}

                {step && (
                  <button onClick={() => advance(o)} disabled={busy} style={{
                    padding: '12px 16px', borderRadius: 11, border: 'none', cursor: busy ? 'default' : 'pointer',
                    background: busy ? C.muted : C.dark, color: '#fff',
                    fontSize: 13.5, fontWeight: 900, fontFamily: 'inherit',
                  }}>
                    {busy ? 'Working…' : step.label} →
                  </button>
                )}

                {canBookPorter && (
                  <button onClick={() => setDispatchFor(o.id)} disabled={busy} style={{
                    padding: '10px 14px', borderRadius: 10, cursor: busy ? 'default' : 'pointer',
                    border: `1.5px solid ${C.orange}`, background: C.orangeSoft, color: C.orangeDeep,
                    fontSize: 13, fontWeight: 900, fontFamily: 'inherit',
                  }}>🛵 Book Porter</button>
                )}
                {porter && (
                  <button onClick={() => setDispatchFor(o.id)} disabled={busy} style={{
                    padding: '9px 14px', borderRadius: 10, cursor: busy ? 'default' : 'pointer',
                    border: `1px solid #f6d8a6`, background: '#fff', color: C.orangeDeep,
                    fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit',
                  }}>📋 Porter details</button>
                )}

                <button onClick={() => printBoth(o)} disabled={busy} style={{
                  padding: '9px 14px', borderRadius: 10, cursor: busy ? 'default' : 'pointer',
                  border: `1px solid ${C.line}`, background: '#fff', color: C.ink,
                  fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit',
                }}>🖨️ Chef ticket + bill</button>

                {CANCELLABLE.has(o.status) && (
                  <button onClick={() => cancel(o)} disabled={busy} style={{
                    padding: '8px 14px', borderRadius: 10, cursor: busy ? 'default' : 'pointer',
                    border: '1px solid #f0c9c9', background: '#fdecea', color: '#c0392b',
                    fontSize: 12, fontWeight: 800, fontFamily: 'inherit',
                  }}>Cancel</button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {dispatchFor != null && (
        <DispatchSheet
          orderId={dispatchFor}
          api={api}
          showToast={showToast}
          onClose={() => setDispatchFor(null)}
        />
      )}
    </div>
  );
}
