'use client';

/**
 * NewOrderPopup — the order that just came in, with the decision in it.
 *
 * History: a full-screen modal used to do this and was removed because it
 * seized the whole console. This is the same job without the seizure: a card
 * pinned bottom-right (bottom sheet on phones) that does not block the page.
 * It stays, and the bell keeps ringing, until someone Accepts or Rejects.
 *
 * After Accept it turns into a dispatch prompt: book the Porter NOW, while
 * the food cooks, so the driver arrives as the bag is sealed.
 */

import { useEffect, useState } from 'react';
import { C, money } from '../lib/bite';
import { localityOf } from '../lib/dispatch';

export type PopupOrder = {
  id: number;
  orderNumber: string;
  total: number;
  placedAt: string;
  customerName?: string | null;
  customerMobile?: string | null;
  deliveryAddress?: string | null;
  zone?: string | null;
  distanceKm?: number | null;
  /** takeaway: the outlet the customer collects from (null = delivery) */
  pickupOutletName?: string | null;
};

type Full = {
  items?: { productName?: string; quantity: number }[];
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  cookingNote?: string | null;
  deliveryInstructions?: string | null;
};

const ago = (iso: string) => {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`;
};

export function NewOrderPopup({
  order, waiting, loadFull, onAccept, onReject, onOpenBoard, onSilence, ringing,
}: {
  order: PopupOrder;
  /** other new orders behind this one */
  waiting: number;
  loadFull: (id: number) => Promise<Full>;
  onAccept: (o: PopupOrder) => Promise<void>;
  onReject: (o: PopupOrder) => Promise<void>;
  onOpenBoard: () => void;
  onSilence: () => void;
  ringing: boolean;
}) {
  const [full, setFull] = useState<Full | null>(null);
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const [err, setErr] = useState('');
  const [, tick] = useState(0);
  /* On desktop the card sits over the board's action column; minimising tucks it
     into a pill without losing the order (the bell keeps ringing). */
  const [mini, setMini] = useState(false);

  useEffect(() => {
    /* Parent keys this component by order id, so state starts fresh per order. */
    let alive = true;
    loadFull(order.id).then((f) => { if (alive) setFull(f); }).catch(() => { /* summary still shows */ });
    const t = setInterval(() => tick((n) => n + 1), 30000); // keep "x min ago" honest
    return () => { alive = false; clearInterval(t); };
  }, [order.id, loadFull]);

  const run = async (kind: 'accept' | 'reject') => {
    setBusy(kind); setErr('');
    try { await (kind === 'accept' ? onAccept(order) : onReject(order)); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Could not update the order'); }
    finally { setBusy(null); }
  };

  const cod = full?.paymentMethod === 'cod' && full?.paymentStatus !== 'paid';
  const km = Number(order.distanceKm || 0);
  /* Same locality lookup as the board; the pincode zone is a fallback, and
     "Unknown zone" tells the kitchen nothing, so it is not shown. */
  const pickupAt = order.pickupOutletName || null;
  const area = pickupAt ? null : localityOf(order.deliveryAddress)
    || (order.zone && !/unknown/i.test(order.zone) ? order.zone : null);

  if (mini) {
    return (
      <button className="nop-pill" onClick={() => setMini(false)} aria-label={`Show new order ${order.orderNumber}`}>
        <style>{CSS}</style>
        <span className="nop-dot" data-ring={ringing ? '1' : '0'} />
        New {pickupAt ? 'takeaway' : 'order'} {order.orderNumber} · {money(order.total)}{waiting > 0 ? ` · +${waiting}` : ''}
      </button>
    );
  }

  return (
    <div className="nop-wrap" role="alertdialog" aria-live="assertive" aria-label={`New order ${order.orderNumber}`}>
      <style>{CSS}</style>
      <div className="nop-head">
        <span className="nop-dot" data-ring={ringing ? '1' : '0'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="nop-eyebrow">New {pickupAt ? 'takeaway' : 'order'}{waiting > 0 ? ` · ${waiting} more waiting` : ''}</div>
          <div className="nop-title">{order.orderNumber} <span className="nop-ago">{ago(order.placedAt)}</span></div>
        </div>
        <div className="nop-total">{money(order.total)}</div>
        <button className="nop-x" onClick={() => setMini(true)} aria-label="Minimise">–</button>
      </div>

      <div className="nop-body">
        <div className="nop-chips">
          {full && (
            <span className="nop-chip" data-tone={cod ? 'red' : 'green'}>
              {cod ? (pickupAt ? '💵 Pay at counter' : '💵 Cash on delivery') : '✓ Paid online'}
            </span>
          )}
          {pickupAt && <span className="nop-chip" data-tone="amber">🛍️ Takeaway · {pickupAt}</span>}
          {area && <span className="nop-chip">📍 {area}</span>}
          {km > 0 && <span className="nop-chip" data-tone={km > 6 ? 'amber' : undefined}>🛵 {km.toFixed(1)} km</span>}
        </div>

        {(order.customerName || order.customerMobile) && (
          <div className="nop-line">
            👤 <b>{order.customerName || 'Customer'}</b>
            {order.customerMobile && <> · <a href={`tel:${order.customerMobile}`}>{order.customerMobile}</a></>}
          </div>
        )}
        {order.deliveryAddress && !pickupAt && <div className="nop-addr">{order.deliveryAddress}</div>}

        <div className="nop-items">
          {!full && <div className="nop-skel" />}
          {full?.items?.map((it, i) => (
            <div key={i}><b>{it.quantity}×</b> {it.productName}</div>
          ))}
        </div>
        {full?.cookingNote && <div className="nop-note">👨‍🍳 {full.cookingNote}</div>}

        {err && <div className="nop-err">{err}</div>}
      </div>

      <div className="nop-actions">
        <button className="nop-accept" onClick={() => run('accept')} disabled={!!busy}>
          {busy === 'accept' ? 'Accepting…' : 'Accept & start cooking'}
        </button>
        <button className="nop-reject" onClick={() => run('reject')} disabled={!!busy}>
          {busy === 'reject' ? '…' : 'Reject'}
        </button>
      </div>
      <div className="nop-sub">
        <button onClick={onOpenBoard}>Open Live Orders</button>
        {ringing && <button onClick={onSilence}>🔕 Silence</button>}
      </div>
    </div>
  );
}

/** Shown right after Accept: book the driver while the food cooks. */
export function DispatchPrompt({
  orderNumber, onBookPorter, onLater,
}: {
  orderNumber: string;
  onBookPorter: () => void;
  onLater: () => void;
}) {
  return (
    <div className="nop-wrap nop-compact" role="status">
      <style>{CSS}</style>
      <div className="nop-head">
        <span className="nop-check">✓</span>
        <div style={{ flex: 1 }}>
          <div className="nop-eyebrow" style={{ color: C.greenDeep }}>Accepted · cooking</div>
          <div className="nop-title">{orderNumber}</div>
        </div>
        <button className="nop-x" onClick={onLater} aria-label="Dismiss">✕</button>
      </div>
      <p className="nop-hint">
        No rider free? Book the Porter now — it takes 8–15 minutes to arrive, about as long as the food takes.
      </p>
      <div className="nop-actions">
        <button className="nop-porter" onClick={onBookPorter}>🛵 Book Porter now</button>
        <button className="nop-reject" onClick={onLater}>Own rider</button>
      </div>
    </div>
  );
}

const CSS = `
.nop-wrap{position:fixed;right:18px;bottom:18px;z-index:150;width:360px;max-width:calc(100vw - 24px);
  background:#fff;border-radius:18px;border:1px solid ${C.line};border-top:4px solid #c0392b;
  box-shadow:0 22px 50px rgba(13,59,46,.28);overflow:hidden;animation:nopIn .32s cubic-bezier(.2,.9,.3,1.15)}
.nop-compact{border-top-color:${C.green}}
.nop-head{display:flex;align-items:center;gap:11px;padding:13px 15px 9px}
.nop-dot{width:12px;height:12px;border-radius:99px;background:#c0392b;flex:none}
.nop-dot[data-ring="1"]{animation:nopPulse 1.1s ease-out infinite}
.nop-check{width:26px;height:26px;border-radius:99px;background:${C.greenSoft};color:${C.greenDeep};
  display:grid;place-items:center;font-weight:900;flex:none}
.nop-eyebrow{font-size:10.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:#c0392b}
.nop-title{font-size:16.5px;font-weight:900;color:${C.ink};margin-top:1px}
.nop-ago{font-size:11.5px;font-weight:700;color:${C.muted};margin-left:4px}
.nop-total{font-size:17px;font-weight:900;color:${C.ink}}
.nop-x{width:30px;height:30px;border-radius:9px;border:1px solid ${C.line};background:#fff;cursor:pointer;color:${C.muted}}
.nop-body{padding:0 15px 10px}
.nop-pill{position:fixed;right:18px;bottom:18px;z-index:150;display:flex;align-items:center;gap:9px;
  padding:12px 16px;border-radius:99px;border:none;background:${C.dark};color:#fff;font-size:13px;font-weight:900;
  font-family:inherit;cursor:pointer;box-shadow:0 14px 32px rgba(13,59,46,.35);animation:nopIn .25s ease-out}
.nop-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.nop-chip{font-size:11px;font-weight:900;padding:3px 9px;border-radius:99px;background:#eef2ef;color:${C.muted}}
.nop-chip[data-tone="green"]{background:${C.greenSoft};color:${C.greenDeep}}
.nop-chip[data-tone="red"]{background:#fdecea;color:#a93226}
.nop-chip[data-tone="amber"]{background:#fff4e0;color:#8a6100}
.nop-line{font-size:12.5px;color:${C.ink}}
.nop-line a{color:${C.greenDeep};font-weight:800;text-decoration:none}
.nop-addr{font-size:11.5px;color:${C.muted};margin-top:3px;line-height:1.45}
.nop-items{margin-top:9px;padding:9px 11px;background:${C.bg};border-radius:11px;font-size:13px;color:${C.ink};
  line-height:1.6;max-height:132px;overflow-y:auto}
.nop-skel{height:38px;border-radius:8px;background:linear-gradient(90deg,#e7ece8 25%,#f4f6f3 50%,#e7ece8 75%);
  background-size:200% 100%;animation:nopShim 1.2s infinite}
.nop-note{margin-top:7px;font-size:12px;color:#8a6100;font-weight:700}
.nop-err{margin-top:8px;padding:8px 10px;border-radius:9px;background:#fdecea;color:#a93226;font-size:12px;font-weight:700}
.nop-hint{font-size:12.5px;color:${C.muted};margin:0 15px 10px;line-height:1.5}
.nop-actions{display:flex;gap:8px;padding:0 15px 10px}
.nop-accept,.nop-porter{flex:1;padding:13px 14px;border:none;border-radius:12px;font-size:14px;font-weight:900;
  cursor:pointer;font-family:inherit;transition:transform .12s}
.nop-accept{background:${C.green};color:#fff;box-shadow:0 6px 16px rgba(76,175,80,.35)}
.nop-porter{background:${C.orange};color:#1f1300;box-shadow:0 6px 16px rgba(245,158,11,.35)}
.nop-accept:active,.nop-porter:active{transform:scale(.98)}
.nop-accept:disabled{opacity:.7;cursor:default}
.nop-reject{padding:13px 14px;border-radius:12px;border:1px solid ${C.line};background:#fff;color:${C.ink};
  font-size:13px;font-weight:800;cursor:pointer;font-family:inherit}
.nop-sub{display:flex;justify-content:space-between;padding:8px 15px 12px;border-top:1px solid ${C.line}}
.nop-sub button{background:none;border:none;font-size:12px;font-weight:800;color:${C.muted};cursor:pointer;
  font-family:inherit;padding:4px 0}
@media (max-width:640px){
  .nop-wrap{right:0;left:0;bottom:0;width:auto;max-width:none;border-radius:20px 20px 0 0;
    padding-bottom:env(safe-area-inset-bottom)}
}
@keyframes nopIn{from{opacity:0;transform:translateY(24px) scale(.97)}to{opacity:1;transform:none}}
@keyframes nopPulse{0%{box-shadow:0 0 0 0 rgba(192,57,43,.55)}100%{box-shadow:0 0 0 12px rgba(192,57,43,0)}}
@keyframes nopShim{from{background-position:200% 0}to{background-position:-200% 0}}
@media (prefers-reduced-motion:reduce){.nop-wrap,.nop-dot,.nop-skel{animation:none!important}}
`;
