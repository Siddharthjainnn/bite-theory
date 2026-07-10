'use client';

/**
 * /rider — Delivery partner portal (mobile-first).
 * Login by registered mobile → see unclaimed "ready" orders → Accept
 * (atomic, first-come-first-served) → phone auto-pings GPS every 15s
 * while a delivery is active (this is what moves the customer's map)
 * → Navigate via Google Maps → Picked up → Delivered.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { C, money, API_BASE, ApiOrder } from '../lib/bite';

const PING_MS = 15000;
const REFRESH_MS = 12000;
const LS_RIDER = 'bt_rider_v1';

interface Rider {
  id: number; name: string; mobile: string; vehicleNo?: string; isAvailable?: boolean;
}

interface RiderEarnings {
  today: { amount: number; deliveries: number };
  week: { amount: number; deliveries: number };
  cashInHand: number; codCollected: number; codDeposited: number;
  history: { orderId: number; orderNumber?: string; baseFare: number;
    distancePay: number; tip: number; total: number; createdAt: string;
    orderValue?: number; walletUsed?: number; paymentMethod?: string; cashToCollect?: number }[];
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' }, cache: 'no-store', ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(Array.isArray(data?.message) ? data.message[0] : data?.message || 'Request failed');
  return data;
}

export default function RiderPage() {
  const [rider, setRider] = useState<Rider | null>(null);
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<ApiOrder[]>([]);
  const [mine, setMine] = useState<ApiOrder[]>([]);
  const [gpsOn, setGpsOn] = useState(false);
  const [earnings, setEarnings] = useState<RiderEarnings | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const watchId = useRef<number | null>(null);
  const lastPing = useRef(0);
  const lastPos = useRef<{ lat: number; lng: number } | null>(null);

  /* restore session */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_RIDER);
      if (raw) setRider(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const refresh = useCallback(async (r: Rider) => {
    try {
      const [avail, own, earn] = await Promise.all([
        api('/orders/available-for-riders'),
        api(`/orders?deliveryPartnerId=${r.id}&active=true`),
        api(`/delivery-partners/${r.id}/earnings`).catch(() => null),
      ]);
      setAvailable(avail);
      setMine(own);
      if (earn) setEarnings(earn);
    } catch { /* transient */ }
  }, []);

  /* poll feeds */
  useEffect(() => {
    if (!rider) return;
    refresh(rider);
    const t = setInterval(() => refresh(rider), REFRESH_MS);
    return () => clearInterval(t);
  }, [rider, refresh]);

  /* GPS ping while any active delivery */
  useEffect(() => {
    const active = mine.some((o) =>
      ['assigned_to_delivery', 'out_for_delivery', 'arriving_soon'].includes(o.status));
    if (!rider || !active) {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      setGpsOn(false);
      return;
    }
    if (watchId.current != null) return; // already watching
    if (!navigator.geolocation) return;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsOn(true);
        lastPos.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const now = Date.now();
        if (now - lastPing.current < PING_MS) return; // throttle
        lastPing.current = now;
        api(`/delivery-partners/${rider.id}/location`, {
          method: 'PATCH',
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        }).catch(() => { /* retry next ping */ });
      },
      () => setGpsOn(false),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [rider, mine]);

  async function login() {
    setErr(''); setBusy(true);
    try {
      const r = await api('/delivery-partners/login', {
        method: 'POST', body: JSON.stringify({ mobile, code }),
      });
      setRider(r);
      localStorage.setItem(LS_RIDER, JSON.stringify(r));
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  function logout() {
    localStorage.removeItem(LS_RIDER);
    setRider(null); setMine([]); setAvailable([]);
  }
  async function accept(id: number) {
    if (!rider) return;
    setBusy(true); setErr('');
    try {
      await api(`/orders/${id}/accept`, { method: 'POST', body: JSON.stringify({ partnerId: rider.id }) });
      await refresh(rider);
    } catch (e: any) { setErr(e.message); await refresh(rider); } finally { setBusy(false); }
  }
  async function setStatus(id: number, status: string, note?: string) {
    if (!rider) return;
    /* C1: prove which rider is acting so the backend can confirm this rider
       is actually assigned to the order before allowing the change. */
    const body: Record<string, unknown> = { status, note, deliveryPartnerId: rider.id };
    if (status === 'delivered') {
      /* §4.5 handoff proof: customer reads the 4-digit OTP from their tracking page */
      const otp = window.prompt('Ask the customer for their 4-digit delivery OTP:');
      if (otp == null) return; // rider cancelled
      body.otp = otp.trim();
      if (lastPos.current) {
        body.riderLat = lastPos.current.lat;
        body.riderLng = lastPos.current.lng;
      }
    }
    setBusy(true); setErr('');
    try {
      await api(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) });
      await refresh(rider);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  const page: React.CSSProperties = {
    minHeight: '100vh', background: C.bg, fontFamily: 'system-ui, sans-serif',
    maxWidth: 480, margin: '0 auto', padding: '0 0 40px',
  };
  const card: React.CSSProperties = {
    background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16,
    padding: 14, margin: '0 14px 12px',
  };
  const btn = (bg: string, color = '#fff'): React.CSSProperties => ({
    background: bg, color, border: 'none', borderRadius: 10, padding: '11px 16px',
    fontWeight: 800, fontSize: 13, cursor: 'pointer', width: '100%',
  });

  /* ── login screen ── */
  if (!rider) {
    return (
      <div style={page}>
        <div style={{ background: C.dark, color: '#fff', padding: '26px 20px', borderRadius: '0 0 24px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 26 }}>🛵</div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>Bites Theory Rider</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>Deliver happiness, one bite at a time</div>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Rider login</div>
          <input
            style={{ width: '100%', border: `1px solid ${C.line}`, borderRadius: 10, padding: '11px 12px', fontSize: 14, marginBottom: 10 }}
            placeholder="Registered mobile number"
            inputMode="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />
          <input
            style={{ width: '100%', border: `1px solid ${C.line}`, borderRadius: 10, padding: '11px 12px', fontSize: 14, marginBottom: 10 }}
            placeholder="Access code"
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button style={btn(C.green)} onClick={login} disabled={busy || mobile.trim().length < 10}>
            {busy ? 'Checking…' : 'Login'}
          </button>
          {err && <div style={{ color: '#c0392b', fontSize: 12.5, marginTop: 8, fontWeight: 600 }}>{err}</div>}
        </div>
      </div>
    );
  }

  /* ── dashboard ── */
  return (
    <div style={page}>
      <div style={{ background: C.dark, color: '#fff', padding: '18px 20px', borderRadius: '0 0 24px 24px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>🛵 {rider.name}</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            {rider.vehicleNo || 'Rider'} · GPS {gpsOn ? '🟢 live' : '⚪ idle'}
          </div>
        </div>
        <button onClick={logout} style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          Logout
        </button>
      </div>

      {err && <div style={{ ...card, color: '#c0392b', fontWeight: 600, fontSize: 13 }}>{err}</div>}

      {/* ── earnings (§4.2) + COD cash (§4.3) + history (§4.4) ── */}
      {earnings && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <b style={{ fontSize: 14 }}>💰 My earnings</b>
            <button onClick={() => setShowHistory((v) => !v)}
              style={{ background: 'none', border: 'none', color: C.greenDeep, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {showHistory ? 'Hide history' : 'History ▾'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ background: '#e8f5e9', borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 11, color: C.muted }}>Today · {earnings.today.deliveries} deliveries</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: C.greenDeep }}>{money(earnings.today.amount)}</div>
            </div>
            <div style={{ background: '#f2f6f3', borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 11, color: C.muted }}>This week · {earnings.week.deliveries} deliveries</div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{money(earnings.week.amount)}</div>
            </div>
          </div>
          <div style={{ background: '#fff8e6', border: '1px solid #f3e3b3', borderRadius: 12, padding: 10, fontSize: 12.5 }}>
            💵 <b>COD cash in hand: {money(earnings.cashInHand)}</b>
            <div style={{ color: C.muted, marginTop: 2 }}>
              Collected {money(earnings.codCollected)} · Deposited {money(earnings.codDeposited)} — deposit at the kitchen.
            </div>
          </div>
          {showHistory && (
            <div style={{ marginTop: 10 }}>
              {earnings.history.length === 0 && (
                <div style={{ fontSize: 12.5, color: C.muted }}>No completed deliveries yet.</div>
              )}
              {earnings.history.map((h) => (
                <div key={h.orderId} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.line}`, fontSize: 12.5 }}>
                  <div>
                    <b>{h.orderNumber || `#${h.orderId}`}</b>
                    <div style={{ color: C.muted, fontSize: 11 }}>
                      {new Date(h.createdAt).toLocaleString()}
                      {/* Bug #64/#65: show this order's real value + how it was paid,
                          so deliveries no longer all look identical. */}
                      {h.orderValue != null && ` · order ${money(Number(h.orderValue))}`}
                      {h.paymentMethod && ` · ${h.paymentMethod === 'cod' ? 'COD' : 'Online'}`}
                      {/* Bug #61: only show cash-to-collect when there's actually
                          cash to collect (COD with a non-zero balance). */}
                      {h.paymentMethod === 'cod' && Number(h.cashToCollect) > 0 &&
                        ` · collect ${money(Number(h.cashToCollect))}`}
                    </div>
                    <div style={{ color: C.muted, fontSize: 11 }}>
                      Your payout: fare {money(Number(h.baseFare))}
                      {Number(h.distancePay) > 0 && ` + dist ${money(Number(h.distancePay))}`}
                      {Number(h.tip) > 0 && ` + tip ${money(Number(h.tip))} 💚`}
                    </div>
                  </div>
                  <b style={{ color: C.greenDeep }}>{money(Number(h.total))}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* my active deliveries */}
      <div style={{ margin: '0 14px 8px', fontWeight: 800, fontSize: 14, color: C.ink }}>
        My deliveries ({mine.length})
      </div>
      {mine.length === 0 && (
        <div style={{ ...card, color: C.muted, fontSize: 13 }}>No active delivery. Accept one below 👇</div>
      )}
      {mine.map((o) => (
        <div key={o.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <b style={{ fontSize: 14 }}>{o.orderNumber}</b>
            <b style={{ color: C.greenDeep }}>{money(Number(o.total))}</b>
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 10 }}>
            📍 {o.deliveryAddress || 'Address on order'}
            {Number((o as any).tip) > 0 && (
              <span style={{ display: 'inline-block', marginLeft: 6, background: '#e8f5e9', color: C.greenDeep, borderRadius: 8, padding: '2px 7px', fontWeight: 700 }}>
                💚 ₹{Number((o as any).tip)} tip for you
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {o.deliveryLat != null && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${o.deliveryLat},${o.deliveryLng}`}
                target="_blank" rel="noreferrer"
                style={{ ...btn('#fff', C.greenDeep), border: `1px solid ${C.green}`, textAlign: 'center', textDecoration: 'none', display: 'block' }}
              >
                🧭 Navigate
              </a>
            )}
            {o.status === 'assigned_to_delivery' && (
              <button style={btn(C.orange)} disabled={busy}
                onClick={() => setStatus(o.id, 'out_for_delivery', 'Rider picked up the order')}>
                📦 Picked up — start delivery
              </button>
            )}
            {o.status === 'out_for_delivery' && (
              <button style={btn('#7b1fa2')} disabled={busy}
                onClick={() => setStatus(o.id, 'arriving_soon', 'Rider arriving soon')}>
                📍 Arriving soon
              </button>
            )}
            {(o.status === 'out_for_delivery' || o.status === 'arriving_soon') && (
              <button style={btn(C.green)} disabled={busy}
                onClick={() => setStatus(o.id, 'delivered', 'Delivered to customer')}>
                ✅ Mark delivered
              </button>
            )}
          </div>
        </div>
      ))}

      {/* available pool */}
      <div style={{ margin: '14px 14px 8px', fontWeight: 800, fontSize: 14, color: C.ink }}>
        Available orders ({available.length})
      </div>
      {available.length === 0 && (
        <div style={{ ...card, color: C.muted, fontSize: 13 }}>Nothing to pick up right now. This list refreshes automatically.</div>
      )}
      {available.map((o) => (
        <div key={o.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <b style={{ fontSize: 14 }}>{o.orderNumber}</b>
            <b style={{ color: C.greenDeep }}>{money(Number(o.total))}</b>
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 10 }}>
            📍 {o.deliveryAddress || 'Address on order'} · {o.status === 'food_ready' ? '🍱 Ready now' : '👨‍🍳 Preparing'}
          </div>
          <button style={btn(C.green)} disabled={busy} onClick={() => accept(o.id)}>
            ✋ Accept this delivery
          </button>
        </div>
      ))}
    </div>
  );
}
