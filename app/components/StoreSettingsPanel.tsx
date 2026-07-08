'use client';

/**
 * StoreSettingsPanel — admin control room for everything that used to be
 * hardcoded: delivery charge, free-delivery threshold, min/max order value,
 * per-day kitchen hours, holidays, and an emergency force-close switch.
 *
 * Drop into the admin console: add a 'settings' NAV item and render this
 * when page === 'settings' (see FRONTEND-PATCHES.md §5).
 *
 * Writes PATCH /settings with the x-admin-key header — protected by your
 * existing global AdminWriteGuard, no new auth code needed.
 */

import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/bite';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Monday' }, { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' }, { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' }, { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

interface DayHours { open: string; close: string; closed: boolean }
interface Holiday { date: string; note?: string }
interface Settings {
  deliveryCharge: number; freeDeliveryAbove: number;
  minOrderAmount: number; maxOrderAmount: number;
  weeklyHours: Record<DayKey, DayHours>;
  holidays: Holiday[];
  forceClosed: boolean; closedMessage: string; timezone: string;
  /* restaurant location + distance pricing */
  storeLat: number | null; storeLng: number | null; storeAddress: string;
  deliveryRadiusKm: number; avgPrepMinutes: number; avgRiderKmph: number;
  baseDeliveryCharge: number; perKmCharge: number; freeDeliveryWithinKm: number;
}

const G = '#0D3B2E', GREEN = '#2e7d32', AMBER = '#b76e00', LINE = '#e4ebe6';

export default function StoreSettingsPanel({
  adminHeaders,
}: {
  /** pass () => ({ 'x-admin-key': getAdminKey() }) from the admin page */
  adminHeaders: () => Record<string, string>;
}) {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [live, setLive] = useState<{ open: boolean; message: string } | null>(null);
  const [newHoliday, setNewHoliday] = useState({ date: '', note: '' });

  async function load() {
    const [a, b] = await Promise.all([
      fetch(`${API_BASE}/settings`, { cache: 'no-store' }),
      fetch(`${API_BASE}/settings/status`, { cache: 'no-store' }),
    ]);
    if (a.ok) {
      const d = await a.json();
      setS({
        deliveryCharge: Number(d.deliveryCharge) || 0,
        freeDeliveryAbove: Number(d.freeDeliveryAbove) || 0,
        minOrderAmount: Number(d.minOrderAmount) || 0,
        maxOrderAmount: Number(d.maxOrderAmount) || 0,
        weeklyHours: d.weeklyHours || {},
        holidays: Array.isArray(d.holidays) ? d.holidays : [],
        forceClosed: !!d.forceClosed,
        closedMessage: d.closedMessage || '',
        timezone: d.timezone || 'Asia/Kolkata',
        storeLat: d.storeLat != null ? Number(d.storeLat) : null,
        storeLng: d.storeLng != null ? Number(d.storeLng) : null,
        storeAddress: d.storeAddress || '',
        deliveryRadiusKm: Number(d.deliveryRadiusKm) || 8,
        avgPrepMinutes: Number(d.avgPrepMinutes) || 20,
        avgRiderKmph: Number(d.avgRiderKmph) || 20,
        baseDeliveryCharge: Number(d.baseDeliveryCharge) || 20,
        perKmCharge: Number(d.perKmCharge) || 8,
        freeDeliveryWithinKm: Number(d.freeDeliveryWithinKm) || 2,
      });
    }
    if (b.ok) setLive(await b.json());
  }
  useEffect(() => { load(); }, []);

  async function save(patch?: Partial<Settings>) {
    if (!s) return;
    setSaving(true); setMsg('');
    try {
      const body = { ...s, ...(patch || {}) };
      const r = await fetch(`${API_BASE}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.message || 'Save failed');
      setMsg('✓ Saved — live for all customers immediately');
      await load();
    } catch (e: any) {
      setMsg('✗ ' + (e.message || 'Could not save'));
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 3500);
    }
  }

  if (!s) return <div style={{ padding: 24, color: '#888' }}>Loading settings…</div>;

  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setS({ ...s, [k]: Number(e.target.value) || 0 });

  const setDay = (d: DayKey, patch: Partial<DayHours>) =>
    setS({
      ...s,
      weeklyHours: {
        ...s.weeklyHours,
        [d]: { ...{ open: '10:00', close: '23:00', closed: false }, ...s.weeklyHours[d], ...patch },
      },
    });

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 11px', border: `1.5px solid ${LINE}`,
    borderRadius: 10, fontSize: 13, color: G, outline: 'none',
  };
  const card: React.CSSProperties = {
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14,
    padding: 18, marginBottom: 16,
  };
  const h: React.CSSProperties = { fontWeight: 800, fontSize: 14, color: G, marginBottom: 4 };
  const sub: React.CSSProperties = { fontSize: 12, color: '#6b7d74', marginBottom: 14 };

  return (
    <div style={{ maxWidth: 760 }}>
      {/* live status strip */}
      {live && (
        <div style={{
          ...card, display: 'flex', alignItems: 'center', gap: 10,
          background: live.open ? '#e8f5e9' : '#fdecec',
          border: `1px solid ${live.open ? '#c6e6c8' : '#f5c6c6'}`,
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: live.open ? GREEN : '#c62828', flex: 'none',
          }} />
          <div style={{ fontSize: 13, color: G }}>
            <b>{live.open ? 'Kitchen is OPEN' : 'Kitchen is CLOSED'}</b>
            {!live.open && live.message ? ` — customers see: “${live.message}”` : ' — taking orders right now'}
          </div>
        </div>
      )}

      {/* emergency force close */}
      <div style={{ ...card, borderLeft: `4px solid ${s.forceClosed ? '#c62828' : LINE}` }}>
        <div style={h}>🚨 Emergency close</div>
        <div style={sub}>Flip this when the kitchen must stop instantly (gas out, staff shortage). Overrides all hours.</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: G, fontWeight: 600, cursor: 'pointer' }}>
          <input type="checkbox" checked={s.forceClosed}
            onChange={(e) => setS({ ...s, forceClosed: e.target.checked })} />
          Stop taking orders now
        </label>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: '#6b7d74', marginBottom: 5 }}>Message customers see while closed</div>
          <input style={inputStyle} value={s.closedMessage}
            onChange={(e) => setS({ ...s, closedMessage: e.target.value })}
            placeholder="We're taking a short break. Back soon!" />
        </div>
      </div>

      {/* pricing */}
      <div style={card}>
        <div style={h}>💰 Delivery & order limits</div>
        <div style={sub}>Applied server-side to every checkout the moment you save. Set max to 0 for no upper limit.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {([
            ['deliveryCharge', 'Delivery charge (₹)'],
            ['freeDeliveryAbove', 'Free delivery above (₹)'],
            ['minOrderAmount', 'Minimum order (₹)'],
            ['maxOrderAmount', 'Maximum order (₹)'],
          ] as [keyof Settings, string][]).map(([k, label]) => (
            <div key={k}>
              <div style={{ fontSize: 12, color: '#6b7d74', marginBottom: 5 }}>{label}</div>
              <input type="number" min={0} style={inputStyle} value={s[k] as number} onChange={num(k)} />
            </div>
          ))}
        </div>
      </div>

      {/* location + distance pricing (audit §2.1 / §5.4) */}
      <div style={card}>
        <div style={h}>📍 Restaurant location & distance pricing</div>
        <div style={sub}>
          Set the kitchen&apos;s coordinates to unlock delivery-radius rejection,
          distance-based charges and real ETAs. Get lat/lng by right-clicking your
          kitchen on Google Maps → the numbers copy to clipboard.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7d74', marginBottom: 5 }}>Kitchen latitude</div>
            <input type="number" step="any" style={inputStyle} value={s.storeLat ?? ''}
              onChange={(e) => setS({ ...s, storeLat: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7d74', marginBottom: 5 }}>Kitchen longitude</div>
            <input type="number" step="any" style={inputStyle} value={s.storeLng ?? ''}
              onChange={(e) => setS({ ...s, storeLng: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, color: '#6b7d74', marginBottom: 5 }}>Kitchen address (shown on tracking map)</div>
            <input style={inputStyle} value={s.storeAddress}
              onChange={(e) => setS({ ...s, storeAddress: e.target.value })} />
          </div>
          {([
            ['deliveryRadiusKm', 'Delivery radius (km)'],
            ['freeDeliveryWithinKm', 'Free delivery within (km)'],
            ['baseDeliveryCharge', 'Base delivery charge (₹)'],
            ['perKmCharge', 'Charge per km (₹)'],
            ['avgPrepMinutes', 'Avg prep time (min)'],
            ['avgRiderKmph', 'Avg rider speed (km/h)'],
          ] as [keyof Settings, string][]).map(([k, label]) => (
            <div key={k}>
              <div style={{ fontSize: 12, color: '#6b7d74', marginBottom: 5 }}>{label}</div>
              <input type="number" min={0} step="any" style={inputStyle} value={(s[k] as number) ?? 0} onChange={num(k)} />
            </div>
          ))}
        </div>
      </div>

      {/* weekly hours */}
      <div style={card}>
        <div style={h}>⏰ Kitchen hours</div>
        <div style={sub}>Per-day open/close. Orders outside these hours are blocked with the next opening time shown.</div>
        {DAYS.map(({ key, label }) => {
          const d = s.weeklyHours[key] || { open: '10:00', close: '23:00', closed: false };
          return (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              borderBottom: `1px dashed ${LINE}`, opacity: d.closed ? 0.55 : 1,
            }}>
              <div style={{ width: 92, fontSize: 13, fontWeight: 700, color: G }}>{label}</div>
              <input type="time" value={d.open} disabled={d.closed}
                onChange={(e) => setDay(key, { open: e.target.value })}
                style={{ ...inputStyle, width: 118 }} />
              <span style={{ color: '#9fb0a8', fontSize: 12 }}>to</span>
              <input type="time" value={d.close} disabled={d.closed}
                onChange={(e) => setDay(key, { close: e.target.value })}
                style={{ ...inputStyle, width: 118 }} />
              <label style={{ marginLeft: 'auto', fontSize: 12, color: AMBER, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={d.closed}
                  onChange={(e) => setDay(key, { closed: e.target.checked })} /> Closed
              </label>
            </div>
          );
        })}
      </div>

      {/* holidays */}
      <div style={card}>
        <div style={h}>🎉 Holidays</div>
        <div style={sub}>Kitchen stays closed all day on these dates. Customers see the note and the next opening time.</div>
        {s.holidays.length === 0 && (
          <div style={{ fontSize: 13, color: '#9fb0a8', padding: '4px 0 10px' }}>No holidays added. Add your first one below.</div>
        )}
        {s.holidays.map((hd, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13, color: G }}>
            <b>{hd.date}</b><span style={{ color: '#6b7d74' }}>{hd.note || '—'}</span>
            <button
              onClick={() => setS({ ...s, holidays: s.holidays.filter((_, j) => j !== i) })}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
              Remove
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input type="date" style={{ ...inputStyle, width: 160 }} value={newHoliday.date}
            onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })} />
          <input style={inputStyle} placeholder="Note e.g. Diwali (optional)" value={newHoliday.note}
            onChange={(e) => setNewHoliday({ ...newHoliday, note: e.target.value })} />
          <button
            disabled={!newHoliday.date}
            onClick={() => {
              setS({ ...s, holidays: [...s.holidays, { ...newHoliday }] });
              setNewHoliday({ date: '', note: '' });
            }}
            style={{
              padding: '9px 16px', border: 'none', borderRadius: 10, fontWeight: 700,
              background: newHoliday.date ? G : '#dfe7e2', color: '#fff', cursor: newHoliday.date ? 'pointer' : 'default',
              whiteSpace: 'nowrap',
            }}>
            Add holiday
          </button>
        </div>
      </div>

      {/* save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 30 }}>
        <button onClick={() => save()} disabled={saving} style={{
          padding: '12px 26px', border: 'none', borderRadius: 12, fontWeight: 800,
          fontSize: 14, background: '#F59E0B', color: '#3d2a00', cursor: 'pointer',
          boxShadow: '0 6px 18px rgba(245,158,11,.3)',
        }}>
          {saving ? 'Saving…' : 'Save all settings'}
        </button>
        {msg && <span style={{ fontSize: 13, fontWeight: 700, color: msg.startsWith('✓') ? GREEN : '#c62828' }}>{msg}</span>}
      </div>
    </div>
  );
}
