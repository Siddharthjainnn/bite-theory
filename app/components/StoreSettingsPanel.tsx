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
  /* GST — all default OFF; nothing changes until you actually register */
  gstEnabled: boolean; gstRate: number; gstOnDelivery: boolean;
  gstInclusive: boolean; invoicePrefix: string; hsnCode: string;
  /* Ask Bhaiya intro */
  bhaiyaIntroEnabled: boolean; bhaiyaIntroFrequency: string;
  baseDeliveryCharge: number; perKmCharge: number; freeDeliveryWithinKm: number;
  riderBaseFare: number; riderPerKmPay: number;
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

  /* ── Bugs #19/#55: a running flash deal (e.g. "50% OFF sab pe") was visible
     to customers with NO admin control to see or stop it. The backend already
     had POST /flash/stop — there was simply no UI.

     NOTE: these hooks MUST live above the `if (!s) return …` guard below.
     They were originally added underneath it, so on the first render (settings
     still loading) they never ran, and once settings arrived React saw MORE
     hooks than the previous render and crashed the whole page with
     "Rendered more hooks than during the previous render." — that was the
     admin Store Settings white screen. */
  const [flash, setFlash] = useState<any>(null);
  const [flashBusy, setFlashBusy] = useState(false);
  async function loadFlash() {
    try {
      const r = await fetch(`${API_BASE}/flash/current`, { cache: 'no-store' });
      setFlash(r.ok ? await r.json() : null);
    } catch { setFlash(null); }
  }
  useEffect(() => { loadFlash(); }, []);
  async function stopFlash() {
    if (!confirm('Stop the running flash deal for all customers?')) return;
    setFlashBusy(true);
    try {
      const r = await fetch(`${API_BASE}/flash/stop`, { method: 'POST', headers: adminHeaders() });
      if (!r.ok) throw new Error();
      await loadFlash();
    } catch { alert('Could not stop the flash deal.'); }
    finally { setFlashBusy(false); }
  }

  const [loadErr, setLoadErr] = useState('');
  async function load() {
    /* Bug #91 — a single failed fetch left this stuck on "Loading settings…"
       forever with no error and no retry. Fail loudly, offer a Retry. */
    setLoadErr('');
    let a: Response, b: Response;
    try {
      [a, b] = await Promise.all([
        fetch(`${API_BASE}/settings`, { cache: 'no-store' }),
        fetch(`${API_BASE}/settings/status`, { cache: 'no-store' }),
      ]);
    } catch {
      setLoadErr('Could not reach the server. Check your connection and retry.');
      return;
    }
    if (!a.ok) setLoadErr(`Settings failed to load (HTTP ${a.status}).`);
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
        riderBaseFare: Number(d.riderBaseFare) || 20,
        riderPerKmPay: Number(d.riderPerKmPay) || 5,
        /* GST — default to OFF/safe values so an un-migrated backend (columns
           not yet added) reads as "not registered" rather than undefined. */
        gstEnabled: Boolean(d.gstEnabled),
        gstRate: Number(d.gstRate ?? 5),
        gstOnDelivery: Boolean(d.gstOnDelivery),
        gstInclusive: d.gstInclusive === undefined || d.gstInclusive === null ? true : Boolean(d.gstInclusive),
        invoicePrefix: d.invoicePrefix || 'BT',
        hsnCode: d.hsnCode || '996331',
        /* default ON so an un-migrated backend behaves exactly as before */
        bhaiyaIntroEnabled: d.bhaiyaIntroEnabled === undefined || d.bhaiyaIntroEnabled === null
          ? true : Boolean(d.bhaiyaIntroEnabled),
        bhaiyaIntroFrequency: d.bhaiyaIntroFrequency || 'daily',
      });
    }
    if (b.ok) setLive(await b.json());
  }
  useEffect(() => { load(); }, []);

  async function save(patch?: Partial<Settings>) {
    if (!s) return;
    setSaving(true); setMsg('');
    try {
      const merged: any = { ...s, ...(patch || {}) };
      // #97: coerce any field left empty back to a number before saving
      for (const k of Object.keys(merged)) {
        if (merged[k] === '') merged[k] = 0;
      }
      const body = merged;
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

  if (!s) {
    return (
      <div style={{ padding: 24, color: '#888' }}>
        {loadErr ? (
          <div>
            <div style={{ color: '#c62828', fontWeight: 700, marginBottom: 10 }}>⚠️ {loadErr}</div>
            <button onClick={() => load()} style={{
              background: GREEN, color: '#fff', border: 'none', borderRadius: 10,
              padding: '10px 18px', fontWeight: 800, fontSize: 13, cursor: 'pointer',
            }}>↻ Retry</button>
          </div>
        ) : 'Loading settings…'}
      </div>
    );
  }

  /* Bug #97 — Number(value)||0 snapped the field back to 0 the instant it was
     cleared, so admins could never wipe the default and type fresh digits.
     An empty field now STAYS empty while editing; save() coerces '' → 0. */
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setS({ ...s, [k]: (raw === '' ? '' : Number(raw)) as any });
  };

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
      {/* running flash deal — visible + stoppable (bugs #19/#55) */}
      {flash && flash.id && (
        <div style={{
          ...card, display: 'flex', alignItems: 'center', gap: 12,
          background: '#fff7e6', border: '1px solid #ffd591',
        }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <div style={{ flex: 1, fontSize: 13, color: G }}>
            <b>Flash deal running — {Number(flash.discountPct)}% OFF everything</b>
            <div style={{ color: '#8a6d3b', fontSize: 12, marginTop: 2 }}>
              {flash.title ? `“${flash.title}” · ` : ''}
              ends {new Date(flash.endsAt).toLocaleString('en-IN')}
              {' '}— this discount applies to every customer order right now.
            </div>
          </div>
          <button
            onClick={stopFlash}
            disabled={flashBusy}
            style={{
              background: '#c62828', color: '#fff', border: 'none', borderRadius: 10,
              padding: '9px 16px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer',
              opacity: flashBusy ? .6 : 1, flex: 'none',
            }}
          >
            {flashBusy ? 'Stopping…' : 'Stop deal'}
          </button>
        </div>
      )}
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

      {/* ── Ask Bhaiya intro ── */}
      <div style={card}>
        <div style={h}>🧪 Ask Bhaiya intro</div>
        <div style={{ fontSize: 12, color: '#6b7d74', marginBottom: 12, lineHeight: 1.6 }}>
          The goal-picker popup that greets customers on the home page.
          Turning this off does <b>not</b> remove the feature — the
          <b> Ask Bhaiya</b> button in the header always works, so customers can
          still open it whenever they want.
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={s.bhaiyaIntroEnabled !== false}
            onChange={(e) => setS({ ...s, bhaiyaIntroEnabled: e.target.checked })}
          />
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>
            Show the intro automatically on the home page
          </span>
        </label>

        {s.bhaiyaIntroEnabled !== false && (
          <div style={{ marginLeft: 26 }}>
            <div style={{ fontSize: 12, color: '#6b7d74', marginBottom: 5 }}>How often per customer</div>
            <select
              value={s.bhaiyaIntroFrequency || 'daily'}
              onChange={(e) => setS({ ...s, bhaiyaIntroFrequency: e.target.value })}
              style={{ ...inputStyle, maxWidth: 260 }}
            >
              <option value="once">Once ever — first visit only</option>
              <option value="daily">Once a day (recommended)</option>
              <option value="always">Every visit — launch week only</option>
            </select>
            <div style={{ fontSize: 11, color: '#9aa8a0', marginTop: 6, lineHeight: 1.5 }}>
              <b>Every visit</b> gets attention but annoys regulars fast — use it for a
              launch, then move to Daily or Once.
            </div>
          </div>
        )}

        {s.bhaiyaIntroEnabled === false && (
          <div style={{
            marginLeft: 26, fontSize: 12, color: '#8a5a00',
            background: '#fff6e8', border: '1px solid #ffd591',
            borderRadius: 8, padding: '8px 11px',
          }}>
            Customers now reach Bhaiya only by tapping the ✨ button in the header.
          </div>
        )}
      </div>

      {/* ── GST (bug: tax was hardcoded to 0 on every order) ── */}
      <div style={card}>
        <div style={h}>🧾 GST &amp; tax invoice</div>
        <div style={{ fontSize: 12, color: '#6b7d74', marginBottom: 12, lineHeight: 1.6 }}>
          Leave this OFF until you are GST-registered. Once ON, every new order records
          its tax and gets a sequential tax-invoice number (e.g. <b>BT/2026-27/0001</b>).
          Past orders are never changed.
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={!!s.gstEnabled}
            onChange={(e) => setS({ ...s, gstEnabled: e.target.checked })}
          />
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>
            GST registered — charge and declare GST
          </span>
        </label>

        {s.gstEnabled && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: '#6b7d74', marginBottom: 5 }}>GST rate (%)</div>
                <input type="number" min={0} max={28} step={0.5} style={inputStyle}
                  value={s.gstRate}
                  onChange={(e) => setS({ ...s, gstRate: Number(e.target.value) })} />
                <div style={{ fontSize: 11, color: '#9aa8a0', marginTop: 4 }}>
                  Restaurants are usually 5% (no input credit)
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6b7d74', marginBottom: 5 }}>Invoice prefix</div>
                <input style={inputStyle} value={s.invoicePrefix || ''}
                  onChange={(e) => setS({ ...s, invoicePrefix: e.target.value })} />
                <div style={{ fontSize: 11, color: '#9aa8a0', marginTop: 4 }}>
                  BT → BT/2026-27/0001
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6b7d74', marginBottom: 5 }}>HSN / SAC code</div>
                <input style={inputStyle} value={s.hsnCode || ''}
                  onChange={(e) => setS({ ...s, hsnCode: e.target.value })} />
                <div style={{ fontSize: 11, color: '#9aa8a0', marginTop: 4 }}>
                  996331 = restaurant service
                </div>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 14 }}>
              <input type="checkbox" checked={s.gstInclusive !== false}
                onChange={(e) => setS({ ...s, gstInclusive: e.target.checked })} />
              <span style={{ fontSize: 13 }}>
                Menu prices already include GST <b>(recommended)</b>
              </span>
            </label>
            <div style={{ fontSize: 11.5, color: '#9aa8a0', margin: '4px 0 10px 26px', lineHeight: 1.5 }}>
              ON: a ₹100 dish stays ₹100 and ₹4.76 of it is declared as tax — customers pay the same.<br />
              OFF: 5% is <b>added</b> on top, so that ₹100 dish becomes ₹105 at checkout.
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!s.gstOnDelivery}
                onChange={(e) => setS({ ...s, gstOnDelivery: e.target.checked })} />
              <span style={{ fontSize: 13 }}>Also charge GST on the delivery fee</span>
            </label>
            <div style={{ fontSize: 11.5, color: '#9aa8a0', margin: '4px 0 0 26px' }}>
              Usually OFF — restaurant GST applies to food. Confirm with your CA.
            </div>
          </>
        )}
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
            ['riderBaseFare', 'Rider base fare / delivery (₹)'],
            ['riderPerKmPay', 'Rider pay per km (₹)'],
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
