'use client';

/**
 * CouponBlastPanel — Admin → Coupon Campaign.
 *
 * Assigns a coupon to a chosen audience and emails it, in resumable batches.
 *
 * WHY BATCHES AND NOT ONE BIG SEND
 * Gmail caps a free account near 500/day and Render times out long requests,
 * so one HTTP call handles one small batch and reports what remains. This
 * screen drives the loop and can be stopped at any point; coupon_assignments
 * records who has already received it, so resuming never double-sends.
 */

import { useCallback, useEffect, useState } from 'react';
import { API_BASE, C } from '../lib/bite';

type Coupon = { id: number; code: string; description?: string | null; isActive?: boolean; is_active?: boolean };
type Audience = { segment: string; remaining: number; inSegment: number; alreadySent: number };

const SEGMENT_LABEL: Record<string, { name: string; why: string }> = {
  never_ordered: { name: 'Signed up, never ordered', why: 'Warmest untapped audience — a discount here buys a first order, not a discount on one you already had.' },
  lapsed_30: { name: 'Ordered before, quiet 30+ days', why: 'Win-backs. They already know the food.' },
  recent_30: { name: 'Ordered in last 30 days', why: 'Active customers — usually margin given away.' },
  all: { name: 'Everyone', why: 'Includes people who just ordered at full price.' },
};

