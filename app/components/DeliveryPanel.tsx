'use client';

/**
 * Admin → Delivery. Three tabs:
 *   Report — are we keeping our promises, and at what cost (PRD: Goals)
 *   Rules  — batching limits, promises, auto-dispatch (store_settings.dispatch_config)
 *   Model  — rebuild the learned time model; run dispatch now
 */

import { useCallback, useEffect, useState } from 'react';
import { C, money } from '../lib/bite';

type Report = {
  from: string; to: string;
  totals: {
    delivered: number; onTimePct: number | null; withPromise: number;
    promiseErrorMedianMin: number | null; foodWaitMedianMin: number | null; foodAgeP90Min: number | null;
    totalTimeMedianMin: number | null; porterSharePct: number | null; batchedSharePct: number | null;
    costPerDelivery: number | null; madeGood: number; delayAlerts: number;
    rating: number | null; ratingCount: number;
  };
  daily: { date: string; delivered: number; onTimePct: number | null; promiseErrorMedianMin: number | null }[];
  riders: { id: number; name: string; delivered: number; trips: number; onTimePct: number | null; earned: number }[];
};

export type DeliveryApi = {
  deliveryReport: (from: string, to: string) => Promise<Report>;
  adminSettings: () => Promise<{ dispatchConfig?: Record<string, unknown> }>;
  saveDispatchConfig: (cfg: Record<string, unknown>) => Promise<{ dispatchConfig?: Record<string, unknown> }>;
  recomputeEta: () => Promise<{ band: string; part: string; n: number; median: number; p80: number }[]>;
  runDispatchNow: () => Promise<unknown>;
};

const ymd = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const dash = (v: number | null | undefined, unit = '') => (v == null ? '—' : `${v}${unit}`);

/* Proposed targets from the PRD; shown with a word, never colour alone. */
const TARGET = { onTimePct: 90, promiseErrorMedianMin: 5, foodWaitMedianMin: 5, foodAgeP90Min: 30, rating: 4.5 };

/* The rules people actually tune, with plain-language help. */
const RULES: { key: string; label: string; help: string; unit?: string; kind: 'num' | 'bool'; min?: number; max?: number }[] = [
  { key: 'batchMaxOrders', label: 'Orders per trip', help: '1 turns batching off. 3 once on-time holds.', kind: 'num', min: 1, max: 3 },
  { key: 'batchMaxExtraMin', label: 'Max extra wait per customer', help: 'vs a solo drop', unit: 'min', kind: 'num', min: 0, max: 30 },
  { key: 'batchReadyGapMin', label: 'Ready times within', help: 'food never waits for a slow partner order', unit: 'min', kind: 'num', min: 0, max: 20 },
  { key: 'foodAgeMaxMin', label: 'Max food age', help: 'ready → delivered, every order on a trip', unit: 'min', kind: 'num', min: 10, max: 90 },
  { key: 'batchBonus', label: 'Batch bonus', help: 'paid to the rider per extra order on a trip', unit: '₹', kind: 'num', min: 0, max: 200 },
  { key: 'delayAlertMin', label: 'Apologise when late by', help: 'live ETA past the promise', unit: 'min', kind: 'num', min: 0, max: 60 },
  { key: 'lateMakegoodMin', label: 'Make good when late by', help: 'delivered this long after the promise', unit: 'min', kind: 'num', min: 0, max: 120 },
  { key: 'lateMakegoodAmount', label: 'Make-good wallet credit', help: '0 turns it off', unit: '₹', kind: 'num', min: 0, max: 500 },
  { key: 'porterArrivalMin', label: 'Porter arrival time', help: 'used until the model learns it', unit: 'min', kind: 'num', min: 1, max: 60 },
  { key: 'defaultSpeedKmph', label: 'Rider speed (fallback)', help: 'straight-line km/h incl. traffic; learned later', unit: 'km/h', kind: 'num', min: 3, max: 60 },
  { key: 'kitchenParallel', label: 'Kitchen cooks at once', help: 'orders before the queue slows the promise', kind: 'num', min: 1, max: 20 },
  { key: 'autoDispatch', label: 'Auto-dispatch', help: 'assign riders and trips without a tap (Porter still needs you)', kind: 'bool' },
];

