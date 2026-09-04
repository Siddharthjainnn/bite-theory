'use client';

/**
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
import { C, money } from '../lib/bite';

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
};
type Rider = { id: number; name: string; isAvailable?: boolean };

/* Each entry is ONE button. `chain` is the sequence of server transitions it
   performs, every hop legal per src/orders/order-status.machine.ts. */
const NEXT: Record<string, { chain: string[]; label: string }> = {
  order_received:       { chain: ['preparing_food'],                          label: 'Accept' },
  order_confirmed:      { chain: ['preparing_food'],                          label: 'Accept' },
  preparing_food:       { chain: ['food_ready'],                              label: 'Food ready' },
  food_ready:           { chain: ['assigned_to_delivery', 'out_for_delivery'], label: 'Picked up' },
  assigned_to_delivery: { chain: ['out_for_delivery'],                        label: 'Picked up' },
  out_for_delivery:     { chain: ['delivered'],                               label: 'Delivered' },
  arriving_soon:        { chain: ['delivered'],                               label: 'Delivered' },
};

const CANCELLABLE = new Set([
  'order_received', 'order_confirmed', 'preparing_food',
  'food_ready', 'assigned_to_delivery',
]);

const TABS = [
  { key: 'new',       label: 'New',         statuses: ['order_received', 'order_confirmed'] },
  { key: 'preparing', label: 'Preparing',   statuses: ['preparing_food'] },
  { key: 'ready',     label: 'Ready',       statuses: ['food_ready'] },
  { key: 'picked',    label: 'Picked Up',   statuses: ['assigned_to_delivery', 'out_for_delivery', 'arriving_soon'] },
  { key: 'past',      label: 'Past Orders', statuses: ['delivered', 'cancelled'] },
];

const STATUS_LABEL: Record<string, string> = {
  order_received: 'New', order_confirmed: 'Accepted', preparing_food: 'Cooking',
  food_ready: 'Ready', assigned_to_delivery: 'Rider assigned',
  out_for_delivery: 'Out for delivery', arriving_soon: 'Arriving soon',
  delivered: 'Delivered', cancelled: 'Cancelled',
};

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
  };
  showToast: (m: string) => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [tab, setTab] = useState('new');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [riderPick, setRiderPick] = useState<Record<number, number>>({});
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const [o, r] = await Promise.all([
        api.genericList('orders'),
        api.listRidersForAssignment().catch(() => []),
      ]);
      setOrders((o || []) as Order[]);
      setRiders((r || []) as Rider[]);
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
    return () => { alive = false; clearInterval(t); };
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of TABS) c[t.key] = orders.filter((o) => t.statuses.includes(o.status)).length;
    return c;
  }, [orders]);

  const visible = useMemo(() => {
    const t = TABS.find((x) => x.key === tab)!;
    return orders
      .filter((o) => t.statuses.includes(o.status))
      .sort((a, b) => {
        const at = new Date(a.placedAt || a.placed_at || 0).getTime();
        const bt = new Date(b.placedAt || b.placed_at || 0).getTime();
        // Live tabs: oldest first, because the oldest order is the one going
        // cold. Past: newest first, because that is a lookup list.
        return tab === 'past' ? bt - at : at - bt;
      });
  }, [orders, tab]);

  const advance = async (o: Order) => {
    const step = NEXT[o.status];
    if (!step) return;
    setBusyId(o.id);
    try {
      /* Run the chain in order. Each hop is a separate server call because the
         state machine validates one transition at a time; if a later hop fails
         the earlier ones stand, which is correct — the order really did reach
         that stage. */
      for (const to of step.chain) {
        if (to === 'assigned_to_delivery') {
          const rid = riderPick[o.id] ?? riders[0]?.id;
          if (!rid) throw new Error('No rider available. Add one in Delivery Partners.');
          // assign-rider moves the order into assigned_to_delivery itself.
          await api.assignRider(o.id, rid);
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
            Four taps from new order to delivered. Refreshes every 20 seconds.
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

      {/* tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', borderBottom: `1px solid ${C.line}`, paddingBottom: 10 }}>
        {TABS.map((t) => {
          const on = t.key === tab;
          const n = counts[t.key] || 0;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '9px 16px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 800,
              border: on ? `1.5px solid ${C.green}` : `1px solid ${C.line}`,
              background: on ? C.greenSoft : '#fff',
              color: on ? C.greenDeep : C.muted,
            }}>
              {t.label}
              {n > 0 && (
                <span style={{
                  marginLeft: 7, fontSize: 11, fontWeight: 900,
                  background: t.key === 'new' ? '#c0392b' : (on ? C.greenDeep : C.muted),
                  color: '#fff', borderRadius: 99, padding: '1px 7px',
                }}>{n}</span>
              )}
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
        const step = NEXT[o.status];
        const num = o.orderNumber || o.order_number || `#${o.id}`;
        const when = o.placedAt || o.placed_at;
        const addr = o.deliveryAddress || o.delivery_address;
        const busy = busyId === o.id;
        const needsRider = step?.chain.includes('assigned_to_delivery');

        return (
          <div key={o.id} style={{
            background: '#fff', border: `1px solid ${o.status === 'order_received' ? '#f0c9c9' : C.line}`,
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

                {addr && (
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4, lineHeight: 1.45 }}>
                    📍 {addr}
                  </div>
                )}
                <div style={{ fontSize: 13, fontWeight: 900, color: C.ink, marginTop: 5 }}>
                  {money(Number(o.total || 0))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 190 }}>
                {needsRider && (
                  <select
                    value={riderPick[o.id] ?? riders[0]?.id ?? ''}
                    onChange={(e) => setRiderPick((p) => ({ ...p, [o.id]: Number(e.target.value) }))}
                    style={{
                      padding: '8px 10px', borderRadius: 9, border: `1px solid ${C.line}`,
                      fontSize: 12.5, fontFamily: 'inherit', color: C.ink,
                    }}
                  >
                    {riders.length === 0 && <option value="">No riders available</option>}
                    {riders.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
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
    </div>
  );
}
