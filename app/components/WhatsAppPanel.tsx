'use client';

/**
 * Admin → Delivery → WhatsApp.
 * Setup status (from the server's env), who gets what, staff numbers,
 * alert timings, a test send, and the log of what actually went out.
 */

import { useCallback, useEffect, useState } from 'react';
import { C } from '../lib/bite';

type Status = {
  configured: boolean; phoneNumberId: string | null; apiVersion: string;
  appSecretSet: boolean; verifyTokenSet: boolean; siteUrl: string; webhookPath: string;
  templates: { name: string; vars: string[]; text: string }[];
  counts: { day: number; ok: number; failed: number; pending: number };
};
type LogRow = {
  id: number; audience: string; to_phone: string; template: string; kind: string; status: string;
  attempts: number; last_error: string | null; order_number: string | null; created_at: string;
};
type NotifyCfg = {
  customerEnabled: boolean; customerCooking: boolean; staffEnabled: boolean; staffPhones: string[];
  alertNewOrder: boolean; notAcceptedMin: number; readyNoCarrierMin: number;
  alertBookPorter: boolean; alertRunningLate: boolean;
};

export type WhatsAppApi = {
  notifyStatus: () => Promise<Status>;
  notifyLog: () => Promise<LogRow[]>;
  notifyTest: (phone: string) => Promise<{ ok: boolean; to?: string; error?: string }>;
  adminSettings: () => Promise<{ notifyConfig?: Record<string, unknown> }>;
  saveNotifyConfig: (cfg: Record<string, unknown>) => Promise<{ notifyConfig?: Record<string, unknown> }>;
};

const STATUS_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: '#eef2ef', fg: '#6b7d74', label: 'Queued' },
  sending: { bg: '#eef2ef', fg: '#6b7d74', label: 'Sending' },
  sent: { bg: '#e3eefc', fg: '#1d4f91', label: 'Sent' },
  delivered: { bg: '#e8f5e9', fg: '#2e7d32', label: 'Delivered' },
  read: { bg: '#e8f5e9', fg: '#2e7d32', label: 'Read ✓✓' },
  failed: { bg: '#fdecea', fg: '#a93226', label: 'Failed' },
  skipped: { bg: '#fff4e0', fg: '#8a6100', label: 'Not sent' },
};

const KIND_LABEL = (k: string) => ({
  order_placed: 'Order confirmed', 'status:preparing_food': 'Cooking started', 'status:out_for_delivery': 'On the way',
  'status:delivered': 'Delivered', 'status:cancelled': 'Cancelled', delayed: 'Running late', makegood: 'Make-good',
  'alert:new_order': 'New order', 'alert:not_accepted': 'Not accepted', 'alert:ready_no_carrier': 'Ready, no rider',
  'alert:book_porter': 'Book Porter', 'alert:running_late': 'Running late', test: 'Test', opt_out_ack: 'STOP reply', opt_in_ack: 'START reply',
}[k] || k);

