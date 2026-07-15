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
  cashCap?: number; cashCapReached?: boolean; cashHeadroom?: number;
  history: { orderId: number; orderNumber?: string; baseFare: number;
    distancePay: number; tip: number; total: number; createdAt: string;
    orderValue?: number; walletUsed?: number; paymentMethod?: string; cashToCollect?: number }[];
}

/** Rider session token, minted by POST /delivery-partners/login. */
function riderToken(): string {
  try {
    const raw = localStorage.getItem(LS_RIDER);
    return raw ? (JSON.parse(raw)?.token || '') : '';
  } catch { return ''; }
}

async function api(path: string, init?: RequestInit) {
  const token = riderToken();
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      /* P0-1/P0-3: the backend now derives the rider id from THIS token, not
         from an id in the body or the URL. */
      ...(token ? { 'x-rider-token': token } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    // token expired or revoked — force a clean re-login
    localStorage.removeItem(LS_RIDER);
    throw new Error('Your shift session expired. Please sign in again.');
  }
  if (!res.ok) throw new Error(Array.isArray(data?.message) ? data.message[0] : data?.message || 'Request failed');
  return data;
}

type QrState = {
  orderId: number; qrId: string; imageUrl: string; amount: number; closeBy: string;
} | null;

export default function RiderPage() {
  const [rider, setRider] = useState<Rider | null>(null);
  const [qr, setQr] = useState<QrState>(null);
  const [qrPaid, setQrPaid] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  /* #54/#63: OTP entry was a raw window.prompt() — ugly, easy to mistype, no
     feedback, and blocked by some in-app browsers. Replaced with a real modal. */
  const [otpFor, setOtpFor] = useState<number | null>(null);
  const [otpVal, setOtpVal] = useState('');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<ApiOrder[]>([]);
  const [mine, setMine] = useState<ApiOrder[]>([]);
  const [completed, setCompleted] = useState<ApiOrder[]>([]); // #13/#16 delivered history
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
      const [avail, own, earn, done] = await Promise.all([
        api('/orders/available-for-riders'),
        api(`/orders?deliveryPartnerId=${r.id}&active=true`),
        api(`/delivery-partners/${r.id}/earnings`).catch(() => null),
        /* #13/#16: the rider's delivered orders (all their orders minus the
           active ones) so they have a real completed-deliveries history. */
        api(`/orders?deliveryPartnerId=${r.id}`).catch(() => []),
      ]);
      setAvailable(avail);
      setMine(own);
      if (earn) setEarnings(earn);
      setCompleted(
        (Array.isArray(done) ? done : []).filter((o: ApiOrder) => o.status === 'delivered'),
      );
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
  /* ── Doorstep UPI QR ───────────────────────────────────────────────────
     Rider taps "Pay online". We mint a fixed-amount, single-use QR server-side
     and poll until the money lands. The rider never handles cash, so their
     cash-in-hand never moves. */
  async function showQr(id: number) {
    setQrBusy(true); setErr(''); setQrPaid(false);
    try {
      const r = await api(`/orders/${id}/collect/qr`, { method: 'POST' });
      setQr({ orderId: id, qrId: r.qrId, imageUrl: r.imageUrl, amount: r.amount, closeBy: r.closeBy });
    } catch (e: any) { setErr(e.message); } finally { setQrBusy(false); }
  }

  async function cancelQr() {
    if (!qr) return;
    setQrBusy(true);
    try { await api(`/orders/${qr.orderId}/collect/cancel`, { method: 'POST' }); }
    catch { /* closing is best-effort */ }
    finally { setQr(null); setQrPaid(false); setQrBusy(false); }
  }

  /* Poll while the QR is on screen. The backend also asks Razorpay directly if
     the webhook is slow — a rider can't stand at a door waiting on our queue. */
  useEffect(() => {
    if (!qr || qrPaid) return;
    const t = setInterval(async () => {
      try {
        const s = await api(`/orders/${qr.orderId}/collect/status`);
        if (s?.paid) { setQrPaid(true); clearInterval(t); }
      } catch { /* keep polling */ }
    }, 3000);
    return () => clearInterval(t);
  }, [qr, qrPaid]);

  async function setStatus(id: number, status: string, note?: string) {
    if (!rider) return;
    /* P0-1: identity now travels in the signed x-rider-token header (see api()).
       deliveryPartnerId is NOT a credential — it's a sequential id the customer
       can already see on their tracking page. */
    const body: Record<string, unknown> = { status, note };
    if (status === 'delivered') {
      /* #54/#63: open the OTP modal; the actual call happens in submitOtp(). */
      setErr(''); setOtpVal(''); setOtpFor(id);
      return;
    }
    setBusy(true); setErr('');
    try {
      await api(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) });
      /* #63: as soon as delivery succeeds, drop the order from the active list
         so the "Mark delivered" button can't be clicked again (and re-prompt
         OTP) in the moment before refresh completes. */
      if (status === 'delivered') {
        setMine((list) => list.filter((o) => o.id !== id));
      }
      await refresh(rider);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  /* #54/#63: deliver with a properly-entered OTP (4 digits, validated,
     with inline errors instead of a native prompt). */
  async function submitOtp() {
    if (!rider || otpFor == null) return;
    const otp = otpVal.trim();
    if (!/^\d{4}$/.test(otp)) { setErr('Enter the 4-digit OTP from the customer.'); return; }
    const body: Record<string, unknown> = { status: 'delivered', otp };
    if (lastPos.current) {
      body.riderLat = lastPos.current.lat;
      body.riderLng = lastPos.current.lng;
    }
    setBusy(true); setErr('');
    try {
      await api(`/orders/${otpFor}/status`, { method: 'PATCH', body: JSON.stringify(body) });
      const doneId = otpFor;
      setOtpFor(null); setOtpVal('');
      setMine((list) => list.filter((o) => o.id !== doneId));
      await refresh(rider);
    } catch (e: any) {
      setErr(e.message || 'Wrong OTP — please check with the customer.');
    } finally { setBusy(false); }
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
          {(() => {
            const cap = Number(earnings.cashCap ?? 0);
            const blockedNow = !!earnings.cashCapReached;
            const near = cap > 0 && !blockedNow && earnings.cashInHand >= cap * 0.7;
            /* Show the wall BEFORE the rider hits it. Being refused an order
               mid-shift with no warning is how you lose good riders. */
            const skin = blockedNow
              ? { bg: '#fdecea', bd: '#f5c6c2', tint: '#a32d2d' }
              : near
                ? { bg: '#fff8e6', bd: '#f3e3b3', tint: '#854f0b' }
                : { bg: '#fff8e6', bd: '#f3e3b3', tint: C.ink };
            return (
              <div style={{ background: skin.bg, border: `1px solid ${skin.bd}`, borderRadius: 12, padding: 10, fontSize: 12.5 }}>
                <div style={{ color: skin.tint }}>
                  💵 <b>COD cash in hand: {money(earnings.cashInHand)}</b>
                  {cap > 0 && <span style={{ color: C.muted }}> / {money(cap)} limit</span>}
                </div>
                {cap > 0 && (
                  <div style={{ height: 5, background: '#00000012', borderRadius: 3, margin: '7px 0 5px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, (earnings.cashInHand / cap) * 100)}%`,
                      background: blockedNow ? '#a32d2d' : near ? '#ba7517' : C.green,
                    }} />
                  </div>
                )}
                {blockedNow ? (
                  <div style={{ color: '#a32d2d', fontWeight: 700, marginTop: 2 }}>
                    Cash limit reached — no new cash orders until you deposit.
                    You can still take prepaid orders.
                  </div>
                ) : near ? (
                  <div style={{ color: '#854f0b', marginTop: 2 }}>
                    {money(Number(earnings.cashHeadroom ?? 0))} left before cash orders pause. Deposit soon.
                  </div>
                ) : (
                  <div style={{ color: C.muted, marginTop: 2 }}>
                    Collected {money(earnings.codCollected)} · Deposited {money(earnings.codDeposited)} — deposit at the kitchen.
                  </div>
                )}
              </div>
            );
          })()}
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
            {(o.status === 'out_for_delivery' || o.status === 'arriving_soon')
              && Number((o as any).cashToCollect ?? 0) > 0 && (
              <button style={btn('#0d47a1')} disabled={busy || qrBusy}
                onClick={() => showQr(o.id)}>
                📱 Pay online (UPI QR)
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

      {/* #13/#16: completed deliveries history */}
      <div style={{ margin: '18px 14px 8px', fontWeight: 800, fontSize: 14, color: C.ink }}>
        Completed deliveries ({completed.length})
      </div>
      {completed.length === 0 ? (
        <div style={{ ...card, color: C.muted, fontSize: 13 }}>No completed deliveries yet.</div>
      ) : (
        completed.map((o) => (
          <div key={o.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <b style={{ fontSize: 13.5 }}>{o.orderNumber}</b>
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#fff', background: C.green,
                padding: '2px 9px', borderRadius: 20,
              }}>Delivered</span>
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              📍 {o.deliveryAddress || 'Address on order'}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              Order {money(Number(o.total))}
              {(o as any).deliveredAt && ` · ${new Date((o as any).deliveredAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
            </div>
          </div>
        ))
      )}
      {/* ── Doorstep UPI QR ── */}
      {qr && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, padding: 22, width: '100%',
            maxWidth: 340, textAlign: 'center',
          }}>
            {qrPaid ? (
              <>
                <div style={{ fontSize: 56 }}>✅</div>
                <h3 style={{ margin: '10px 0 4px', color: C.greenDeep }}>Payment received</h3>
                <p style={{ color: C.muted, fontSize: 14, margin: '0 0 18px' }}>
                  ₹{qr.amount} paid online. <b>Do not collect cash.</b>
                </p>
                <button
                  style={{ ...btn(C.green), width: '100%' }}
                  disabled={busy}
                  onClick={async () => {
                    const id = qr.orderId;
                    setQr(null); setQrPaid(false);
                    await setStatus(id, 'delivered', 'Delivered — paid by UPI QR');
                  }}>
                  ✅ Mark delivered
                </button>
              </>
            ) : (
              <>
                <h3 style={{ margin: '0 0 2px', color: C.ink }}>Scan to pay</h3>
                <div style={{ fontSize: 30, fontWeight: 800, color: C.ink, margin: '2px 0 10px' }}>
                  ₹{qr.amount}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr.imageUrl} alt="UPI QR code" width={220} height={220}
                  style={{ width: 220, height: 220, objectFit: 'contain' }} />
                <p style={{ color: C.muted, fontSize: 13, margin: '10px 0 4px' }}>
                  Customer scans with any UPI app. This screen updates by itself.
                </p>
                <p style={{ color: C.muted, fontSize: 12, margin: '0 0 16px' }}>
                  Amount is locked — they cannot pay more or less.
                </p>
                <button
                  style={{ ...btn('#b0bec5'), width: '100%' }}
                  disabled={qrBusy}
                  onClick={cancelQr}>
                  Cancel — take cash instead
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* #54/#63: OTP entry modal — replaces the raw window.prompt() */}
      {otpFor != null && (
        <div
          onClick={() => { if (!busy) { setOtpFor(null); setErr(''); } }}
          style={{
            position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(4,22,15,.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 20, padding: 22, width: '100%', maxWidth: 340,
              boxShadow: '0 20px 50px rgba(0,0,0,.35)',
            }}
          >
            <div style={{ fontSize: 30, textAlign: 'center' }}>🔐</div>
            <div style={{ fontWeight: 850, fontSize: 17, color: C.ink, textAlign: 'center', marginTop: 6 }}>
              Delivery OTP
            </div>
            <div style={{ fontSize: 12.5, color: C.muted, textAlign: 'center', marginTop: 4 }}>
              Ask the customer for the 4-digit code on their tracking screen.
            </div>
            <input
              value={otpVal}
              onChange={(e) => setOtpVal(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={(e) => { if (e.key === 'Enter' && otpVal.length === 4) submitOtp(); }}
              inputMode="numeric"
              autoFocus
              placeholder="0000"
              style={{
                width: '100%', marginTop: 16, textAlign: 'center', letterSpacing: 10,
                fontSize: 26, fontWeight: 850, color: C.ink, padding: '12px 0',
                border: `2px solid ${otpVal.length === 4 ? C.green : C.line}`,
                borderRadius: 14, outline: 'none',
              }}
            />
            {err && (
              <div style={{ color: '#c62828', fontSize: 12.5, fontWeight: 700, textAlign: 'center', marginTop: 8 }}>
                {err}
              </div>
            )}
            <button
              onClick={submitOtp}
              disabled={busy || otpVal.length !== 4}
              style={{
                ...btn(otpVal.length === 4 ? C.green : '#c5d3cb'),
                width: '100%', marginTop: 14, fontSize: 15,
                cursor: otpVal.length === 4 && !busy ? 'pointer' : 'not-allowed',
              }}
            >
              {busy ? 'Verifying…' : 'Confirm delivery'}
            </button>
            <button
              onClick={() => { setOtpFor(null); setErr(''); }}
              disabled={busy}
              style={{
                width: '100%', marginTop: 8, background: 'none', border: 'none',
                color: C.muted, fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 8,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
