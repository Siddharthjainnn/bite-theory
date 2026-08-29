'use client';

/**
 * TiffinLeadsPanel — Admin → Tiffin Leads.
 *
 * The callback queue for the daily-tiffin funnel. Every enrolment from the ad
 * lands here as `new`; the team works down the list, phones each person, and
 * moves them through contacted → converted | rejected.
 *
 * Built around the phone call, because that is the actual job: the number is
 * one tap (tel: works on the desktop app too), the whole week's addresses and
 * slots are visible without opening anything, and the note field saves on blur
 * so nobody loses a callback note by navigating away.
 */

import { useCallback, useEffect, useState } from 'react';
import { API_BASE, C, money } from '../lib/bite';

type Lead = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  area: string | null;
  planLabel: string | null;
  planPrice: number | null;
  schedule: { day: string; enabled: boolean; address: string; landmark?: string; slot: string }[] | null;
  notes: string | null;
  status: string;
  adminNote: string | null;
  source: string | null;
  createdAt: string;
};

type Stats = { new: number; contacted: number; converted: number; rejected: number; total: number };

const DAY_LABEL: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

const STATUSES = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'converted', label: 'Converted' },
  { key: 'rejected', label: 'Rejected' },
];

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  new: { bg: '#fff4e0', fg: '#b76e00' },
  contacted: { bg: '#e7f0ff', fg: '#1c4ed8' },
  converted: { bg: '#e8f5e9', fg: '#2e7d32' },
  rejected: { bg: '#fdecea', fg: '#c0392b' },
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

