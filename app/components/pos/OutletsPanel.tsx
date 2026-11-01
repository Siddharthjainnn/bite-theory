'use client';

/**
 * Admin → Outlets & Rates.
 *   Details   — what prints at the top of the bill (address, GSTIN, FSSAI),
 *               the bill-number code, when the business day starts, what the
 *               Print button does.
 *   Rate list — each outlet's own price for every dish. Blank = website price.
 *               Switch a dish off to hide it from this counter only.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { C } from '../../lib/bite';
import type { OutletPriceRow, PosApi } from '../../lib/pos';
import type { PosOutlet } from '../../lib/posPrint';

const rs = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const hourLabel = (h: number) => (h === 0 ? '12 midnight' : h === 12 ? '12 noon' : h < 12 ? `${h} am` : `${h - 12} pm`);

const BLANK: Partial<PosOutlet> = {
  name: '', code: '', address: '', phone: '', gstin: '', fssai: '', billFooter: '',
  dayStartsAt: 4, printMode: 'both', kotCopies: 1, isActive: true, sortOrder: 0,
  pickupEnabled: false, pickupOpensOn: '', cooksDelivery: false, latitude: null, longitude: null, mapsUrl: '', pickupNote: '',
};

export default function OutletsPanel({ api, showToast }: { api: PosApi; showToast: (m: string) => void }) {
  const [list, setList] = useState<PosOutlet[] | null>(null);
  const [sel, setSel] = useState<number | 'new' | null>(null);
  const [tab, setTab] = useState<'details' | 'rates'>('rates');

  const load = useCallback(async () => {
    try {
      const l = await api.allOutlets();
      setList(l);
      setSel((s) => (s === null && l.length ? l[0].id : s));
    } catch (e) { showToast(e instanceof Error ? e.message : 'Could not load outlets'); }
  }, [api, showToast]);
  useEffect(() => {
    let live = true;
    api.allOutlets().then((l) => { if (live) { setList(l); setSel(l.length ? l[0].id : 'new'); if (!l.length) setTab('details'); } })
      .catch((e: Error) => live && showToast(e.message));
    return () => { live = false; };
  }, [api, showToast]);

  const current = typeof sel === 'number' ? list?.find((o) => o.id === sel) || null : null;

  return (
    <div className="olt">
      <style>{CSS}</style>
      <div className="olt-head">
        <div>
          <h1>Outlets &amp; Rates</h1>
          <p>Each counter has its own bill details, bill-number series and rate list.</p>
        </div>
        <button className="olt-btn" onClick={() => { setSel('new'); setTab('details'); }}>＋ Add outlet</button>
      </div>

      <div className="olt-tabs">
        {(list || []).map((o) => (
          <button key={o.id} className={`olt-out ${sel === o.id ? 'on' : ''}`} onClick={() => setSel(o.id)}>
            <b>{o.name}</b>
            <small>{o.code}{o.isActive ? '' : ' · off'}{o.pickupEnabled ? ' · takeaway' : ''}{o.cooksDelivery ? ' · delivery kitchen' : ''}</small>
          </button>
        ))}
        {sel === 'new' && <button className="olt-out on"><b>New outlet</b><small>—</small></button>}
      </div>

      {sel === 'new' && (
        <OutletForm key="new" api={api} outlet={null} showToast={showToast}
          onSaved={(o) => { void load(); setSel(o.id); setTab('rates'); }} />
      )}
      {current && (
        <>
          <div className="olt-seg">
            <button className={tab === 'rates' ? 'on' : ''} onClick={() => setTab('rates')}>Rate list</button>
            <button className={tab === 'details' ? 'on' : ''} onClick={() => setTab('details')}>Bill details &amp; printing</button>
          </div>
          {tab === 'details'
            ? <OutletForm key={current.id} api={api} outlet={current} showToast={showToast} onSaved={() => load()} />
            : <RateList key={current.id} api={api} outlet={current} others={(list || []).filter((o) => o.id !== current.id)} showToast={showToast} />}
        </>
      )}
      {list && !list.length && sel !== 'new' && <p style={{ color: C.muted }}>No outlets yet.</p>}
    </div>
  );
}

function OutletForm({ api, outlet, showToast, onSaved }: {
  api: PosApi; outlet: PosOutlet | null; showToast: (m: string) => void; onSaved: (o: PosOutlet) => void;
}) {
  const [f, setF] = useState<Partial<PosOutlet>>(() => ({ ...BLANK, ...(outlet || {}) }));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof PosOutlet>(k: K, v: PosOutlet[K]) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    if (!f.name?.trim()) { showToast('Give the outlet a name'); return; }
    if (!/^[A-Za-z0-9]{2,3}$/.test(f.code || '')) { showToast('Code must be 2–3 letters/digits, e.g. BKW'); return; }
    setBusy(true);
    try {
      const body: Partial<PosOutlet> = {
        name: f.name.trim(), code: (f.code || '').toUpperCase(),
        address: f.address || '', phone: f.phone || '', gstin: (f.gstin || '').toUpperCase(), fssai: f.fssai || '',
        billFooter: f.billFooter || '', dayStartsAt: Number(f.dayStartsAt), printMode: f.printMode,
        kotCopies: Number(f.kotCopies), isActive: !!f.isActive, sortOrder: Number(f.sortOrder) || 0,
        pickupEnabled: !!f.pickupEnabled, pickupOpensOn: f.pickupOpensOn || '', cooksDelivery: !!f.cooksDelivery,
        latitude: f.latitude === null || f.latitude === undefined || String(f.latitude) === '' ? null : Number(f.latitude),
        longitude: f.longitude === null || f.longitude === undefined || String(f.longitude) === '' ? null : Number(f.longitude),
        mapsUrl: f.mapsUrl || '', pickupNote: f.pickupNote || '',
      };
      if ((body.latitude == null) !== (body.longitude == null)) { showToast('Fill both latitude and longitude, or neither'); setBusy(false); return; }
      const o = await api.saveOutlet(outlet?.id ?? null, body);
      showToast(outlet ? 'Outlet saved' : `${o.name} added`);
      onSaved(o);
    } catch (e) { showToast(e instanceof Error ? e.message : 'Could not save'); }
    finally { setBusy(false); }
  };

  return (
    <div className="olt-card">
      <div className="olt-form">
        <L label="Outlet name *"><input value={f.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="Bhawarkua" maxLength={80} /></L>
        <L label="Code * (starts every bill number)" hint={`Bills look like ${(f.code || 'BKW').toUpperCase()}/26-27/000001. Fixed once the first bill is made.`}>
          <input value={f.code || ''} onChange={(e) => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3))} placeholder="BKW" />
        </L>
        <L label="Address on the bill" wide><input value={f.address || ''} onChange={(e) => set('address', e.target.value)} placeholder="Shop no., Bhawarkua Square, Indore 452001" maxLength={300} /></L>
        <L label="Phone"><input value={f.phone || ''} onChange={(e) => set('phone', e.target.value)} placeholder="+91 …" maxLength={20} /></L>
        <L label="GSTIN" hint="15 characters. Shown on the bill when filled."><input value={f.gstin || ''} onChange={(e) => set('gstin', e.target.value.toUpperCase().slice(0, 15))} placeholder="23ABCDE1234F1Z5" /></L>
        <L label="FSSAI licence no."><input value={f.fssai || ''} onChange={(e) => set('fssai', e.target.value)} maxLength={20} /></L>
        <L label="Bill footer" wide><input value={f.billFooter || ''} onChange={(e) => set('billFooter', e.target.value)} placeholder="Thank you! Order online at bitestheory.com" maxLength={300} /></L>
        <L label="Business day starts at" hint="Tokens restart from 001 and the daily report rolls over at this time.">
          <select value={f.dayStartsAt ?? 4} onChange={(e) => set('dayStartsAt', Number(e.target.value))}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
        </L>
        <L label="The big Print button prints">
          <select value={f.printMode || 'both'} onChange={(e) => set('printMode', e.target.value as PosOutlet['printMode'])}>
            <option value="both">Bill + KOT (one click)</option>
            <option value="bill">Bill only</option>
            <option value="kot">KOT only</option>
          </select>
        </L>
        <L label="KOT copies">
          <select value={f.kotCopies ?? 1} onChange={(e) => set('kotCopies', Number(e.target.value))}>
            {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </L>
        <L label="Order in lists"><input type="number" value={f.sortOrder ?? 0} onChange={(e) => set('sortOrder', Number(e.target.value))} /></L>
        <label className="olt-check">
          <input type="checkbox" checked={!!f.isActive} onChange={(e) => set('isActive', e.target.checked)} />
          <span>Billing is on at this outlet</span>
        </label>
      </div>

      <h3 className="olt-sub">Online takeaway</h3>
      <div className="olt-form">
        <label className="olt-check wide">
          <input type="checkbox" checked={!!f.pickupEnabled} onChange={(e) => set('pickupEnabled', e.target.checked)} />
          <span>Customers can order online and collect here</span>
        </label>
        <L label="Takeaway starts on" hint="Before this date the outlet shows as “Opening …” at checkout. Leave empty to take orders now.">
          <input type="date" value={f.pickupOpensOn || ''} onChange={(e) => set('pickupOpensOn', e.target.value)} />
        </L>
        <L label="Note for customers" hint="Shown at checkout and on their order page.">
          <input value={f.pickupNote || ''} onChange={(e) => set('pickupNote', e.target.value)} placeholder="Collect at the counter. Show your order code." maxLength={200} />
        </L>
        <L label="Google Maps link" hint="Share → Copy link in Google Maps. Used for “Directions”." wide>
          <input value={f.mapsUrl || ''} onChange={(e) => set('mapsUrl', e.target.value.trim())} placeholder="https://maps.app.goo.gl/…" maxLength={500} />
        </L>
        <L label="Latitude (optional)"><input inputMode="decimal" value={f.latitude ?? ''} onChange={(e) => set('latitude', (e.target.value === '' ? null : e.target.value) as never)} placeholder="22.6926" /></L>
        <L label="Longitude (optional)"><input inputMode="decimal" value={f.longitude ?? ''} onChange={(e) => set('longitude', (e.target.value === '' ? null : e.target.value) as never)} placeholder="75.8673" /></L>
        <label className="olt-check wide">
          <input type="checkbox" checked={!!f.cooksDelivery} onChange={(e) => set('cooksDelivery', e.target.checked)} />
          <span>Delivery orders are cooked here <small style={{ color: C.muted, fontWeight: 500 }}>(this kitchen&apos;s Live Orders screen shows deliveries too)</small></span>
        </label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <button className="olt-btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : outlet ? 'Save changes' : 'Add outlet'}</button>
      </div>
    </div>
  );
}

function L({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`olt-field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

type Draft = { price: string; isAvailable: boolean };

function RateList({ api, outlet, others, showToast }: {
  api: PosApi; outlet: PosOutlet; others: PosOutlet[]; showToast: (m: string) => void;
}) {
  const [rows, setRows] = useState<OutletPriceRow[] | null>(null);
  const [draft, setDraft] = useState<Record<number, Draft>>({});
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [pct, setPct] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api.prices(outlet.id).then((r) => live && setRows(r)).catch((e: Error) => live && showToast(e.message));
    return () => { live = false; };
  }, [api, outlet.id, showToast]);

  const cats = useMemo(() => [...new Set((rows || []).map((r) => r.categoryName || 'Other'))], [rows]);
  const val = (r: OutletPriceRow): Draft => draft[r.productId] || {
    price: r.outletPrice ? String(r.outletPrice) : '', isAvailable: r.isAvailable,
  };
  const differs = (r: OutletPriceRow) => { const v = val(r); return !!v.price || !v.isAvailable; };
  const shown = useMemo(() => (rows || []).filter((r) => {
    if (cat !== 'all' && (r.categoryName || 'Other') !== cat) return false;
    if (q.trim() && !r.name.toLowerCase().includes(q.trim().toLowerCase())) return false;
    if (onlyChanged && !differs(r)) return false;
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rows, cat, q, onlyChanged, draft]);

  const dirty = Object.keys(draft).length;
  const edit = (r: OutletPriceRow, patch: Partial<Draft>) => setDraft((d) => {
    const next = { ...val(r), ...patch };
    const orig = { price: r.outletPrice ? String(r.outletPrice) : '', isAvailable: r.isAvailable };
    const n = { ...d };
    if (Number(next.price || 0) === Number(orig.price || 0) && next.isAvailable === orig.isAvailable) delete n[r.productId];
    else n[r.productId] = next;
    return n;
  });

  const applyPct = () => {
    const p = Number(pct);
    if (!p) { showToast('Enter a % like 10 or -5'); return; }
    shown.forEach((r) => {
      const price = Math.round(r.sitePrice * (1 + p / 100));
      edit(r, { price: price > 0 && price !== Math.round(r.sitePrice) ? String(price) : '' });
    });
    showToast(`${shown.length} dishes set to website price ${p > 0 ? '+' : ''}${p}% — check and Save`);
  };

  const save = async () => {
    if (!rows) return;
    const bad = Object.entries(draft).find(([, d]) => d.price && !(Number(d.price) > 0));
    if (bad) { showToast('Prices must be more than ₹0 (leave blank for the website price)'); return; }
    setBusy(true);
    try {
      const prices = Object.entries(draft).map(([id, d]) => ({
        productId: Number(id), price: d.price ? Number(d.price) : null, isAvailable: d.isAvailable,
      }));
      await api.savePrices(outlet.id, prices);
      setRows(await api.prices(outlet.id)); setDraft({});
      showToast(`Rate list saved for ${outlet.name}`);
    } catch (e) { showToast(e instanceof Error ? e.message : 'Could not save'); }
    finally { setBusy(false); }
  };

  const copy = async (fromId: number) => {
    const from = others.find((o) => o.id === fromId);
    if (!from || !confirm(`Replace ${outlet.name}'s rate list with ${from.name}'s?`)) return;
    setBusy(true);
    try { setRows(await api.copyPrices(outlet.id, fromId)); setDraft({}); showToast(`Copied rates from ${from.name}`); }
    catch (e) { showToast(e instanceof Error ? e.message : 'Could not copy'); }
    finally { setBusy(false); }
  };

  const changedCount = (rows || []).filter(differs).length;

  return (
    <div className="olt-card">
      <div className="olt-tools">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dish…" style={{ flex: '1 1 180px' }} />
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="all">All categories</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="olt-check sm"><input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} /><span>Only different from website ({changedCount})</span></label>
      </div>
      <div className="olt-tools">
        <span className="olt-muted">Shown dishes:</span>
        <input value={pct} onChange={(e) => setPct(e.target.value.replace(/[^\d.-]/g, ''))} placeholder="+10" style={{ width: 70 }} aria-label="Percent" />
        <button className="olt-ghost" onClick={applyPct}>% vs website price</button>
        {others.length > 0 && (
          <select defaultValue="" onChange={(e) => { if (e.target.value) void copy(Number(e.target.value)); e.target.value = ''; }}>
            <option value="">Copy rates from…</option>
            {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
      </div>

      <div className="olt-table">
        <div className="olt-tr olt-th">
          <span>Dish</span><span>Website</span><span>{outlet.name} price</span><span>On sale here</span>
        </div>
        {!rows && <div className="olt-muted" style={{ padding: 20 }}>Loading…</div>}
        {shown.map((r) => {
          const v = val(r);
          const p = Number(v.price);
          const diff = v.price && p > 0 ? p - r.sitePrice : 0;
          return (
            <div key={r.productId} className={`olt-tr ${draft[r.productId] ? 'dirty' : ''} ${!v.isAvailable ? 'off' : ''}`}>
              <span className="olt-dish">
                <b>{r.name}</b>
                <small>{r.categoryName || 'Other'}{r.status !== 'active' ? ' · hidden on website' : ''}</small>
              </span>
              <span className="olt-num">{rs(r.sitePrice)}</span>
              <span className="olt-price">
                <span className="olt-rupee">₹</span>
                <input inputMode="decimal" value={v.price} placeholder={String(r.sitePrice)} aria-label={`${r.name} price`}
                  onChange={(e) => edit(r, { price: e.target.value.replace(/[^\d.]/g, '') })} />
                {diff !== 0 && <small className={diff > 0 ? 'up' : 'down'}>{diff > 0 ? '+' : '−'}{rs(Math.abs(diff))}</small>}
              </span>
              <span>
                <button role="switch" aria-checked={v.isAvailable} aria-label={`${r.name} on sale`} className={`olt-sw ${v.isAvailable ? 'on' : ''}`}
                  onClick={() => edit(r, { isAvailable: !v.isAvailable })}><i /></button>
              </span>
            </div>
          );
        })}
        {rows && !shown.length && <div className="olt-muted" style={{ padding: 20, textAlign: 'center' }}>Nothing matches.</div>}
      </div>

      <div className={`olt-savebar ${dirty ? 'show' : ''}`}>
        <span><b>{dirty}</b> change{dirty === 1 ? '' : 's'} for {outlet.name}</span>
        <button className="olt-ghost" onClick={() => setDraft({})} disabled={busy}>Discard</button>
        <button className="olt-btn" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save rate list'}</button>
      </div>
    </div>
  );
}

const CSS = `
.olt * { box-sizing:border-box; }
.olt input, .olt select { font:inherit; font-size:14px; padding:9px 11px; border-radius:10px; border:1px solid ${C.line}; background:#fff; color:${C.ink}; outline:none; min-width:0; }
.olt input:focus, .olt select:focus { border-color:${C.green}; box-shadow:0 0 0 3px ${C.greenSoft}; }
.olt-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
.olt-head h1 { margin:0; font-size:22px; color:${C.dark}; }
.olt-head p { margin:4px 0 0; color:${C.muted}; font-size:13.5px; }
.olt-btn { font:inherit; font-weight:800; font-size:14px; padding:10px 16px; border-radius:11px; border:none; background:${C.green}; color:#fff; cursor:pointer; }
.olt-btn:hover:not(:disabled) { background:${C.greenDeep}; }
.olt-btn:disabled { opacity:.55; cursor:not-allowed; }
.olt-ghost { font:inherit; font-weight:700; font-size:13px; padding:8px 12px; border-radius:10px; border:1px solid ${C.line}; background:#fff; color:${C.dark}; cursor:pointer; }
.olt-ghost:hover { border-color:${C.green}; }
.olt-tabs { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
.olt-out { font:inherit; text-align:left; padding:10px 14px; border-radius:12px; border:1.5px solid ${C.line}; background:#fff; cursor:pointer; min-width:140px; transition:border-color .12s, background .12s; }
.olt-out b { display:block; color:${C.dark}; }
.olt-out small { color:${C.muted}; font-size:12px; }
.olt-out.on { border-color:${C.green}; background:${C.greenSoft}; }
.olt-seg { display:inline-flex; background:${C.bg}; border-radius:12px; padding:3px; gap:3px; margin-bottom:12px; }
.olt-seg button { font:inherit; font-weight:800; font-size:13.5px; padding:8px 14px; border:none; border-radius:9px; background:transparent; color:${C.muted}; cursor:pointer; }
.olt-seg button.on { background:#fff; color:${C.dark}; box-shadow:0 1px 4px rgba(13,59,46,.14); }
.olt-card { background:#fff; border:1px solid ${C.line}; border-radius:16px; padding:16px; position:relative; }
.olt-form { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:12px 16px; }
.olt-field { display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:700; color:${C.dark}; }
.olt-field.wide { grid-column:1/-1; }
.olt-field small { font-weight:500; color:${C.muted}; font-size:11.5px; }
.olt-sub { margin:18px 0 10px; font-size:14px; color:${C.dark}; padding-top:14px; border-top:1px dashed ${C.line}; }
.olt-check.wide { grid-column:1/-1; }
.olt-check { display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:700; color:${C.dark}; cursor:pointer; }
.olt-check.sm { font-size:12.5px; font-weight:600; color:${C.muted}; }
.olt-check input { width:16px; height:16px; accent-color:${C.green}; }
.olt-tools { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:10px; }
.olt-muted { color:${C.muted}; font-size:13px; }
.olt-table { border:1px solid ${C.line}; border-radius:12px; overflow:hidden; }
.olt-tr { display:grid; grid-template-columns:minmax(0,1fr) 84px 170px 90px; gap:10px; align-items:center; padding:8px 12px; border-top:1px solid ${C.line}; transition:background .12s; }
.olt-tr:first-child { border-top:none; }
.olt-th { background:${C.bg}; font-size:12px; font-weight:800; color:${C.muted}; text-transform:uppercase; letter-spacing:.4px; }
.olt-tr.dirty { background:${C.orangeSoft}; }
.olt-tr.off .olt-dish b { color:${C.muted}; text-decoration:line-through; }
.olt-dish { min-width:0; }
.olt-dish b { display:block; font-size:13.5px; color:${C.ink}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.olt-dish small { color:${C.muted}; font-size:11.5px; }
.olt-num { font-variant-numeric:tabular-nums; color:${C.muted}; font-size:13.5px; }
.olt-price { display:flex; align-items:center; gap:4px; }
.olt-price input { width:84px; padding:7px 8px; font-weight:800; font-variant-numeric:tabular-nums; }
.olt-price input::placeholder { font-weight:500; color:#a9b6af; }
.olt-rupee { color:${C.muted}; font-weight:700; }
.olt-price small { font-size:11.5px; font-weight:800; }
.olt-price small.up { color:${C.orangeDeep}; } .olt-price small.down { color:${C.greenDeep}; }
.olt-sw { width:42px; height:24px; border-radius:999px; border:none; background:#cfd8d3; position:relative; cursor:pointer; transition:background .15s; }
.olt-sw i { position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.25); transition:transform .15s; }
.olt-sw.on { background:${C.green}; } .olt-sw.on i { transform:translateX(18px); }
.olt-savebar { position:sticky; bottom:10px; margin-top:12px; display:flex; gap:10px; align-items:center; justify-content:flex-end; padding:10px 12px; border-radius:13px; background:${C.dark}; color:#fff; opacity:0; transform:translateY(8px); pointer-events:none; transition:opacity .18s, transform .18s; }
.olt-savebar.show { opacity:1; transform:none; pointer-events:auto; }
.olt-savebar span { margin-right:auto; font-size:13.5px; }
.olt-savebar .olt-ghost { background:transparent; color:#fff; border-color:rgba(255,255,255,.35); }
@media (max-width:640px) {
  .olt-tr { grid-template-columns:minmax(0,1fr) 150px 54px; }
  .olt-tr > :nth-child(2) { display:none; }
}
`;