export default function WhatsAppPanel({ api, showToast }: { api: WhatsAppApi; showToast: (m: string) => void }) {
  const [st, setSt] = useState<Status | null>(null);
  const [log, setLog] = useState<LogRow[]>([]);
  const [cfg, setCfg] = useState<NotifyCfg | null>(null);
  const [draft, setDraft] = useState<Partial<NotifyCfg> & { staffPhonesText?: string }>({});
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, l, a] = await Promise.all([api.notifyStatus(), api.notifyLog(), api.adminSettings()]);
      setSt(s); setLog(l); setCfg((a.notifyConfig || {}) as unknown as NotifyCfg); setErr('');
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Could not load WhatsApp settings'); }
  }, [api]);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) return load(); });
    const t = setInterval(() => { if (alive) void api.notifyLog().then(setLog).catch(() => {}); }, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [load, api]);

  const v = <K extends keyof NotifyCfg>(k: K): NotifyCfg[K] | undefined =>
    (k in draft ? (draft as NotifyCfg)[k] : cfg?.[k]);
  const phonesText = draft.staffPhonesText ?? (cfg?.staffPhones || []).map((p) => `+${p}`).join(', ');
  const dirty = Object.keys(draft).length > 0;

  const save = async () => {
    setBusy(true);
    try {
      const { staffPhonesText, ...rest } = draft;
      const body: Record<string, unknown> = { ...rest };
      if (staffPhonesText !== undefined) body.staffPhones = staffPhonesText;
      const s = await api.saveNotifyConfig(body);
      setCfg((s.notifyConfig || {}) as unknown as NotifyCfg); setDraft({});
      showToast('WhatsApp settings saved');
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Could not save'); }
    finally { setBusy(false); }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const r = await api.notifyTest(testTo);
      if (!r.ok) { showToast(r.error || 'Could not send'); return; }
      showToast(`Test queued to +${r.to}`);
      setLog(await api.notifyLog());
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Could not send'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <style>{CSS}</style>
      {err && <div className="wa-err">{err}</div>}

      {st && (
        <div className="wa-card wa-setup" data-ok={st.configured ? '1' : '0'}>
          <div className="wa-setup-head">
            <span className="wa-dot" />
            <div>
              <b>{st.configured ? 'Connected to WhatsApp Cloud API' : 'Not connected yet'}</b>
              <span>
                {st.configured
                  ? `Number ID ${st.phoneNumberId} · API ${st.apiVersion}`
                  : 'Add WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID on Render, then redeploy. Messages are queued but not sent until then.'}
              </span>
            </div>
            <div className="wa-counts">
              <span><b>{st.counts.ok}</b> sent today</span>
              <span data-bad={st.counts.failed ? '1' : '0'}><b>{st.counts.failed}</b> failed</span>
              <span><b>{st.counts.pending}</b> queued</span>
            </div>
          </div>
          <ul className="wa-checks">
            <li data-ok={st.configured ? '1' : '0'}>Access token + phone number ID</li>
            <li data-ok={st.appSecretSet ? '1' : '0'}>App secret (verifies delivery receipts)</li>
            <li data-ok={st.verifyTokenSet ? '1' : '0'}>Webhook verify token · callback <code>…{st.webhookPath}</code></li>
            <li data-ok="1">Tracking links use <code>{st.siteUrl}</code></li>
          </ul>
        </div>
      )}

      {cfg && (
        <div className="wa-grid">
          <div className="wa-card">
            <h3>Customers</h3>
            <Toggle label="Send order updates on WhatsApp" help="confirmed with delivery time, on the way, delivered, cancelled, running late, make-good"
              on={!!v('customerEnabled')} set={(b) => setDraft((d) => ({ ...d, customerEnabled: b }))} />
            <Toggle label="Also send “cooking started”" help="one more message per order (~₹0.15)"
              on={!!v('customerCooking')} set={(b) => setDraft((d) => ({ ...d, customerCooking: b }))} />
            <p className="wa-note">Customers can reply STOP to opt out and START to opt back in.</p>
          </div>

          <div className="wa-card">
            <h3>You and your staff</h3>
            <Toggle label="Send kitchen alerts on WhatsApp" help="to the numbers below"
              on={!!v('staffEnabled')} set={(b) => setDraft((d) => ({ ...d, staffEnabled: b }))} />
            <label className="wa-field">
              <span>Staff numbers (comma separated, up to 10)</span>
              <input value={phonesText} placeholder="99930 60222, 98270 12345"
                onChange={(e) => setDraft((d) => ({ ...d, staffPhonesText: e.target.value }))} />
            </label>
            <Toggle label="New order" on={!!v('alertNewOrder')} set={(b) => setDraft((d) => ({ ...d, alertNewOrder: b }))} />
            <Num label="Not accepted after" unit="min" value={v('notAcceptedMin')} set={(n) => setDraft((d) => ({ ...d, notAcceptedMin: n }))} />
            <Num label="Ready with no rider or Porter after" unit="min" value={v('readyNoCarrierMin')} set={(n) => setDraft((d) => ({ ...d, readyNoCarrierMin: n }))} />
            <Toggle label="Book Porter now" help="when no own rider can make it in time"
              on={!!v('alertBookPorter')} set={(b) => setDraft((d) => ({ ...d, alertBookPorter: b }))} />
            <Toggle label="Order running late" on={!!v('alertRunningLate')} set={(b) => setDraft((d) => ({ ...d, alertRunningLate: b }))} />
          </div>
        </div>
      )}

      {cfg && (
        <div className="wa-bar">
          <span>{dirty ? 'Unsaved changes' : 'All saved'}</span>
          <button className="wa-ghost" disabled={!dirty || busy} onClick={() => setDraft({})}>Discard</button>
          <button className="wa-save" disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      )}

      <div className="wa-card">
        <h3>Send a test</h3>
        <div className="wa-test">
          <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Your WhatsApp number" inputMode="tel" />
          <button className="wa-save" disabled={busy || !testTo.trim()} onClick={sendTest}>Send test alert</button>
        </div>
        <p className="wa-note">Uses the <code>bt_kitchen_alert</code> template, so it only arrives once that template is approved.</p>
      </div>

      <div className="wa-card">
        <h3>Recent messages</h3>
        {!log.length ? <p className="wa-note">Nothing sent yet.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="wa-table">
              <thead><tr><th>When</th><th>To</th><th>Message</th><th>Order</th><th>Status</th></tr></thead>
              <tbody>
                {log.map((r) => {
                  const tone = STATUS_TONE[r.status] || STATUS_TONE.pending;
                  return (
                    <tr key={r.id}>
                      <td>{new Date(r.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</td>
                      <td>{r.audience === 'staff' ? 'Staff ' : ''}{r.to_phone}</td>
                      <td>{KIND_LABEL(r.kind)}</td>
                      <td>{r.order_number || '—'}</td>
                      <td>
                        <span className="wa-pill" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>
                        {r.last_error && r.status !== 'sent' && r.status !== 'delivered' && r.status !== 'read' && (
                          <div className="wa-errline" title={r.last_error}>{r.last_error}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {st && (
        <details className="wa-card">
          <summary><b>Templates to submit in WhatsApp Manager</b> (category Utility, language English)</summary>
          {st.templates.map((t) => (
            <div key={t.name} className="wa-tpl">
              <code>{t.name}</code>
              <p>{t.text}</p>
              <span>Variables: {t.vars.map((x, i) => `{{${i + 1}}} ${x}`).join(' · ')}</span>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

function Toggle({ label, help, on, set }: { label: string; help?: string; on: boolean; set: (b: boolean) => void }) {
  return (
    <label className="wa-toggle">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      <span><b>{label}</b>{help && <em>{help}</em>}</span>
    </label>
  );
}

function Num({ label, unit, value, set }: { label: string; unit: string; value?: number; set: (n: number) => void }) {
  return (
    <label className="wa-num">
      <span>{label}</span>
      <input type="number" min={0} max={240} value={value ?? ''} onChange={(e) => set(Number(e.target.value))} />
      <em>{unit} {value === 0 ? '(off)' : ''}</em>
    </label>
  );
}

const CSS = `
.wa-err{background:#fdecea;color:#a93226;padding:10px 13px;border-radius:12px;font-size:13px;font-weight:700;margin-bottom:12px}
.wa-card{background:#fff;border:1px solid ${C.line};border-radius:14px;padding:13px 14px;margin-bottom:12px}
.wa-card h3{font-size:13.5px;font-weight:900;color:${C.ink};margin:0 0 8px}
.wa-setup{border-left:4px solid #c0392b}
.wa-setup[data-ok="1"]{border-left-color:${C.green}}
.wa-setup-head{display:flex;gap:11px;align-items:flex-start;flex-wrap:wrap}
.wa-setup-head b{display:block;font-size:14px;color:${C.ink}}
.wa-setup-head span{font-size:12px;color:${C.muted}}
.wa-dot{width:11px;height:11px;border-radius:99px;background:#c0392b;margin-top:4px;flex:none}
.wa-setup[data-ok="1"] .wa-dot{background:${C.green}}
.wa-counts{margin-left:auto;display:flex;gap:12px;font-size:12px;color:${C.muted}}
.wa-counts b{color:${C.ink};font-size:15px;margin-right:3px}
.wa-counts span[data-bad="1"] b{color:#a93226}
.wa-checks{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:4px;font-size:12px;color:${C.ink}}
.wa-checks li::before{content:'✗ ';color:#a93226;font-weight:900}
.wa-checks li[data-ok="1"]::before{content:'✓ ';color:${C.greenDeep}}
.wa-checks code,.wa-note code{font-size:11.5px;background:${C.bg};padding:1px 5px;border-radius:5px}
.wa-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.wa-toggle{display:flex;gap:9px;align-items:flex-start;padding:8px 0;border-top:1px dashed ${C.line};cursor:pointer}
.wa-toggle:first-of-type{border-top:none}
.wa-toggle input{width:17px;height:17px;margin-top:2px;accent-color:${C.green}}
.wa-toggle b{display:block;font-size:13px;color:${C.ink}}
.wa-toggle em{display:block;font-style:normal;font-size:11.5px;color:${C.muted}}
.wa-field{display:flex;flex-direction:column;gap:4px;padding:8px 0;border-top:1px dashed ${C.line}}
.wa-field span{font-size:11.5px;font-weight:800;color:${C.muted}}
.wa-field input,.wa-test input{padding:9px 10px;border-radius:9px;border:1px solid ${C.line};font-family:inherit;font-size:13px;color:${C.ink}}
.wa-num{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px dashed ${C.line};font-size:13px;color:${C.ink};font-weight:700}
.wa-num span{flex:1}
.wa-num input{width:70px;padding:7px 8px;border-radius:9px;border:1px solid ${C.line};font-family:inherit;text-align:right}
.wa-num em{font-style:normal;font-size:11.5px;color:${C.muted};min-width:52px}
.wa-note{font-size:11.5px;color:${C.muted};margin:8px 0 0;line-height:1.45}
.wa-bar{display:flex;align-items:center;gap:10px;justify-content:flex-end;margin:-2px 0 12px}
.wa-bar span{margin-right:auto;font-size:12px;color:${C.muted};font-weight:700}
.wa-save{padding:10px 16px;border-radius:11px;border:none;background:${C.dark};color:#fff;font-weight:900;font-size:13px;cursor:pointer;font-family:inherit;white-space:nowrap}
.wa-save:disabled{background:${C.muted};cursor:default}
.wa-ghost{padding:10px 14px;border-radius:11px;border:1px solid ${C.line};background:#fff;color:${C.ink};font-weight:800;font-size:13px;cursor:pointer;font-family:inherit}
.wa-test{display:flex;gap:8px;flex-wrap:wrap}
.wa-test input{flex:1;min-width:180px}
.wa-table{width:100%;border-collapse:collapse;font-size:12.5px}
.wa-table th{text-align:left;font-size:11px;color:${C.muted};font-weight:800;padding:6px 8px;border-bottom:1px solid ${C.line}}
.wa-table td{padding:7px 8px;border-bottom:1px solid ${C.line};color:${C.ink};vertical-align:top}
.wa-pill{font-size:11px;font-weight:900;padding:2px 8px;border-radius:99px;white-space:nowrap}
.wa-errline{font-size:11px;color:#a93226;margin-top:3px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wa-tpl{padding:10px 0;border-top:1px dashed ${C.line}}
.wa-tpl code{font-size:12px;font-weight:800;color:${C.greenDeep}}
.wa-tpl p{margin:4px 0;font-size:13px;color:${C.ink};line-height:1.5}
.wa-tpl span{font-size:11.5px;color:${C.muted}}
details.wa-card summary{cursor:pointer;font-size:13px;color:${C.ink}}
@media (max-width:760px){.wa-grid{grid-template-columns:1fr}}
`;