export default function TiffinLeadsPanel({
  adminHeaders,
  showToast,
}: {
  adminHeaders: () => Record<string, string>;
  showToast?: (m: string) => void;
}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setErr('');
    try {
      const [lr, sr] = await Promise.all([
        fetch(`${API_BASE}/tiffin/leads?status=${filter}`, { headers: adminHeaders(), cache: 'no-store' }),
        fetch(`${API_BASE}/tiffin/leads/stats`, { headers: adminHeaders(), cache: 'no-store' }),
      ]);
      if (!lr.ok) throw new Error(`Could not load leads (${lr.status})`);
      setLeads(await lr.json());
      if (sr.ok) setStats(await sr.json());
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Could not load leads.');
    } finally {
      setLoading(false);
    }
  }, [filter, adminHeaders]);

  useEffect(() => {
    /* Kick the fetch off in a microtask rather than synchronously in the
       effect body, so the first setState lands after the commit. */
    let alive = true;
    void Promise.resolve().then(() => { if (alive) load(); });
    return () => { alive = false; };
  }, [load]);

  const patch = async (id: number, body: Record<string, unknown>, toast: string) => {
    try {
      const r = await fetch(`${API_BASE}/tiffin/leads/${id}`, {
        method: 'PATCH',
        headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`Update failed (${r.status})`);
      const updated: Lead = await r.json();
      setLeads((p) => p.map((l) => (l.id === id ? updated : l)));
      showToast?.(toast);
      // status counts moved, so refresh the header numbers
      fetch(`${API_BASE}/tiffin/leads/stats`, { headers: adminHeaders(), cache: 'no-store' })
        .then((s) => (s.ok ? s.json() : null)).then((s) => s && setStats(s)).catch(() => {});
    } catch (e: unknown) {
      showToast?.(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const card: React.CSSProperties = {
    background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14,
    padding: 14, marginBottom: 10,
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 900, color: C.ink, margin: 0 }}>Tiffin Leads</h2>
          <p style={{ fontSize: 12.5, color: C.muted, margin: '3px 0 0' }}>
            Enrolment requests from the daily-tiffin funnel. Call, then move the status.
          </p>
        </div>
        <button onClick={load} style={{
          background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10,
          padding: '8px 14px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', color: C.ink,
        }}>↻ Refresh</button>
      </div>

      {stats && (
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 14 }}>
          {([
            ['New — call these', stats.new, '#b76e00', '#fff4e0'],
            ['Contacted', stats.contacted, '#1c4ed8', '#e7f0ff'],
            ['Converted', stats.converted, '#2e7d32', '#e8f5e9'],
            ['Total', stats.total, C.ink, '#eef2ef'],
          ] as [string, number, string, string][]).map(([lbl, n, fg, bg]) => (
            <div key={lbl} style={{
              background: bg, borderRadius: 12, padding: '10px 15px', minWidth: 108,
            }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: fg, lineHeight: 1.1 }}>{n}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: fg, opacity: .85 }}>{lbl}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
        {STATUSES.map((s) => (
          <button key={s.key} onClick={() => setFilter(s.key)} style={{
            padding: '7px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12.5, fontWeight: 800,
            border: filter === s.key ? `1.5px solid ${C.green}` : `1px solid ${C.line}`,
            background: filter === s.key ? C.greenSoft : '#fff',
            color: filter === s.key ? C.greenDeep : C.muted,
          }}>{s.label}</button>
        ))}
      </div>

      {err && (
        <div style={{ background: '#fdecea', color: '#c0392b', padding: '11px 14px', borderRadius: 12, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          {err}
        </div>
      )}

      {loading && <p style={{ color: C.muted, fontSize: 13 }}>Loading…</p>}

      {!loading && !leads.length && !err && (
        <div style={{ ...card, textAlign: 'center', padding: 34 }}>
          <div style={{ fontSize: 38 }}>🍱</div>
          <p style={{ fontWeight: 800, color: C.ink, margin: '8px 0 3px' }}>No leads yet</p>
          <p style={{ fontSize: 12.5, color: C.muted, margin: 0 }}>
            Enrolments from the tiffin page will appear here.
          </p>
        </div>
      )}

      {leads.map((l) => {
        const tone = STATUS_TONE[l.status] || STATUS_TONE.new;
        const days = (l.schedule || []).filter((d) => d.enabled);
        const isOpen = open === l.id;
        return (
          <div key={l.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 15.5, color: C.ink }}>{l.name}</b>
                  <span style={{
                    fontSize: 10.5, fontWeight: 900, padding: '3px 9px', borderRadius: 99,
                    background: tone.bg, color: tone.fg, textTransform: 'uppercase',
                  }}>{l.status}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>#{l.id}</span>
                </div>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>
                  {l.area || '—'} · {days.length} day{days.length === 1 ? '' : 's'}/week
                  {l.planPrice ? ` · ${money(l.planPrice)}` : ''}
                </div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                  {fmtDate(l.createdAt)}{l.source ? ` · via ${l.source}` : ''}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <a href={`tel:${l.phone}`} style={{
                  background: C.green, color: '#fff', padding: '9px 15px', borderRadius: 10,
                  fontSize: 13, fontWeight: 900, textDecoration: 'none', whiteSpace: 'nowrap',
                }}>📞 {l.phone}</a>
                <button onClick={() => setOpen(isOpen ? null : l.id)} style={{
                  background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10,
                  padding: '9px 13px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', color: C.ink,
                }}>{isOpen ? 'Hide' : 'Details'}</button>
              </div>
            </div>

            {isOpen && (
              <div style={{ marginTop: 13, borderTop: `1px solid ${C.line}`, paddingTop: 13 }}>
                {l.email && (
                  <p style={{ fontSize: 12.5, color: C.muted, margin: '0 0 10px' }}>
                    ✉️ {l.email}
                  </p>
                )}

                {days.map((d) => (
                  <div key={d.day} style={{
                    display: 'flex', gap: 10, padding: '8px 0',
                    borderBottom: `1px dashed ${C.line}`,
                  }}>
                    <span style={{
                      minWidth: 42, fontSize: 11.5, fontWeight: 900, color: C.greenDeep,
                      background: C.greenSoft, borderRadius: 7, padding: '3px 0', textAlign: 'center',
                      height: 'fit-content',
                    }}>{DAY_LABEL[d.day] || d.day}</span>
                    <span style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.5 }}>
                      {d.address}
                      {d.landmark ? <span style={{ color: C.muted }}> · {d.landmark}</span> : null}
                      <b style={{ display: 'block', color: C.muted, fontWeight: 700, fontSize: 11.5 }}>
                        🕐 {d.slot}
                      </b>
                    </span>
                  </div>
                ))}

                {l.notes && (
                  <p style={{
                    fontSize: 12.5, color: C.ink, background: '#fffaf0', padding: '9px 12px',
                    borderRadius: 9, margin: '11px 0 0', lineHeight: 1.5,
                  }}>
                    <b>Customer note:</b> {l.notes}
                  </p>
                )}

                <div style={{ marginTop: 12 }}>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: C.ink, marginBottom: 5 }}>
                    Callback note
                  </label>
                  <textarea
                    defaultValue={l.adminNote || ''}
                    onChange={(e) => setNoteDraft((p) => ({ ...p, [l.id]: e.target.value }))}
                    onBlur={() => {
                      const v = noteDraft[l.id];
                      // Save on blur, and only when actually changed — avoids a
                      // pointless PATCH every time the admin tabs past the box.
                      if (v !== undefined && v !== (l.adminNote || '')) {
                        patch(l.id, { adminNote: v }, 'Note saved');
                      }
                    }}
                    placeholder="What happened on the call?"
                    style={{
                      width: '100%', minHeight: 54, padding: '9px 11px', borderRadius: 10,
                      border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit',
                      color: C.ink, resize: 'vertical',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 7, marginTop: 11, flexWrap: 'wrap' }}>
                  {(['contacted', 'converted', 'rejected'] as const)
                    .filter((s) => s !== l.status)
                    .map((s) => (
                      <button key={s} onClick={() => patch(l.id, { status: s }, `Marked ${s}`)} style={{
                        padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                        fontSize: 12.5, fontWeight: 800, border: `1px solid ${C.line}`,
                        background: STATUS_TONE[s].bg, color: STATUS_TONE[s].fg,
                      }}>
                        Mark {s}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
