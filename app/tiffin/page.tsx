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
import { useSession } from 'next-auth/react';
import AppShell from '../components/AppShell';
import AppHeader from '../components/AppHeader';
import AddressAutocomplete from '../components/AddressAutocomplete';
import { C, money, submitTiffinLead, TiffinDay } from '../lib/bite';
import {
  TIFFIN_PHONE, TIFFIN_PHONE_PRETTY, TIFFIN_PLAN, TIFFIN_PLANS, DEFAULT_PLAN_KEY,
  TIFFIN_AREAS, TIFFIN_SLOTS, DAYS,
} from './config';

type DayState = Record<string, {
  enabled: boolean; address: string; landmark: string; slot: string;
  lat?: number; lng?: number; placeId?: string;
}>;

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
  const { data: session } = useSession();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  /* Prefill is derived during render, not in an effect. `seeded` records which
     session we've already applied, so a customer's own typing is never
     overwritten when the session object re-resolves. */
  const [seeded, setSeeded] = useState<string | null>(null);
  const [area, setArea] = useState('');
  const [notes, setNotes] = useState('');
  const [planKey, setPlanKey] = useState(DEFAULT_PLAN_KEY);
  const [days, setDays] = useState<DayState>(initialDays);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<number | null>(null);

  /* Prefill for signed-in customers only. The funnel stays open to logged-out
     ad traffic by design, so this is a convenience, never a requirement. */
  const su = session?.user as
    { name?: string | null; email?: string | null; mobile?: string | null } | undefined;
  if (su?.email && seeded !== su.email) {
    setSeeded(su.email);
    if (!name) setName(su.name || '');
    if (!email) setEmail(su.email || '');
    if (!phone) setPhone((su.mobile || '').replace(/\D/g, '').slice(-10));
  }

  const plan = useMemo(
    () => TIFFIN_PLANS.find((p) => p.key === planKey) || TIFFIN_PLANS[0],
    [planKey],
  );

  const activeCount = useMemo(
    () => DAYS.filter((d) => days[d.key].enabled).length,
    [days],
  );

  /* Switching to a shorter plan trims the day selection down to what that plan
     allows, so the customer is never left holding an invalid week. */
  const choosePlan = (key: string) => {
    setPlanKey(key);
    const next = TIFFIN_PLANS.find((p) => p.key === key);
    const cap = next?.maxWeekdays;
    if (!cap) return;
    setDays((p) => {
      const on = DAYS.filter((d) => p[d.key].enabled);
      if (on.length <= cap) return p;
      const keep = new Set(on.slice(0, cap).map((d) => d.key));
      const out = { ...p };
      for (const d of DAYS) out[d.key] = { ...out[d.key], enabled: keep.has(d.key) };
      return out;
    });
  };

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
            lat: source.lat, lng: source.lng, placeId: source.placeId,
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
    if (plan.maxWeekdays && activeCount > plan.maxWeekdays)
      return setErr(`${plan.label} covers ${plan.maxWeekdays} day${plan.maxWeekdays === 1 ? '' : 's'}.`);

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
      lat: days[d.key].lat,
      lng: days[d.key].lng,
      placeId: days[d.key].placeId,
    }));

    setBusy(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const res = await submitTiffinLead({
        name: name.trim(), phone: phone.trim(),
        email: email.trim() || undefined,
        area: area || undefined,
        planKey: plan.key,
        planLabel: `${plan.label} · ${plan.days} meal${plan.days === 1 ? '' : 's'}`,
        planPrice: plan.total,
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
              {money(plan.total)}
            </span>
            <span style={{ fontSize: 13, opacity: .9, fontWeight: 700 }}>
              {plan.duration}
            </span>
          </div>
          <div style={{ fontSize: 12, opacity: .92, marginTop: 3 }}>
            {plan.delivery > 0
              ? `${money(plan.price)} meals + ${money(plan.delivery)} delivery`
              : 'Delivery included'}
            {plan.days > 1 ? ` · about ${money(plan.perDay)} a meal` : ''}
          </div>
          <div style={{ fontSize: 12, opacity: .92, marginTop: 4, fontWeight: 700 }}>
            {TIFFIN_PLAN.note}
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

        {/* ── plan picker ── */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 900, color: C.ink, margin: '0 0 4px' }}>
            Choose your plan
          </h2>
          <p style={{ fontSize: 12.5, color: C.muted, margin: '0 0 12px' }}>
            Never tried us? Start with one day.
          </p>

          {TIFFIN_PLANS.map((p) => {
            const on = p.key === planKey;
            return (
              <button
                key={p.key}
                onClick={() => choosePlan(p.key)}
                style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer', display: 'block',
                  marginBottom: 9, padding: '13px 14px', borderRadius: 14,
                  fontFamily: 'inherit',
                  border: on ? `2px solid ${C.green}` : `1px solid ${C.line}`,
                  background: on ? C.greenSoft : '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <b style={{ fontSize: 14.5, color: C.ink }}>{p.label}</b>
                    {p.badge && (
                      <span style={{
                        fontSize: 9.5, fontWeight: 900, letterSpacing: .4,
                        background: C.orange, color: '#fff',
                        padding: '2px 7px', borderRadius: 99,
                      }}>{p.badge}</span>
                    )}
                  </span>
                  <b style={{ fontSize: 16, color: C.ink, whiteSpace: 'nowrap' }}>
                    {money(p.total)}
                  </b>
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.45 }}>
                  {p.blurb}
                </div>
                <div style={{ fontSize: 11.5, color: C.greenDeep, fontWeight: 800, marginTop: 4 }}>
                  {p.days} meal{p.days === 1 ? '' : 's'}
                  {p.days > 1 ? ` · ${money(p.perDay)} each` : ''}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── form ── */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 900, color: C.ink, margin: '0 0 13px' }}>
            Your details
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
            {plan.maxWeekdays === 1
              ? 'Pick the one day you want to try, then set the address and time.'
              : <>Tap a day to set its address and time. Fill one day, then use{' '}
                 <b>Copy to all days</b> — you can still change Saturday and Sunday after.</>}
          </p>

          <div style={{ display: 'flex', gap: 6, marginBottom: 13, flexWrap: 'wrap' }}>
            {DAYS.map((d) => {
              const on = days[d.key].enabled;
              return (
                <button key={d.key}
                  onClick={() => {
                    if (!on && plan.maxWeekdays && activeCount >= plan.maxWeekdays) {
                      setErr(`${plan.label} covers ${plan.maxWeekdays} day${plan.maxWeekdays === 1 ? '' : 's'}. Turn one off first, or pick a bigger plan.`);
                      return;
                    }
                    setErr('');
                    setDay(d.key, { enabled: !on });
                  }}
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
                    <div style={{ marginBottom: 10 }}>
                      <AddressAutocomplete
                        value={st.address}
                        onChange={(v, place) =>
                          setDay(d.key, {
                            address: v,
                            lat: place?.lat, lng: place?.lng, placeId: place?.placeId,
                          })
                        }
                      />
                    </div>
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
          {busy ? 'Submitting…' : `${plan.days === 1 ? 'Book my trial' : 'Enrol now'} · ${money(plan.total)}`}
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