export default function DeliveryPanel({ api, showToast }: { api: DeliveryApi; showToast: (m: string) => void }) {
  const [tab, setTab] = useState<'report' | 'rules' | 'model'>('report');
  const [from, setFrom] = useState(ymd(daysAgo(6)));
  const [to, setTo] = useState(ymd(new Date()));
  const [report, setReport] = useState<Report | null>(null);
  const [err, setErr] = useState('');
  const [cfg, setCfg] = useState<Record<string, unknown> | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<{ band: string; part: string; n: number; median: number; p80: number }[] | null>(null);

  const loadReport = useCallback(async () => {
    try { setReport(await api.deliveryReport(from, to)); setErr(''); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Could not load the report'); }
  }, [api, from, to]);

  const loadCfg = useCallback(async () => {
    try { const s = await api.adminSettings(); setCfg(s.dispatchConfig || {}); setDraft({}); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Could not load the rules'); }
  }, [api]);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (!alive) return; return tab === 'report' ? loadReport() : loadCfg(); });
    return () => { alive = false; };
  }, [tab, loadReport, loadCfg]);

  const save = async () => {
    if (!Object.keys(draft).length) return;
    setBusy(true);
    try {
      const s = await api.saveDispatchConfig(draft);
      setCfg(s.dispatchConfig || {}); setDraft({});
      showToast('Delivery rules saved');
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Could not save'); }
    finally { setBusy(false); }
  };

  const val = (k: string) => (k in draft ? draft[k] : cfg?.[k]);
  const t = report?.totals;

  return (
    <div>
      <style>{CSS}</style>
      <div className="dp-head">
        <div>
          <h2>Delivery</h2>
          <p>Are we keeping our promises, and at what cost per delivery.</p>
        </div>
        <div className="dp-tabs" role="tablist">
          {(['report', 'rules', 'model'] as const).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} data-on={tab === k ? '1' : '0'} onClick={() => setTab(k)}>
              {k === 'report' ? 'Report' : k === 'rules' ? 'Rules' : 'Time model'}
            </button>
          ))}
        </div>
      </div>
      {err && <div className="dp-err">{err}</div>}

      {tab === 'report' && (
        <>
          <div className="dp-range">
            <label>From <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
            <label>To <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
            {[7, 30].map((n) => (
              <button key={n} onClick={() => { setFrom(ymd(daysAgo(n - 1))); setTo(ymd(new Date())); }}>Last {n} days</button>
            ))}
          </div>

          {!report && !err && <div className="dp-skel" />}
          {t && (
            <>
              <div className="dp-tiles">
                <Tile label="On time" value={dash(t.onTimePct, '%')} target={`target ${TARGET.onTimePct}%`}
                  ok={t.onTimePct == null ? null : t.onTimePct >= TARGET.onTimePct}
                  sub={`${t.withPromise} of ${t.delivered} orders had a promise`} />
                <Tile label="Promise error (median)" value={dash(t.promiseErrorMedianMin, ' min')} target={`within ${TARGET.promiseErrorMedianMin} min`}
                  ok={t.promiseErrorMedianMin == null ? null : Math.abs(t.promiseErrorMedianMin) <= TARGET.promiseErrorMedianMin}
                  sub="negative = early" />
                <Tile label="Food wait (median)" value={dash(t.foodWaitMedianMin, ' min')} target={`under ${TARGET.foodWaitMedianMin} min`}
                  ok={t.foodWaitMedianMin == null ? null : t.foodWaitMedianMin < TARGET.foodWaitMedianMin}
                  sub="ready → picked up" />
                <Tile label="Food age (worst 10%)" value={dash(t.foodAgeP90Min, ' min')} target={`under ${TARGET.foodAgeP90Min} min`}
                  ok={t.foodAgeP90Min == null ? null : t.foodAgeP90Min < TARGET.foodAgeP90Min}
                  sub="ready → delivered" />
                <Tile label="Cost per delivery" value={t.costPerDelivery == null ? '—' : money(t.costPerDelivery)}
                  sub="rider pay + Porter fees" />
                <Tile label="Delivered" value={String(t.delivered)}
                  sub={`${dash(t.batchedSharePct, '%')} shared trips · ${dash(t.porterSharePct, '%')} Porter`} />
                <Tile label="Delivery rating" value={t.rating == null ? '—' : `${t.rating} ★`} target={`target ${TARGET.rating}`}
                  ok={t.rating == null ? null : t.rating >= TARGET.rating} sub={`${t.ratingCount} reviews`} />
                <Tile label="Apologies · make-goods" value={`${t.delayAlerts} · ${t.madeGood}`} sub="delay messages sent · wallet credits" />
              </div>

              <div className="dp-grid2">
                <section>
                  <h3>By day</h3>
                  {report!.daily.length === 0 ? <p className="dp-empty">No deliveries in these dates.</p> : (
                    <table className="dp-table">
                      <thead><tr><th>Date</th><th>Delivered</th><th>On time</th><th>Promise error</th></tr></thead>
                      <tbody>
                        {[...report!.daily].reverse().map((d) => (
                          <tr key={d.date}>
                            <td>{new Date(d.date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                            <td>{d.delivered}</td>
                            <td>{dash(d.onTimePct, '%')}</td>
                            <td>{dash(d.promiseErrorMedianMin, ' min')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
                <section>
                  <h3>By rider</h3>
                  {report!.riders.length === 0 ? <p className="dp-empty">No own-rider deliveries in these dates.</p> : (
                    <table className="dp-table">
                      <thead><tr><th>Rider</th><th>Delivered</th><th>Trips</th><th>On time</th><th>Earned</th></tr></thead>
                      <tbody>
                        {report!.riders.map((r) => (
                          <tr key={r.id}>
                            <td>{r.name}</td><td>{r.delivered}</td><td>{r.trips}</td>
                            <td>{dash(r.onTimePct, '%')}</td><td>{money(r.earned)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'rules' && cfg && (
        <div className="dp-card">
          {RULES.map((r) => (
            <div key={r.key} className="dp-rule">
              <div>
                <b>{r.label}</b>
                <span>{r.help}</span>
              </div>
              {r.kind === 'bool' ? (
                <label className="dp-switch">
                  <input type="checkbox" checked={!!val(r.key)}
                    onChange={(e) => setDraft((d) => ({ ...d, [r.key]: e.target.checked }))} />
                  <span>{val(r.key) ? 'On' : 'Off'}</span>
                </label>
              ) : (
                <div className="dp-num">
                  {r.unit === '₹' && <em>₹</em>}
                  <input type="number" min={r.min} max={r.max} value={String(val(r.key) ?? '')}
                    onChange={(e) => setDraft((d) => ({ ...d, [r.key]: e.target.value === '' ? '' : Number(e.target.value) }))} />
                  {r.unit && r.unit !== '₹' && <em>{r.unit}</em>}
                </div>
              )}
            </div>
          ))}
          <div className="dp-foot">
            <span>{Object.keys(draft).length ? `${Object.keys(draft).length} unsaved change${Object.keys(draft).length > 1 ? 's' : ''}` : 'All saved'}</span>
            <button onClick={() => setDraft({})} disabled={!Object.keys(draft).length || busy} className="dp-ghost">Discard</button>
            <button onClick={save} disabled={!Object.keys(draft).length || busy} className="dp-save">{busy ? 'Saving…' : 'Save rules'}</button>
          </div>
        </div>
      )}

      {tab === 'model' && (
        <div className="dp-card">
          <p className="dp-lead">
            The promise each customer sees is learned from your own deliveries: accept time, how far cooking drifts from the
            estimate, food waiting for a rider, and real riding speed, per time of day. It rebuilds by itself every 12 hours;
            a stage needs 20 deliveries in a time band before it replaces the default.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="dp-save" disabled={busy} onClick={async () => {
              setBusy(true);
              try { setModel(await api.recomputeEta()); showToast('Time model rebuilt'); }
              catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Could not rebuild'); }
              finally { setBusy(false); }
            }}>Rebuild now</button>
            <button className="dp-ghost" disabled={busy} onClick={async () => {
              setBusy(true);
              try { await api.runDispatchNow(); showToast('Dispatch ran: delay messages and auto-dispatch checked'); }
              catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Could not run'); }
              finally { setBusy(false); }
            }}>Run dispatch now</button>
          </div>
          {model && (
            model.length === 0 ? <p className="dp-empty">No delivered orders with timings yet. Defaults are in use.</p> : (
              <table className="dp-table" style={{ marginTop: 14 }}>
                <thead><tr><th>Time of day</th><th>Stage</th><th>Typical</th><th>Slow end (80%)</th><th>Orders</th><th>In use</th></tr></thead>
                <tbody>
                  {model.map((m) => (
                    <tr key={m.band + m.part}>
                      <td style={{ textTransform: 'capitalize' }}>{m.band}</td>
                      <td>{PART_LABEL[m.part] || m.part}</td>
                      <td>{fmtPart(m.part, m.median)}</td>
                      <td>{fmtPart(m.part, m.p80)}</td>
                      <td>{m.n}</td>
                      <td>{m.n >= 20 ? 'Yes' : `No (needs ${20 - m.n} more)`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      )}
    </div>
  );
}

const PART_LABEL: Record<string, string> = {
  accept: 'Accept', prep_ratio: 'Cooking vs estimate', handoff: 'Food waiting for rider',
  speed: 'Riding time per km', porter_arrival: 'Porter arrival',
};
const fmtPart = (part: string, v: number) =>
  part === 'prep_ratio' ? `×${Number(v).toFixed(2)}` : part === 'speed' ? `${Number(v).toFixed(1)} min/km` : `${Number(v).toFixed(1)} min`;

function Tile({ label, value, sub, target, ok }: { label: string; value: string; sub?: string; target?: string; ok?: boolean | null }) {
  return (
    <div className="dp-tile">
      <div className="dp-tile-label">{label}</div>
      <div className="dp-tile-value">{value}</div>
      {target && (
        <div className="dp-tile-target" data-ok={ok == null ? '' : ok ? '1' : '0'}>
          {ok == null ? target : `${ok ? '✓ On target' : '✗ Off target'} · ${target}`}
        </div>
      )}
      {sub && <div className="dp-tile-sub">{sub}</div>}
    </div>
  );
}

const CSS = `
.dp-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.dp-head h2{font-size:19px;font-weight:900;color:${C.ink};margin:0}
.dp-head p{font-size:12.5px;color:${C.muted};margin:3px 0 0}
.dp-tabs{display:flex;gap:6px}
.dp-tabs button{padding:8px 14px;border-radius:20px;border:1px solid ${C.line};background:#fff;color:${C.muted};font-weight:800;
  font-size:12.5px;cursor:pointer;font-family:inherit}
.dp-tabs button[data-on="1"]{border-color:${C.green};background:${C.greenSoft};color:${C.greenDeep}}
.dp-err{background:#fdecea;color:#a93226;padding:10px 13px;border-radius:12px;font-size:13px;font-weight:700;margin-bottom:12px}
.dp-range{display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:#fff;border:1px solid ${C.line};border-radius:14px;
  padding:11px 13px;margin-bottom:12px;font-size:12px;font-weight:800;color:${C.muted}}
.dp-range input{margin-left:6px;padding:7px 9px;border-radius:9px;border:1px solid ${C.line};font-family:inherit;color:${C.ink}}
.dp-range button{padding:7px 12px;border-radius:18px;border:1px solid ${C.line};background:#fff;font-weight:800;font-size:12px;
  color:${C.ink};cursor:pointer;font-family:inherit}
.dp-skel{height:220px;border-radius:14px;background:linear-gradient(90deg,#eef2ef 25%,#f7f9f7 50%,#eef2ef 75%);
  background-size:200% 100%;animation:dpShim 1.2s infinite}
.dp-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:14px}
.dp-tile{background:#fff;border:1px solid ${C.line};border-radius:14px;padding:12px 13px}
.dp-tile-label{font-size:11.5px;font-weight:800;color:${C.muted}}
.dp-tile-value{font-size:24px;font-weight:900;color:${C.ink};margin-top:4px;font-variant-numeric:tabular-nums}
.dp-tile-target{font-size:11px;font-weight:800;color:${C.muted};margin-top:3px}
.dp-tile-target[data-ok="1"]{color:${C.greenDeep}}
.dp-tile-target[data-ok="0"]{color:#a93226}
.dp-tile-sub{font-size:11px;color:${C.muted};margin-top:3px}
.dp-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.dp-grid2 section{background:#fff;border:1px solid ${C.line};border-radius:14px;padding:12px 13px;min-width:0;overflow-x:auto}
.dp-grid2 h3{font-size:13.5px;font-weight:900;color:${C.ink};margin:0 0 8px}
.dp-table{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}
.dp-table th{text-align:left;font-size:11px;color:${C.muted};font-weight:800;padding:6px 8px;border-bottom:1px solid ${C.line}}
.dp-table td{padding:7px 8px;border-bottom:1px solid ${C.line};color:${C.ink}}
.dp-empty{font-size:12.5px;color:${C.muted};margin:8px 0 0}
.dp-card{background:#fff;border:1px solid ${C.line};border-radius:14px;padding:14px}
.dp-rule{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:10px 0;border-bottom:1px dashed ${C.line}}
.dp-rule b{display:block;font-size:13.5px;color:${C.ink}}
.dp-rule span{font-size:11.5px;color:${C.muted}}
.dp-num{display:flex;align-items:center;gap:6px}
.dp-num input{width:84px;padding:8px 9px;border-radius:9px;border:1px solid ${C.line};font-family:inherit;font-size:13.5px;
  color:${C.ink};text-align:right}
.dp-num em{font-style:normal;font-size:12px;color:${C.muted};font-weight:800}
.dp-switch{display:flex;align-items:center;gap:8px;font-weight:800;font-size:12.5px;color:${C.ink};cursor:pointer}
.dp-switch input{width:18px;height:18px;accent-color:${C.green}}
.dp-foot{display:flex;align-items:center;gap:10px;justify-content:flex-end;padding-top:12px}
.dp-foot span{margin-right:auto;font-size:12px;color:${C.muted};font-weight:700}
.dp-save{padding:10px 16px;border-radius:11px;border:none;background:${C.dark};color:#fff;font-weight:900;font-size:13px;
  cursor:pointer;font-family:inherit}
.dp-save:disabled{background:${C.muted};cursor:default}
.dp-ghost{padding:10px 14px;border-radius:11px;border:1px solid ${C.line};background:#fff;color:${C.ink};font-weight:800;
  font-size:13px;cursor:pointer;font-family:inherit}
.dp-lead{font-size:13px;color:${C.ink};line-height:1.55;margin:0 0 12px;max-width:720px}
@media (max-width:760px){.dp-grid2{grid-template-columns:1fr}}
@keyframes dpShim{from{background-position:200% 0}to{background-position:-200% 0}}
`;
