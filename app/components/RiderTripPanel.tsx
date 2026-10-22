'use client';

/**
 * RiderTripPanel — the rider's run, in drop order (PRD: Rider app changes).
 *
 *  - Shift toggle: only online riders are offered trips.
 *  - The current trip: numbered stops, each with Navigate (Google Maps at the
 *    pin), Call, cash to collect, and whether it is delivered.
 *  - "Picked up all": one tap at the kitchen takes every bag out for delivery.
 *  - What is queued next, so the rider knows to come straight back.
 *
 * Delivering a stop (OTP, UPI QR, cash) stays on the order cards below, so
 * those flows are unchanged; this panel only adds the order and the pickup.
 */

import { useCallback, useEffect, useState } from 'react';
import { C, money } from '../lib/bite';

export type TripStop = {
  seq: number; orderId: number; orderNumber: string; status: string;
  customerName: string; customerMobile: string | null;
  address: string | null; landmark: string | null; instructions: string | null;
  lat: number | null; lng: number | null; cashToCollect: number; deliveredAt: string | null;
};
export type RiderTrip = {
  shiftStatus: 'online' | 'offline';
  trip: { id: number; status: 'planned' | 'picked_up' | 'done' | 'cancelled'; stops: TripStop[] } | null;
  next: { id: number; orders: number } | null;
};