export default function CouponBlastPanel({
  adminHeaders, showToast,
}: {
  adminHeaders: () => Record<string, string>;
  showToast?: (m: string) => void;
}) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponId, setCouponId] = useState<number | null>(null);
  const [audience, setAudience] = useState<Audience[]>([]);
  const [segment, setSegment] = useState('never_ordered');
  const [batch, setBatch] = useState(25);
  const [running, setRunning] = useState(false);
  const [stop, setStop] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [err, setErr] = useState('');

  const say = (m: string) => setLog((p) => [`${new Date().toLocaleTimeString('en-IN')} — ${m}`, ...p].slice(0, 40));

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(async () => {
      try {
        const r = await fetch(`${API_BASE}/coupons`, { headers: adminHeaders(), cache: 'no-store' });
        if (!r.ok) throw new Error(`Could not load coupons (${r.status})`);
        const list: Coupon[] = await r.json();
        if (!alive) return;
        setCoupons(list);
        if (list.length) setCouponId(list[0].id);
      } catch (e: unknown) {
        if (alive) setErr(e instanceof Error ? e.message : 'Could not load coupons.');
      }
    });
    return () => { alive = false; };
  }, [adminHeaders]);

  const loadAudience = useCallback(async (id: number) => {
    try {
      const r = await fetch(`${API_BASE}/coupon-assignments/blast/audience/${id}`, {
        headers: adminHeaders(), cache: 'no-store',
      });
      if (!r.ok) throw new Error(`Audience failed (${r.status})`);
      setAudience(await r.json());
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Could not load audience.');
    }
  }, [adminHeaders]);

  useEffect(() => {
    if (couponId == null) return;
    let alive = true;
    void Promise.resolve().then(() => { if (alive) loadAudience(couponId); });
    return () => { alive = false; };
  }, [couponId, loadAudience]);

  const current = audience.find((a) => a.segment === segment);

  const post = async (body: Record<string, unknown>) => {
    const r = await fetch(`${API_BASE}/coupon-assignments/blast/send`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.message || `Send failed (${r.status})`);
    return j;
  };

  const preview = async () => {
    if (couponId == null) return;
    setErr('');
    try {
      const j = await post({ couponId, segment, limit: batch, dryRun: true });
      say(`Dry run: would send to ${j.wouldSend}. e.g. ${(j.sample || []).join(', ') || '—'}`);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Preview failed.'); }
  };

  const run = async () => {
    if (couponId == null) return;
    setErr(''); setRunning(true); setStop(false);
    let total = 0;
    try {
      // Loop batch-by-batch until the audience empties or the admin stops.
      for (;;) {
        const j = await post({ couponId, segment, limit: batch });
        total += j.sent;
        say(`Batch: ${j.sent} sent${j.failed?.length ? `, ${j.failed.length} failed` : ''} · ${j.remaining} left`);
        if (j.failed?.length) say(`First failure: ${j.failed[0].email} — ${j.failed[0].error}`);
        if (!j.remaining || !j.sent) break;
        if (stop) { say('Stopped by admin.'); break; }
      }
      showToast?.(`Campaign finished — ${total} emails sent`);
      await loadAudience(couponId);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Send failed.');
    } finally { setRunning(false); }
  };

  const card: React.CSSProperties = {
    background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginBottom: 12,
  };
  const fieldS: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: `1px solid ${C.line}`, fontSize: 14, fontFamily: 'inherit', color: C.ink,
  };

  return (
    <div>
      <h2 style={{ fontSize: 19, fontWeight: 900, color: C.ink, margin: '0 0 3px' }}>Coupon Campaign</h2>
      <p style={{ fontSize: 12.5, color: C.muted, margin: '0 0 14px' }}>
        Assign a coupon to an audience and email it, in resumable batches.
      </p>

      {err && (
        <div style={{ background: '#fdecea', color: '#c0392b', padding: '11px 14px', borderRadius: 12, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          {err}
        </div>
      )}

      {!coupons.length && !err && (
        <div style={{ ...card, textAlign: 'center', padding: 30 }}>
          <div style={{ fontSize: 34 }}>🎟️</div>
          <p style={{ fontWeight: 800, color: C.ink, margin: '8px 0 3px' }}>No coupons yet</p>
          <p style={{ fontSize: 12.5, color: C.muted, margin: 0 }}>
            Create one in Admin → Coupons first, then come back here.
          </p>
        </div>
      )}

      {coupons.length > 0 && (
        <>
          <div style={card}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: C.ink, marginBottom: 6 }}>
              Coupon
            </label>
            <select style={fieldS} value={couponId ?? ''} onChange={(e) => setCouponId(Number(e.target.value))}>
              {coupons.map((c) => (
                <option key={c.id} value={c.id}>{c.code}{c.description ? ` — ${c.description}` : ''}</option>
              ))}
            </select>
          </div>

          <div style={card}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: C.ink, marginBottom: 8 }}>
              Audience
            </label>
            {audience.map((a) => {
              const meta = SEGMENT_LABEL[a.segment] || { name: a.segment, why: '' };
              const on = a.segment === segment;
              return (
                <button key={a.segment} onClick={() => setSegment(a.segment)} style={{
                  width: '100%', textAlign: 'left', display: 'block', cursor: 'pointer',
                  marginBottom: 8, padding: '12px 13px', borderRadius: 12, fontFamily: 'inherit',
                  border: on ? `2px solid ${C.green}` : `1px solid ${C.line}`,
                  background: on ? C.greenSoft : '#fff',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <b style={{ fontSize: 13.5, color: C.ink }}>{meta.name}</b>
                    <b style={{ fontSize: 15, color: C.greenDeep }}>{a.remaining}</b>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3, lineHeight: 1.45 }}>
                    {meta.why}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                    {a.inSegment} in segment · {a.alreadySent} already sent this coupon
                  </div>
                </button>
              );
            })}
          </div>

          <div style={card}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: C.ink, marginBottom: 6 }}>
              Emails per batch
            </label>
            <input type="number" min={1} max={100} value={batch} style={fieldS}
              onChange={(e) => setBatch(Math.min(100, Math.max(1, Number(e.target.value) || 1)))} />
            <p style={{ fontSize: 11.5, color: C.muted, margin: '7px 0 0', lineHeight: 1.5 }}>
              Gmail allows roughly 500 a day on a free account. Sending{' '}
              <b>{current?.remaining ?? 0}</b> emails takes about{' '}
              <b>{Math.ceil((current?.remaining ?? 0) * 0.35 / 60)} min</b> at 0.35s each.
              Stop any time — nobody is emailed twice.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <button onClick={preview} disabled={running} style={{
              padding: '12px 20px', borderRadius: 12, cursor: running ? 'default' : 'pointer',
              border: `1px solid ${C.line}`, background: '#fff', color: C.ink,
              fontSize: 13.5, fontWeight: 800, fontFamily: 'inherit',
            }}>Dry run</button>

            <button onClick={run} disabled={running || !current?.remaining} style={{
              padding: '12px 22px', borderRadius: 12,
              cursor: running || !current?.remaining ? 'default' : 'pointer',
              border: 'none', background: running || !current?.remaining ? C.muted : C.dark,
              color: '#fff', fontSize: 13.5, fontWeight: 900, fontFamily: 'inherit',
            }}>
              {running ? 'Sending…' : `Send to ${current?.remaining ?? 0} customers`}
            </button>

            {running && (
              <button onClick={() => setStop(true)} style={{
                padding: '12px 18px', borderRadius: 12, cursor: 'pointer',
                border: `1px solid #f0c9c9`, background: '#fdecea', color: '#c0392b',
                fontSize: 13.5, fontWeight: 800, fontFamily: 'inherit',
              }}>Stop after this batch</button>
            )}
          </div>

          {log.length > 0 && (
            <div style={{ ...card, marginTop: 12, background: '#fbfcfb' }}>
              <b style={{ fontSize: 12.5, color: C.ink }}>Progress</b>
              {log.map((l, i) => (
                <div key={i} style={{ fontSize: 11.5, color: C.muted, marginTop: 5, fontFamily: 'monospace' }}>{l}</div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
