'use client';

/**
 * /tiffin — daily tiffin enrolment. This is the landing page for the Meta ad
 * campaign, so it is built around one job: turn an ad click into a callable
 * lead in as few taps as possible.
 *
 * Deliberate choices:
 *  - No login wall. Ad traffic has no account; asking them to sign up first
 *    loses most of them. We collect name + phone and call them back.
 *  - Weekday addresses default to ONE address copied across all days, because
 *    that is the common case (office lunch). Sat/Sun are opted out by default
 *    and can be switched on with their own address — the "different on
 *    weekends" case the brief called out.
 *  - A sticky call button is always reachable; some people will never fill a
 *    form and will only ever phone.
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../components/AppShell';
import AppHeader from '../components/AppHeader';
import { C, money, submitTiffinLead, TiffinDay } from '../lib/bite';
import {
  TIFFIN_PHONE, TIFFIN_PHONE_PRETTY, TIFFIN_PLAN, TIFFIN_AREAS, TIFFIN_SLOTS, DAYS,
} from './config';

type DayState = Record<string, { enabled: boolean; address: string; landmark: string; slot: string }>;

const initialDays = (): DayState => {
  const out: DayState = {};
  for (const d of DAYS) {
    // Mon–Fri on by default, weekends off — the usual working-week tiffin.
    out[d.key] = {
      enabled: d.key !== 'sat' && d.key !== 'sun',
      address: '', landmark: '', slot: '12:00-13:00',
    };
  }
  return out;
};

const field: React.CSSProperties = {
  width: '100%', padding: '11px 13px', borderRadius: 12,
  border: `1px solid ${C.line}`, fontSize: 14, color: C.ink,
  background: '#fff', outline: 'none', fontFamily: 'inherit',
};
const label: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 800, color: C.ink,
  marginBottom: 6, letterSpacing: .2,
};
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 18, padding: 16,
  border: `1px solid ${C.line}`, marginBottom: 14,
};

export default function TiffinPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [area, setArea] = useState('');
  const [notes, setNotes] = useState('');
  const [days, setDays] = useState<DayState>(initialDays);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<number | null>(null);

  const activeCount = useMemo(
    () => DAYS.filter((d) => days[d.key].enabled).length,
    [days],
  );

  const setDay = (key: string, patch: Partial<DayState[string]>) =>
    setDays((p) => ({ ...p, [key]: { ...p[key], ...patch } }));

  /** Copy the first filled-in day's address + slot onto every enabled day. */
  const copyToAll = () => {
    const source = DAYS.map((d) => days[d.key]).find((d) => d.address.trim());
    if (!source) { setErr('Fill in one day first, then copy it across.'); return; }
    setErr('');
    setDays((p) => {
      const next = { ...p };
      for (const d of DAYS) {
        if (next[d.key].enabled) {
          next[d.key] = {
            ...next[d.key],
            address: source.address, landmark: source.landmark, slot: source.slot,
          };
        }
      }
      return next;
    });
  };

  const submit = async () => {
    setErr('');
    if (!name.trim()) return setErr('Please enter your name.');
    if (!/^[6-9]\d{9}$/.test(phone.trim()))
      return setErr('Enter a valid 10-digit mobile number.');
    if (!activeCount) return setErr('Pick at least one delivery day.');

    const missing = DAYS.find((d) => days[d.key].enabled && !days[d.key].address.trim());
    if (missing) {
      setExpanded(missing.key);
      return setErr(`Add a delivery address for ${missing.long}.`);
    }

    const schedule: TiffinDay[] = DAYS.map((d) => ({
      day: d.key,
      enabled: days[d.key].enabled,
      address: days[d.key].address.trim(),
      landmark: days[d.key].landmark.trim() || undefined,
      slot: days[d.key].slot,
    }));

    setBusy(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const res = await submitTiffinLead({
        name: name.trim(), phone: phone.trim(),
        email: email.trim() || undefined,
        area: area || undefined,
        planKey: TIFFIN_PLAN.key,
        planLabel: TIFFIN_PLAN.label,
        planPrice: TIFFIN_PLAN.price,
        schedule,
        notes: notes.trim() || undefined,
        source: params.get('utm_source') || params.get('source') || 'website',
      });
      setDone(res.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Could not submit. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  /* ── success state ── */
  if (done) {
    return (
      <AppShell>
        <AppHeader variant="page" title="Tiffin enrolment" />
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 58, marginBottom: 10 }}>🎉</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: C.ink, margin: '0 0 8px' }}>
            You&apos;re on the list!
          </h1>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, margin: '0 0 6px' }}>
            Request <b>#{done}</b> received. Our team will call you on{' '}
            <b>{phone}</b> within a few hours to confirm your plan and start date.
          </p>
          <a
            href={`tel:${TIFFIN_PHONE}`}
            style={{
              display: 'inline-block', marginTop: 18, background: C.dark, color: '#fff',
              padding: '13px 24px', borderRadius: 24, fontWeight: 800,
              textDecoration: 'none', fontSize: 14,
            }}
          >
            📞 Call us instead
          </a>
          <button
            onClick={() => router.push('/')}
            style={{
              display: 'block', margin: '14px auto 0', background: 'none',
              border: 'none', color: C.muted, fontSize: 13, fontWeight: 700,
              textDecoration: 'underline', cursor: 'pointer',
            }}
          >
            Back to menu
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppHeader variant="page" title="Daily Tiffin" />

      <div style={{ padding: '14px 14px 110px' }}>

        {/* hero */}
        <div style={{
          borderRadius: 20, padding: 20, marginBottom: 14, position: 'relative',
          overflow: 'hidden', color: '#fff',
          background: `radial-gradient(120% 150% at 85% -10%, ${C.orange} 0%, ${C.orangeDeep} 38%, ${C.dark} 100%)`,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 900, letterSpacing: .6, background: 'rgba(0,0,0,.24)',
            padding: '4px 11px', borderRadius: 99, border: '1px solid rgba(255,255,255,.3)',
          }}>
            🍱 100% PURE VEG · HOME STYLE
          </span>
          <h1 style={{
            fontSize: 27, fontWeight: 900, lineHeight: 1.1, margin: '11px 0 6px',
            letterSpacing: -.7,
          }}>
            Daily tiffin,<br />delivered to your desk
          </h1>
          <p style={{ fontSize: 13.5, opacity: .95, margin: '0 0 12px', lineHeight: 1.5 }}>
            Fresh-cooked every morning. No cooking, no planning, no Sunday grocery run.
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1 }}>
              {money(TIFFIN_PLAN.price)}
            </span>
            <span style={{ fontSize: 13, opacity: .9, fontWeight: 700 }}>
              {TIFFIN_PLAN.duration}
            </span>
          </div>
          <div style={{ fontSize: 12.5, opacity: .92, marginTop: 6 }}>
            Every tiffin: {TIFFIN_PLAN.includes.join(' · ')}
          </div>
        </div>

        {/* service areas */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 900, color: C.ink, margin: '0 0 4px' }}>
            📍 Now serving in Indore
          </h2>
          <p style={{ fontSize: 12.5, color: C.muted, margin: '0 0 11px' }}>
            Not on the list? Call us — we add new areas every week.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {TIFFIN_AREAS.filter((a) => a.value !== 'other').map((a) => (
              <span key={a.value} style={{
                fontSize: 12, fontWeight: 700, color: C.greenDeep,
                background: C.greenSoft, border: `1px solid ${C.line}`,
                padding: '5px 11px', borderRadius: 99,
              }}>
                {a.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── form ── */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 900, color: C.ink, margin: '0 0 13px' }}>
            Enrol now — takes a minute
          </h2>

          <div style={{ marginBottom: 12 }}>
            <label style={label}>Your name *</label>
            <input style={field} value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Siddharth Jain" />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={label}>Mobile number *</label>
            <input style={field} value={phone} inputMode="numeric" maxLength={10}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="10-digit mobile" />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={label}>Email <span style={{ color: C.muted, fontWeight: 600 }}>(optional)</span></label>
            <input style={field} value={email} type="email"
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>

          <div style={{ marginBottom: 4 }}>
            <label style={label}>Your area *</label>
            <select style={field} value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">Select your locality</option>
              {TIFFIN_AREAS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── per-day schedule ── */}
        <div style={card}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 4,
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 900, color: C.ink, margin: 0 }}>
              Delivery days
            </h2>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.greenDeep }}>
              {activeCount} day{activeCount === 1 ? '' : 's'} / week
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: C.muted, margin: '0 0 12px', lineHeight: 1.5 }}>
            Tap a day to set its address and time. Fill one day, then use{' '}
            <b>Copy to all days</b> — you can still change Saturday and Sunday after.
          </p>

          <div style={{ display: 'flex', gap: 6, marginBottom: 13, flexWrap: 'wrap' }}>
            {DAYS.map((d) => {
              const on = days[d.key].enabled;
              return (
                <button key={d.key}
                  onClick={() => setDay(d.key, { enabled: !on })}
                  style={{
                    flex: '1 0 42px', padding: '9px 0', borderRadius: 11, cursor: 'pointer',
                    fontSize: 12, fontWeight: 800, fontFamily: 'inherit',
                    border: on ? `1.5px solid ${C.green}` : `1px solid ${C.line}`,
                    background: on ? C.greenSoft : '#fff',
                    color: on ? C.greenDeep : C.muted,
                  }}>
                  {d.short}
                </button>
              );
            })}
          </div>

          <button onClick={copyToAll} style={{
            width: '100%', padding: '10px', borderRadius: 12, cursor: 'pointer',
            border: `1.5px dashed ${C.green}`, background: '#fff',
            color: C.greenDeep, fontSize: 13, fontWeight: 800,
            fontFamily: 'inherit', marginBottom: 13,
          }}>
            ⧉ Copy first address to all days
          </button>

          {DAYS.filter((d) => days[d.key].enabled).map((d) => {
            const st = days[d.key];
            const open = expanded === d.key;
            const filled = st.address.trim().length > 0;
            return (
              <div key={d.key} style={{
                border: `1px solid ${filled ? C.line : '#f0c9c9'}`,
                borderRadius: 13, marginBottom: 9, overflow: 'hidden',
              }}>
                <button
                  onClick={() => setExpanded(open ? null : d.key)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: '11px 13px',
                    background: filled ? '#fff' : '#fff8f8', border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}>
                  <span>
                    <b style={{ fontSize: 13.5, color: C.ink }}>{d.long}</b>
                    <span style={{
                      display: 'block', fontSize: 11.5, color: filled ? C.muted : '#c0392b',
                      marginTop: 2, maxWidth: 210, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {filled ? st.address : 'Address needed'}
                    </span>
                  </span>
                  <span style={{ fontSize: 12, color: C.muted }}>{open ? '▲' : '▼'}</span>
                </button>

                {open && (
                  <div style={{ padding: '2px 13px 13px', background: '#fbfcfb' }}>
                    <label style={label}>Full delivery address *</label>
                    <textarea
                      style={{ ...field, minHeight: 66, resize: 'vertical', marginBottom: 10 }}
                      value={st.address}
                      onChange={(e) => setDay(d.key, { address: e.target.value })}
                      placeholder="Flat / office no., building, street, area, pincode"
                    />
                    <label style={label}>Landmark (optional)</label>
                    <input style={{ ...field, marginBottom: 10 }} value={st.landmark}
                      onChange={(e) => setDay(d.key, { landmark: e.target.value })}
                      placeholder="e.g. opposite Mangal City" />
                    <label style={label}>Delivery time *</label>
                    <select style={field} value={st.slot}
                      onChange={(e) => setDay(d.key, { slot: e.target.value })}>
                      {TIFFIN_SLOTS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}

          <label style={{ ...label, marginTop: 12 }}>
            Anything else? <span style={{ color: C.muted, fontWeight: 600 }}>(optional)</span>
          </label>
          <textarea style={{ ...field, minHeight: 56, resize: 'vertical' }} value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Jain food, no onion garlic, less spicy, start date…" />
        </div>

        {err && (
          <div style={{
            background: '#fdecea', color: '#c0392b', padding: '11px 14px',
            borderRadius: 12, fontSize: 13, fontWeight: 700, marginBottom: 12,
          }}>
            {err}
          </div>
        )}

        <button onClick={submit} disabled={busy} style={{
          width: '100%', padding: '15px', borderRadius: 16, border: 'none',
          background: busy ? C.muted : C.dark, color: '#fff', fontSize: 15.5,
          fontWeight: 900, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
        }}>
          {busy ? 'Submitting…' : `Enrol now · ${money(TIFFIN_PLAN.price)}`}
        </button>
        <p style={{
          fontSize: 11.5, color: C.muted, textAlign: 'center',
          margin: '9px 0 0', lineHeight: 1.5,
        }}>
          No payment now. We&apos;ll call to confirm before anything starts.
        </p>
      </div>

      {/* sticky call bar — for people who will never fill a form */}
      <a href={`tel:${TIFFIN_PHONE}`} style={{
        position: 'fixed', left: 14, right: 14, bottom: 16, zIndex: 40,
        maxWidth: 452, margin: '0 auto', display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 9, background: C.green, color: '#fff',
        padding: '14px', borderRadius: 30, textDecoration: 'none',
        fontWeight: 900, fontSize: 14.5, boxShadow: '0 8px 26px rgba(76,175,80,.45)',
      }}>
        📞 Call now · {TIFFIN_PHONE_PRETTY}
      </a>
    </AppShell>
  );
}