const navUrl = (s: TripStop) =>
  s.lat != null && s.lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address || '')}`;

export default function RiderTripPanel({
  api, onChanged, refreshKey,
}: {
  api: (path: string, init?: RequestInit) => Promise<unknown>;
  /** called after pickup / shift change so the page refreshes its order cards */
  onChanged: (trip: RiderTrip | null) => void;
  /** bump to make the panel reload alongside the page's own poll */
  refreshKey: number;
}) {
  const [data, setData] = useState<RiderTrip | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const d = (await api('/delivery/riders/me/trip')) as RiderTrip;
      setData(d); setErr('');
      onChanged(d);
    } catch {
      /* older backend without trips: hide the panel, keep the app working */
      setData(null);
    }
  }, [api, onChanged]);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) return load(); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  const setShift = async (status: 'online' | 'offline') => {
    setBusy(true); setErr('');
    try { await api('/delivery/riders/me/shift', { method: 'PATCH', body: JSON.stringify({ status }) }); await load(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Could not change shift'); }
    finally { setBusy(false); }
  };

  const pickup = async () => {
    if (!data?.trip) return;
    setBusy(true); setErr('');
    try { await api(`/delivery/trips/${data.trip.id}/pickup`, { method: 'PATCH' }); await load(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Could not start the trip'); }
    finally { setBusy(false); }
  };

  if (!data) return null;
  const online = data.shiftStatus !== 'offline';
  const trip = data.trip;
  const left = trip ? trip.stops.filter((s) => !s.deliveredAt) : [];
  const nextStop = left[0];
  const allPacked = trip ? trip.stops.every((s) => ['food_ready', 'assigned_to_delivery'].includes(s.status)) : false;
  const cash = left.reduce((n, s) => n + s.cashToCollect, 0);

  return (
    <div style={{ margin: '0 14px 12px' }}>
      <style>{CSS}</style>

      <div className="rtp-shift" data-on={online ? '1' : '0'}>
        <div>
          <b>{online ? 'You are online' : 'You are offline'}</b>
          <span>{online ? 'The kitchen can give you trips.' : 'You won\'t be given new trips.'}</span>
        </div>
        <button disabled={busy} onClick={() => setShift(online ? 'offline' : 'online')}>
          {online ? 'Go offline' : 'Go online'}
        </button>
      </div>

      {trip && (
        <div className="rtp-card">
          <div className="rtp-head">
            <div>
              <div className="rtp-eyebrow">
                {trip.status === 'planned' ? 'Your next trip' : 'On the road'}
              </div>
              <div className="rtp-title">
                {trip.stops.length} {trip.stops.length === 1 ? 'drop' : 'drops'}
                {trip.status === 'picked_up' && ` · ${left.length} left`}
              </div>
            </div>
            {cash > 0 && <div className="rtp-cash">Collect {money(cash)}</div>}
          </div>

          <ol className="rtp-stops">
            {trip.stops.map((s) => {
              const done = !!s.deliveredAt;
              const isNext = !done && s === nextStop && trip.status === 'picked_up';
              return (
                <li key={s.orderId} data-done={done ? '1' : '0'} data-next={isNext ? '1' : '0'}>
                  <span className="rtp-num">{done ? '✓' : s.seq}</span>
                  <div className="rtp-body">
                    <div className="rtp-line">
                      <b>{s.customerName}</b>
                      <span className="rtp-ord">{s.orderNumber}</span>
                      {!done && (s.cashToCollect > 0
                        ? <span className="rtp-chip rtp-chip-cash">Cash {money(s.cashToCollect)}</span>
                        : <span className="rtp-chip">Prepaid</span>)}
                    </div>
                    {s.address && <div className="rtp-addr">{s.address}</div>}
                    {s.landmark && <div className="rtp-addr">Landmark: {s.landmark}</div>}
                    {s.instructions && <div className="rtp-note">“{s.instructions}”</div>}
                    {!done && (
                      <div className="rtp-acts">
                        <a href={navUrl(s)} target="_blank" rel="noopener noreferrer" className="rtp-nav">Navigate ↗</a>
                        {s.customerMobile && <a href={`tel:${s.customerMobile}`} className="rtp-call">Call</a>}
                        {trip.status === 'planned' && !['food_ready', 'assigned_to_delivery'].includes(s.status) && (
                          <span className="rtp-wait">Still cooking</span>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {trip.status === 'planned' && (
            <button className="rtp-pick" disabled={busy || !allPacked} onClick={pickup}>
              {busy ? 'Starting…' : allPacked ? `Picked up all ${trip.stops.length} — start trip` : 'Waiting for the kitchen…'}
            </button>
          )}
          {trip.status === 'picked_up' && nextStop && (
            <p className="rtp-hint">Deliver <b>{nextStop.orderNumber}</b> next. Mark it delivered with the customer&apos;s OTP below.</p>
          )}
        </div>
      )}

      {data.next && (
        <div className="rtp-next">Next trip waiting at the kitchen: {data.next.orders} order{data.next.orders === 1 ? '' : 's'}. Come straight back.</div>
      )}
      {err && <div className="rtp-err">{err}</div>}
    </div>
  );
}

const CSS = `
.rtp-shift{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 13px;border-radius:14px;
  background:#fdecea;border:1px solid #f3c6c0;margin-bottom:10px}
.rtp-shift[data-on="1"]{background:${C.greenSoft};border-color:#cfe6d1}
.rtp-shift b{display:block;font-size:13.5px;color:${C.ink}}
.rtp-shift span{font-size:11.5px;color:${C.muted}}
.rtp-shift button{padding:9px 13px;border-radius:10px;border:1px solid ${C.line};background:#fff;font-weight:800;
  font-size:12.5px;color:${C.ink};font-family:inherit;cursor:pointer;white-space:nowrap}
.rtp-card{background:#fff;border:1px solid ${C.line};border-top:4px solid ${C.green};border-radius:16px;padding:13px}
.rtp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px}
.rtp-eyebrow{font-size:10.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:${C.greenDeep}}
.rtp-title{font-size:17px;font-weight:900;color:${C.ink}}
.rtp-cash{background:#fdecea;color:#a93226;font-weight:900;font-size:12.5px;padding:6px 10px;border-radius:99px;white-space:nowrap}
.rtp-stops{list-style:none;margin:0;padding:0}
.rtp-stops li{display:flex;gap:11px;padding:10px 0;border-top:1px dashed ${C.line}}
.rtp-stops li:first-child{border-top:none}
.rtp-stops li[data-done="1"]{opacity:.5}
.rtp-stops li[data-next="1"] .rtp-num{background:${C.orange};color:#1f1300}
.rtp-num{flex:none;width:28px;height:28px;border-radius:99px;background:${C.dark};color:#fff;display:grid;place-items:center;
  font-weight:900;font-size:13px}
.rtp-body{flex:1;min-width:0}
.rtp-line{display:flex;gap:7px;align-items:center;flex-wrap:wrap;font-size:13.5px;color:${C.ink}}
.rtp-ord{font-size:11.5px;color:${C.muted};font-weight:700}
.rtp-chip{font-size:10.5px;font-weight:900;padding:2px 8px;border-radius:99px;background:${C.greenSoft};color:${C.greenDeep}}
.rtp-chip-cash{background:#fdecea;color:#a93226}
.rtp-addr{font-size:12px;color:${C.muted};margin-top:2px;line-height:1.4}
.rtp-note{font-size:12px;color:#8a6100;margin-top:3px;font-weight:700}
.rtp-acts{display:flex;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap}
.rtp-nav,.rtp-call{padding:8px 12px;border-radius:10px;font-size:12.5px;font-weight:800;text-decoration:none}
.rtp-nav{background:${C.dark};color:#fff}
.rtp-call{background:#fff;border:1px solid ${C.line};color:${C.greenDeep}}
.rtp-wait{font-size:11.5px;font-weight:800;color:#8a6100}
.rtp-pick{width:100%;margin-top:10px;padding:14px;border:none;border-radius:13px;background:${C.green};color:#fff;
  font-size:15px;font-weight:900;font-family:inherit;cursor:pointer}
.rtp-pick:disabled{background:${C.muted};cursor:default}
.rtp-hint{font-size:12.5px;color:${C.muted};margin:10px 0 0;line-height:1.45}
.rtp-next{margin-top:10px;padding:10px 12px;border-radius:12px;background:${C.orangeSoft};color:${C.orangeDeep};
  font-size:12.5px;font-weight:800}
.rtp-err{margin-top:10px;padding:9px 11px;border-radius:10px;background:#fdecea;color:#a93226;font-size:12.5px;font-weight:700}
`;
