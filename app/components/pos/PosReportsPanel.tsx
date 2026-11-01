'use client';

/**
 * Admin → Counter Reports. Walk-in sales per outlet: totals, payment split,
 * GST (taxable / CGST / SGST and the bill-number range for the return),
 * day-wise and hour-wise sales, best sellers, cancellations. Bills and
 * dish-wise exports as CSV; a day-close slip for the thermal printer.
 */
import { useCallback, useEffect, useState } from 'react';
import { C, fetchStoreSettings, type InvoiceConfig } from '../../lib/bite';
import type { PosApi, PosSummary } from '../../lib/pos';
import { printDayClose, type PosOutlet } from '../../lib/posPrint';

const RED = '#d64545';
const rs = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const rs0 = (n: number) => '₹' + Math.round(Number(n || 0)).toLocaleString('en-IN');
const PAY: Record<string, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', other: 'Other' };

/** business day in India, with the usual 4 am roll-over */
function istDay(offsetDays = 0): string {
  const d = new Date(Date.now() + 330 * 60_000 - 4 * 3_600_000 + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}
const monthStart = (ymd: string, back = 0) => {
  const [y, m] = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - back, 1));
  return d.toISOString().slice(0, 10);
};
const monthEnd = (ymd: string, back = 0) => {
  const [y, m] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - back, 0)).toISOString().slice(0, 10);
};
const shortDay = (ymd: string) => new Date(ymd + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const hourLbl = (h: number) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`);

const RANGES = [
  { key: 'today', label: 'Today', get: () => [istDay(), istDay()] },
  { key: 'yday', label: 'Yesterday', get: () => [istDay(-1), istDay(-1)] },
  { key: '7d', label: 'Last 7 days', get: () => [istDay(-6), istDay()] },
  { key: 'month', label: 'This month', get: () => [monthStart(istDay()), istDay()] },
  { key: 'lmonth', label: 'Last month', get: () => [monthStart(istDay(), 1), monthEnd(istDay(), 1)] },
] as const;

export default function PosReportsPanel({ api, showToast }: { api: PosApi; showToast: (m: string) => void }) {
  const [outlets, setOutlets] = useState<PosOutlet[]>([]);
  const [outletId, setOutletId] = useState<number | null>(null);
  const [range, setRange] = useState<string>('today');
  const [from, setFrom] = useState(istDay());
  const [to, setTo] = useState(istDay());
  const [data, setData] = useState<PosSummary | null>(null);
  const [err, setErr] = useState('');
  const [cfg, setCfg] = useState<Partial<InvoiceConfig> | null>(null);

  useEffect(() => {
    let live = true;
    api.allOutlets().then((l) => live && setOutlets(l)).catch(() => { /* reports still work for "all" */ });
    fetchStoreSettings().then((s: { invoiceConfig?: Partial<InvoiceConfig> }) => live && setCfg(s?.invoiceConfig || {})).catch(() => {});
    return () => { live = false; };
  }, [api]);

  const load = useCallback(async () => {
    try { setData(await api.summary(from, to, outletId)); setErr(''); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not load the report'); }
  }, [api, from, to, outletId]);
  useEffect(() => {
    let live = true;
    api.summary(from, to, outletId).then((d) => { if (live) { setData(d); setErr(''); } })
      .catch((e: Error) => live && setErr(e.message));
    return () => { live = false; };
  }, [api, from, to, outletId]);

  const pick = (key: string) => {
    const r = RANGES.find((x) => x.key === key);
    setRange(key);
    if (r) { const [f, t] = r.get(); setFrom(f); setTo(t); }
  };

  const exportCsv = async (kind: 'bills' | 'items') => {
    try { await api.downloadCsv(kind, from, to, outletId); }
    catch (e) { showToast(e instanceof Error ? e.message : 'Export failed'); }
  };

  const dayClose = () => {
    if (!data) return;
    const name = outletId ? outlets.find((o) => o.id === outletId)?.name || 'Outlet' : 'All outlets';
    printDayClose({
      title: name, from, to,
      totals: data.totals, byPayment: data.byPayment, byOutlet: data.byOutlet, topItems: data.topItems,
    }, cfg);
  };

  const t = data?.totals;
  const maxDay = Math.max(1, ...(data?.byDay || []).map((d) => d.amount));
  const hours = (() => {
    const h = data?.byHour || [];
    if (!h.length) return [];
    const lo = Math.min(...h.map((x) => x.hour)); const hi = Math.max(...h.map((x) => x.hour));
    return Array.from({ length: hi - lo + 1 }, (_, i) => h.find((x) => x.hour === lo + i) || { hour: lo + i, bills: 0, amount: 0 });
  })();
  const maxHour = Math.max(1, ...hours.map((h) => h.amount));
  const payTotal = (data?.byPayment || []).reduce((s, p) => s + p.amount, 0) || 1;

  return (
    <div className="rep">
      <style>{CSS}</style>
      <div className="rep-head">
        <div>
          <h1>Counter Reports</h1>
          <p>Walk-in sales from the counter. Cancelled bills are left out of sales and listed separately.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="rep-ghost" onClick={() => exportCsv('bills')}>⬇ Bills CSV</button>
          <button className="rep-ghost" onClick={() => exportCsv('items')}>⬇ Dish-wise CSV</button>
          <button className="rep-btn" onClick={dayClose} disabled={!data}>🖨️ Day close slip</button>
        </div>
      </div>

      <div className="rep-filters">
        <select value={outletId ?? ''} onChange={(e) => setOutletId(e.target.value ? Number(e.target.value) : null)} aria-label="Outlet">
          <option value="">All outlets</option>
          {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <div className="rep-seg">
          {RANGES.map((r) => <button key={r.key} className={range === r.key ? 'on' : ''} onClick={() => pick(r.key)}>{r.label}</button>)}
        </div>
        <input type="date" value={from} max={to} onChange={(e) => { setRange('custom'); setFrom(e.target.value); }} aria-label="From" />
        <span className="rep-muted">to</span>
        <input type="date" value={to} min={from} onChange={(e) => { setRange('custom'); setTo(e.target.value); }} aria-label="To" />
        <button className="rep-ghost" onClick={load} title="Refresh">↻</button>
      </div>

      {err && <div className="rep-err">{err}</div>}

      <div className="rep-kpis">
        <Kpi label="Net sales" value={t ? rs0(t.netSales) : null} big />
        <Kpi label="Bills" value={t ? String(t.bills) : null} />
        <Kpi label="Average bill" value={t ? rs0(t.avgBill) : null} />
        <Kpi label="Dishes sold" value={t ? String(t.items) : null} />
        <Kpi label="GST collected" value={t ? rs(t.tax) : null} sub={t && t.tax > 0 ? `CGST ${rs(t.cgst)} · SGST ${rs(t.sgst)}` : 'GST is off'} />
        <Kpi label="Discounts" value={t ? rs(t.discount) : null} />
        <Kpi label="Cancelled" value={t ? `${t.cancelledBills}` : null} sub={t ? rs(t.cancelledAmount) : ''} warn={!!t?.cancelledBills} />
      </div>

      <div className="rep-cols">
        <Card title="Payment split">
          {!data?.byPayment.length && <Empty />}
          {data?.byPayment.map((p) => (
            <div key={p.method} className="rep-hbar" title={`${PAY[p.method] || p.method}: ${rs(p.amount)} from ${p.bills} bills`}>
              <span className="rep-hl">{PAY[p.method] || p.method}</span>
              <span className="rep-track"><i style={{ width: `${(p.amount / payTotal) * 100}%` }} /></span>
              <span className="rep-hv"><b>{rs0(p.amount)}</b><small>{Math.round((p.amount / payTotal) * 100)}% · {p.bills} bills</small></span>
            </div>
          ))}
          {!!data?.byType.length && (
            <div className="rep-types">
              {data.byType.map((x) => <span key={x.type}>{x.type === 'dine_in' ? 'Dine in' : 'Takeaway'}: <b>{x.bills}</b> · {rs0(x.amount)}</span>)}
            </div>
          )}
        </Card>

        <Card title={hours.length ? 'Sales by hour' : 'Sales by hour'}>
          {!hours.length && <Empty />}
          {hours.length > 0 && (
            <div className="rep-vbars" role="img" aria-label="Sales by hour of day">
              {hours.map((h) => (
                <div key={h.hour} className="rep-vcol" title={`${hourLbl(h.hour)}: ${rs(h.amount)} · ${h.bills} bills`}>
                  <span className="rep-vbar"><i style={{ height: `${(h.amount / maxHour) * 100}%` }} /></span>
                  <small>{hourLbl(h.hour)}</small>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {(data?.byDay.length || 0) > 1 && (
        <Card title="Day by day">
          <div className="rep-vbars days" role="img" aria-label="Sales by day">
            {data!.byDay.map((d) => (
              <div key={d.date} className="rep-vcol" title={`${shortDay(d.date)}: ${rs(d.amount)} · ${d.bills} bills`}>
                <span className="rep-vbar"><i style={{ height: `${(d.amount / maxDay) * 100}%` }} /></span>
                <small>{shortDay(d.date)}</small>
              </div>
            ))}
          </div>
          <Table head={['Day', 'Bills', 'Sales']} rows={data!.byDay.map((d) => [shortDay(d.date), String(d.bills), rs(d.amount)])} />
        </Card>
      )}

      <Card title="Outlets & GST">
        {!data?.byOutlet.length ? <Empty /> : (
          <Table
            head={['Outlet', 'Bills', 'Sales', 'Discount', 'Taxable', 'CGST', 'SGST', 'Cancelled', 'Bill numbers']}
            rows={data.byOutlet.map((o) => [
              `${o.name}${o.gstin ? `\n${o.gstin}` : ''}`, String(o.bills), rs(o.amount), rs(o.discount), rs(o.taxable),
              rs(o.cgst), rs(o.sgst), String(o.cancelled),
              o.firstBillNo ? `${o.firstBillNo} → ${o.lastBillNo}` : '—',
            ])} />
        )}
      </Card>

      <div className="rep-cols">
        <Card title="Best sellers">
          {!data?.topItems.length ? <Empty /> : (
            <Table head={['Dish', 'Qty', 'Amount']} rows={data.topItems.slice(0, 15).map((i) => [`${i.name}${i.category ? `\n${i.category}` : ''}`, String(i.qty), rs(i.amount)])} />
          )}
        </Card>
        <Card title="Categories">
          {!data?.byCategory.length ? <Empty /> : (
            <Table head={['Category', 'Qty', 'Amount']} rows={data.byCategory.map((c) => [c.category, String(c.qty), rs(c.amount)])} />
          )}
          <p className="rep-muted" style={{ margin: '8px 0 0' }}>Dish amounts are before bill discounts.</p>
        </Card>
      </div>

      {!!data?.cancelled.length && (
        <Card title="Cancelled bills">
          <Table head={['Token', 'Bill', 'Amount', 'Reason', 'Cancelled by', 'Billed by']}
            rows={data.cancelled.map((c) => [String(c.token).padStart(3, '0'), `${c.billNo}\n${c.outlet}`, rs(c.total), c.reason, `${c.cancelledBy}\n${new Date(c.cancelledAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`, c.cashierName || '—'])} />
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, big, warn }: { label: string; value: string | null; sub?: string; big?: boolean; warn?: boolean }) {
  return (
    <div className={`rep-kpi ${big ? 'big' : ''}`}>
      <span>{label}</span>
      {value === null ? <i className="rep-skel" /> : <b style={warn ? { color: RED } : undefined}>{value}</b>}
      {sub && <small>{sub}</small>}
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rep-card"><h3>{title}</h3>{children}</section>;
}
function Empty() { return <div className="rep-muted" style={{ padding: '14px 0' }}>No bills in this period.</div>; }
function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="rep-tablewrap">
      <table className="rep-table">
        <thead><tr>{head.map((h, i) => <th key={i} className={i ? 'n' : ''}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => {
            const [main, sub] = c.split('\n');
            return <td key={j} className={j ? 'n' : ''}>{main}{sub && <small>{sub}</small>}</td>;
          })}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

const CSS = `
.rep * { box-sizing:border-box; }
.rep input, .rep select { font:inherit; font-size:13.5px; padding:8px 10px; border-radius:10px; border:1px solid ${C.line}; background:#fff; color:${C.ink}; }
.rep-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:12px; }
.rep-head h1 { margin:0; font-size:22px; color:${C.dark}; }
.rep-head p { margin:4px 0 0; color:${C.muted}; font-size:13.5px; }
.rep-btn { font:inherit; font-weight:800; font-size:13.5px; padding:9px 14px; border-radius:11px; border:none; background:${C.green}; color:#fff; cursor:pointer; }
.rep-btn:hover:not(:disabled) { background:${C.greenDeep}; }
.rep-ghost { font:inherit; font-weight:700; font-size:13px; padding:8px 12px; border-radius:10px; border:1px solid ${C.line}; background:#fff; color:${C.dark}; cursor:pointer; }
.rep-ghost:hover { border-color:${C.green}; }
.rep-filters { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:14px; }
.rep-seg { display:flex; background:${C.bg}; border-radius:11px; padding:3px; gap:2px; flex-wrap:wrap; }
.rep-seg button { font:inherit; font-weight:700; font-size:12.5px; padding:7px 11px; border:none; border-radius:8px; background:transparent; color:${C.muted}; cursor:pointer; }
.rep-seg button.on { background:#fff; color:${C.dark}; box-shadow:0 1px 4px rgba(13,59,46,.14); }
.rep-muted { color:${C.muted}; font-size:12.5px; }
.rep-err { background:#fdecec; color:${RED}; border-radius:10px; padding:10px 12px; margin-bottom:12px; font-size:13.5px; }
.rep-kpis { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; margin-bottom:14px; }
.rep-kpi { background:#fff; border:1px solid ${C.line}; border-radius:14px; padding:12px 14px; display:flex; flex-direction:column; gap:3px; min-height:84px; }
.rep-kpi span { font-size:12px; font-weight:700; color:${C.muted}; }
.rep-kpi b { font-size:22px; color:${C.dark}; font-variant-numeric:tabular-nums; }
.rep-kpi.big { background:${C.dark}; border-color:${C.dark}; }
.rep-kpi.big span, .rep-kpi.big small { color:rgba(255,255,255,.75); }
.rep-kpi.big b { color:#fff; font-size:26px; }
.rep-kpi small { font-size:11.5px; color:${C.muted}; }
.rep-skel { display:block; height:24px; width:70%; border-radius:6px; background:linear-gradient(90deg,#f1f4f2 25%,#e7ece9 50%,#f1f4f2 75%); background-size:200% 100%; animation:repShim 1.1s infinite; }
@keyframes repShim { to { background-position:-200% 0; } }
.rep-cols { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:14px; }
.rep-card { background:#fff; border:1px solid ${C.line}; border-radius:16px; padding:14px 16px; margin-bottom:14px; min-width:0; }
.rep-card h3 { margin:0 0 10px; font-size:14.5px; color:${C.dark}; }
.rep-hbar { display:grid; grid-template-columns:52px 1fr 130px; gap:10px; align-items:center; padding:6px 0; }
.rep-hl { font-weight:800; font-size:13px; color:${C.ink}; }
.rep-track { height:12px; background:${C.bg}; border-radius:4px; overflow:hidden; }
.rep-track i { display:block; height:100%; background:${C.green}; border-radius:0 4px 4px 0; transition:width .4s ease; }
.rep-hv { text-align:right; font-variant-numeric:tabular-nums; }
.rep-hv b { display:block; font-size:14px; color:${C.ink}; }
.rep-hv small { font-size:11.5px; color:${C.muted}; }
.rep-types { display:flex; gap:16px; flex-wrap:wrap; margin-top:10px; padding-top:10px; border-top:1px dashed ${C.line}; font-size:13px; color:${C.muted}; }
.rep-types b { color:${C.ink}; }
.rep-vbars { display:flex; align-items:flex-end; gap:2px; height:150px; padding-top:6px; overflow-x:auto; }
.rep-vbars.days { margin-bottom:12px; }
.rep-vcol { flex:1 0 22px; display:flex; flex-direction:column; align-items:center; gap:4px; height:100%; cursor:default; }
.rep-vbar { flex:1; width:100%; max-width:30px; display:flex; align-items:flex-end; }
.rep-vbar i { display:block; width:100%; min-height:2px; background:${C.green}; border-radius:4px 4px 0 0; transition:height .4s ease; }
.rep-vcol:hover .rep-vbar i { background:${C.greenDeep}; }
.rep-vcol small { font-size:10.5px; color:${C.muted}; white-space:nowrap; }
.rep-tablewrap { overflow-x:auto; }
.rep-table { width:100%; border-collapse:collapse; font-size:13px; }
.rep-table th { text-align:left; font-size:11.5px; text-transform:uppercase; letter-spacing:.4px; color:${C.muted}; padding:6px 8px; border-bottom:1px solid ${C.line}; white-space:nowrap; }
.rep-table td { padding:7px 8px; border-bottom:1px solid ${C.line}; color:${C.ink}; vertical-align:top; }
.rep-table .n { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
.rep-table td small { display:block; color:${C.muted}; font-size:11px; }
.rep-table tr:last-child td { border-bottom:none; }
`;
