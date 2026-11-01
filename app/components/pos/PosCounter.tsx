'use client';

/**
 * Admin → Counter / POS. The walk-in till.
 *
 * Tap dishes → pick Cash / UPI / Card → one click saves the bill and prints
 * the kitchen ticket + customer bill, both headed by a 3-digit token.
 * Customer name / phone are optional. Every bill is saved before anything
 * prints, at this outlet's own rates, with its own bill-number series.
 *
 * Keys: "/" search · Enter adds the first match · F9 or Ctrl+Enter prints.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { C, fetchStoreSettings, type InvoiceConfig } from '../../lib/bite';
import {
  newClientRef, previewTotals, type PosApi, type PosDayStats, type PosMenu, type PosMenuItem,
} from '../../lib/pos';
import { printPosBill, type PosBill, type PosOutlet, type PrintWhat } from '../../lib/posPrint';

const RED = '#d64545';
const OUTLET_KEY = 'bt_pos_outlet';
const rs = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const PAY = [
  { key: 'cash', label: 'Cash' },
  { key: 'upi', label: 'UPI' },
  { key: 'card', label: 'Card' },
] as const;
const PRINT_LABEL: Record<PrintWhat, string> = { both: 'Bill + KOT', bill: 'Bill', kot: 'KOT' };

function readOutlet(): number | null {
  try { const v = Number(localStorage.getItem(OUTLET_KEY)); return v > 0 ? v : null; } catch { return null; }
}
function saveOutlet(id: number) {
  try { localStorage.setItem(OUTLET_KEY, String(id)); } catch { /* private mode */ }
}
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
const dayLabel = (ymd: string) => new Date(ymd + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

type Line = { item: PosMenuItem; qty: number };

export default function PosCounter({ api, showToast }: { api: PosApi; showToast: (m: string) => void }) {
  const [outlets, setOutlets] = useState<PosOutlet[] | null>(null);
  const [outletId, setOutletId] = useState<number | null>(null);
  const [menu, setMenu] = useState<PosMenu | null>(null);
  const [stats, setStats] = useState<PosDayStats | null>(null);
  const [cfg, setCfg] = useState<Partial<InvoiceConfig> | null>(null);
  const [loadErr, setLoadErr] = useState('');

  const [q, setQ] = useState('');
  const [cat, setCat] = useState<number | 'all'>('all');
  const [cart, setCart] = useState<Line[]>([]);
  const [pay, setPay] = useState<'cash' | 'upi' | 'card'>('cash');
  const [type, setType] = useState<'takeaway' | 'dine_in'>('takeaway');
  const [showCust, setShowCust] = useState(false);
  const [custName, setCustName] = useState('');
  const [custMobile, setCustMobile] = useState('');
  const [note, setNote] = useState('');
  const [showDisc, setShowDisc] = useState(false);
  const [discType, setDiscType] = useState<'flat' | 'percent'>('percent');
  const [discValue, setDiscValue] = useState('');
  const [discReason, setDiscReason] = useState('');
  const [received, setReceived] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<PosBill | null>(null);
  const [showBills, setShowBills] = useState(false);

  const ref = useRef<string>('');
  const searchRef = useRef<HTMLInputElement>(null);

  /* ── load outlets, remember this till's outlet ── */
  useEffect(() => {
    let live = true;
    api.outlets().then((list) => {
      if (!live) return;
      setOutlets(list);
      const saved = readOutlet();
      const pick = list.find((o) => o.id === saved) || (list.length === 1 ? list[0] : null);
      if (pick) setOutletId(pick.id);
    }).catch((e: Error) => live && setLoadErr(e.message));
    fetchStoreSettings().then((s: { invoiceConfig?: Partial<InvoiceConfig> }) => live && setCfg(s?.invoiceConfig || {})).catch(() => live && setCfg({}));
    return () => { live = false; };
  }, [api]);

  const loadMenu = useCallback(async (id: number) => {
    try {
      const m = await api.menu(id);
      setMenu(m); setStats(m.today); setLoadErr('');
    } catch (e) { setLoadErr(e instanceof Error ? e.message : 'Could not load the menu'); }
  }, [api]);

  useEffect(() => {
    if (!outletId) return;
    saveOutlet(outletId);
    let live = true;
    api.menu(outletId)
      .then((m) => { if (live) { setMenu(m); setStats(m.today); setLoadErr(''); } })
      .catch((e: Error) => live && setLoadErr(e.message));
    return () => { live = false; };
  }, [outletId, api]);

  /* a fresh idempotency key whenever the bill being built changes */
  useEffect(() => { ref.current = newClientRef(); }, [cart, pay, type, custName, custMobile, note, discType, discValue]);

  const shown = useMemo(() => {
    let list = menu?.items || [];
    if (cat !== 'all') list = list.filter((i) => i.categoryId === cat);
    const t = q.trim().toLowerCase();
    if (t) list = list.filter((i) => i.name.toLowerCase().includes(t));
    return list;
  }, [menu, q, cat]);

  const qtyOf = useMemo(() => new Map(cart.map((l) => [l.item.id, l.qty])), [cart]);
  const subtotal = cart.reduce((s, l) => s + l.item.price * l.qty, 0);
  const count = cart.reduce((s, l) => s + l.qty, 0);
  const disc = showDisc && Number(discValue) > 0 ? { type: discType, value: Number(discValue) } : null;
  const t = previewTotals(subtotal, menu?.tax, disc);
  const change = pay === 'cash' && Number(received) > 0 ? Number(received) - t.total : null;
  const outlet = menu?.outlet || outlets?.find((o) => o.id === outletId) || null;
  const mode: PrintWhat = outlet?.printMode || 'both';

  const add = (item: PosMenuItem) => {
    setLast(null);
    setCart((c) => {
      const i = c.findIndex((l) => l.item.id === item.id);
      if (i < 0) return [...c, { item, qty: 1 }];
      const n = [...c]; n[i] = { ...n[i], qty: Math.min(999, n[i].qty + 1) }; return n;
    });
  };
  const setQty = (id: number, qty: number) =>
    setCart((c) => (qty <= 0 ? c.filter((l) => l.item.id !== id) : c.map((l) => (l.item.id === id ? { ...l, qty: Math.min(999, qty) } : l))));

  const reset = () => {
    setCart([]); setCustName(''); setCustMobile(''); setNote(''); setShowCust(false);
    setShowDisc(false); setDiscValue(''); setDiscReason(''); setReceived(''); setType('takeaway'); setPay('cash');
  };

  const print = useCallback(async (b: PosBill, what: PrintWhat) => {
    printPosBill(b, cfg, what, b.printCount > 0);
    try { const u = await api.markPrinted(b.id); setLast((l) => (l && l.id === u.id ? u : l)); } catch { /* the paper is out; count is cosmetic */ }
  }, [api, cfg]);

  const checkout = useCallback(async (what: PrintWhat | 'none') => {
    if (!outletId || !cart.length || busy) return;
    const mobile = custMobile.replace(/\D/g, '');
    if (mobile && mobile.length < 10) { showToast('Mobile needs 10 digits — or leave it blank'); return; }
    setBusy(true);
    try {
      const b = await api.createBill({
        outletId, clientRef: ref.current,
        items: cart.map((l) => ({ productId: l.item.id, quantity: l.qty })),
        paymentMethod: pay, orderType: type,
        customerName: custName.trim() || undefined,
        customerMobile: mobile || undefined,
        note: note.trim() || undefined,
        discount: disc ? { ...disc, reason: discReason.trim() || undefined } : undefined,
      });
      setLast(b);
      setStats((s) => (s ? { ...s, bills: s.bills + 1, sales: s.sales + b.total, lastToken: b.token } : s));
      reset(); setQ('');
      if (what !== 'none') void print(b, what);
      showToast(`Token ${b.tokenLabel} · ${rs(b.total)} saved`);
      searchRef.current?.focus();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save the bill');
      // a dish was switched off meanwhile → refresh so the grid is right
      if (e instanceof Error && /not on sale/i.test(e.message)) void loadMenu(outletId);
    } finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletId, cart, busy, custMobile, custName, pay, type, note, discType, discValue, discReason, showDisc, api, print, showToast, loadMenu]);

  /* ── keyboard ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'F9' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); void checkout(mode); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [checkout, mode]);

  /* ── first run: no outlet yet ── */
  if (outlets && !outlets.length) {
    return <Empty title="No outlet yet" text="Add your outlet in Admin → Outlets & Rates, then come back here to bill." />;
  }
  if (outlets && !outletId) {
    return (
      <div style={{ maxWidth: 520 }}>
        <h2 style={{ color: C.dark, margin: '4px 0 6px' }}>Which outlet is this counter?</h2>
        <p style={{ color: C.muted, marginTop: 0 }}>This device will remember it. You can change it any time from the top of the till.</p>
        <div style={{ display: 'grid', gap: 10 }}>
          {outlets.map((o) => (
            <button key={o.id} onClick={() => setOutletId(o.id)} className="pos-press"
              style={{ textAlign: 'left', padding: '16px 18px', borderRadius: 14, border: `1.5px solid ${C.line}`, background: '#fff', cursor: 'pointer' }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: C.dark }}>{o.name}</div>
              <div style={{ color: C.muted, fontSize: 13 }}>{o.code} · {o.address || '—'}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pos">
      <style>{POS_CSS}</style>

      {/* ── top bar ── */}
      <div className="pos-top">
        <select aria-label="Outlet" value={outletId ?? ''} className="pos-outlet"
          onChange={(e) => {
            if (cart.length && !confirm('Switch outlet? The bill you are building will be cleared.')) return;
            setCart([]); setLast(null); setMenu(null); setOutletId(Number(e.target.value));
          }}>
          {(outlets || []).map((o) => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
        </select>
        {stats && (
          <div className="pos-stats">
            <span><b>{dayLabel(stats.date)}</b></span>
            <span>{stats.bills} bill{stats.bills === 1 ? '' : 's'}</span>
            <span><b>{rs(stats.sales)}</b></span>
            <span>Last token <b>{stats.lastToken ? String(stats.lastToken).padStart(3, '0') : '—'}</b></span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <button className="pos-ghost" onClick={() => outletId && loadMenu(outletId)} title="Reload menu and rates">↻ Menu</button>
        <button className="pos-ghost" onClick={() => setShowBills(true)}>🧾 Today&apos;s bills</button>
      </div>

      {loadErr && <div className="pos-err">{loadErr}</div>}

      <div className="pos-grid">
        {/* ── left: dishes ── */}
        <section className="pos-card pos-menu">
          <input ref={searchRef} value={q} autoFocus
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && shown[0] && q.trim()) { add(shown[0]); setQ(''); }
              if (e.key === 'Escape') setQ('');
            }}
            placeholder="Search dish…  ( / )" className="pos-search" />
          <div className="pos-chips">
            <button className={`pos-chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>All</button>
            {(menu?.categories || []).map((c) => (
              <button key={c.id} className={`pos-chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>{c.name}</button>
            ))}
          </div>
          <div className="pos-items">
            {!menu && !loadErr && Array.from({ length: 12 }).map((_, i) => <div key={i} className="pos-tile pos-skel" />)}
            {shown.map((it) => {
              const n = qtyOf.get(it.id) || 0;
              return (
                <button key={it.id} onClick={() => add(it)} className={`pos-tile pos-press ${n ? 'in' : ''}`}>
                  <span className={`pos-veg ${it.isVeg === false ? 'non' : ''}`} aria-label={it.isVeg === false ? 'Non-veg' : 'Veg'} />
                  <span className="pos-tname">{it.name}</span>
                  <span className="pos-tprice">{rs(it.price)}</span>
                  {n > 0 && <span className="pos-badge">{n}</span>}
                </button>
              );
            })}
            {menu && !shown.length && <div className="pos-none">No dish matches “{q}”.</div>}
          </div>
        </section>

        {/* ── right: the bill ── */}
        <section className="pos-card pos-bill">
          {last && !cart.length && (
            <div className="pos-done">
              <div className="pos-done-tok">
                <small>TOKEN</small>
                <b>{last.tokenLabel}</b>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: C.dark }}>Saved · {rs(last.total)} · {last.paymentMethod.toUpperCase()}</div>
                <div style={{ fontSize: 12.5, color: C.muted }}>{last.billNo}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="pos-mini" onClick={() => print(last, 'bill')}>Reprint bill</button>
                  <button className="pos-mini" onClick={() => print(last, 'kot')}>Reprint KOT</button>
                </div>
              </div>
            </div>
          )}

          <div className="pos-billhead">
            <b>Current bill</b>
            {count > 0 && <span>{count} item{count > 1 ? 's' : ''} · <button className="pos-link" onClick={() => setCart([])}>clear</button></span>}
          </div>

          {!cart.length && <div className="pos-emptycart">Tap dishes on the left to start a bill.</div>}
          {cart.length > 0 && (
            <div className="pos-lines">
              {cart.map((l) => (
                <div key={l.item.id} className="pos-line">
                  <span className="pos-lname">{l.item.name}<small>{rs(l.item.price)}</small></span>
                  <button className="pos-q" aria-label="Less" onClick={() => setQty(l.item.id, l.qty - 1)}>−</button>
                  <input className="pos-qn" inputMode="numeric" aria-label="Quantity" value={l.qty}
                    onChange={(e) => setQty(l.item.id, Number(e.target.value.replace(/\D/g, '')) || 0)} />
                  <button className="pos-q" aria-label="More" onClick={() => setQty(l.item.id, l.qty + 1)}>+</button>
                  <span className="pos-lamt">{rs(l.item.price * l.qty)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="pos-seg" role="group" aria-label="Order type">
            <button className={type === 'takeaway' ? 'on' : ''} onClick={() => setType('takeaway')}>🛍️ Takeaway</button>
            <button className={type === 'dine_in' ? 'on' : ''} onClick={() => setType('dine_in')}>🍽️ Dine in</button>
          </div>

          <div className="pos-extras">
            <button className="pos-link" onClick={() => setShowCust((v) => !v)}>{showCust ? '−' : '+'} Customer (optional)</button>
            <button className="pos-link" onClick={() => setShowDisc((v) => !v)}>{showDisc ? '−' : '+'} Discount</button>
          </div>
          {showCust && (
            <div className="pos-two">
              <input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Name" maxLength={80} />
              <input value={custMobile} onChange={(e) => setCustMobile(e.target.value)} placeholder="Mobile" inputMode="numeric" maxLength={14} />
            </div>
          )}
          {showDisc && (
            <div className="pos-disc">
              <div className="pos-seg sm">
                <button className={discType === 'percent' ? 'on' : ''} onClick={() => setDiscType('percent')}>%</button>
                <button className={discType === 'flat' ? 'on' : ''} onClick={() => setDiscType('flat')}>₹</button>
              </div>
              <input value={discValue} onChange={(e) => setDiscValue(e.target.value.replace(/[^\d.]/g, ''))} placeholder={discType === 'percent' ? '10' : '50'} inputMode="decimal" style={{ width: 70 }} />
              <input value={discReason} onChange={(e) => setDiscReason(e.target.value)} placeholder="Reason (prints on bill)" maxLength={80} style={{ flex: 1, minWidth: 0 }} />
            </div>
          )}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for kitchen (prints on KOT)" maxLength={300} className="pos-note" />

          <div className="pos-tot">
            <Row label="Item total" value={rs(t.subtotal)} />
            {t.discount > 0 && <Row label="Discount" value={'− ' + rs(t.discount)} />}
            {menu?.tax.gstEnabled && t.gst > 0 && (
              <Row label={`GST ${menu.tax.gstRate}%${menu.tax.gstInclusive ? ' (included)' : ''}`} value={rs(t.gst)} />
            )}
            {t.roundOff !== 0 && <Row label="Round off" value={(t.roundOff > 0 ? '+ ' : '− ') + rs(Math.abs(t.roundOff))} />}
            <div className="pos-grand"><span>Total</span><span>{rs(t.total)}</span></div>
          </div>

          <div className="pos-foot">
          <div className="pos-seg pay" role="group" aria-label="Payment">
            {PAY.map((p) => <button key={p.key} className={pay === p.key ? 'on' : ''} onClick={() => setPay(p.key)}>{p.label}</button>)}
          </div>
          {pay === 'cash' && cart.length > 0 && (
            <div className="pos-cash">
              <input value={received} onChange={(e) => setReceived(e.target.value.replace(/[^\d.]/g, ''))} placeholder="Cash received" inputMode="decimal" />
              {[t.total, Math.ceil(t.total / 100) * 100, Math.ceil(t.total / 500) * 500].filter((v, i, a) => v > 0 && a.indexOf(v) === i).slice(0, 3).map((v) => (
                <button key={v} className="pos-mini" onClick={() => setReceived(String(v))}>{rs(v)}</button>
              ))}
              {change !== null && (
                <span className={`pos-change ${change < 0 ? 'short' : ''}`}>
                  {change < 0 ? `Short ${rs(-change)}` : `Return ${rs(change)}`}
                </span>
              )}
            </div>
          )}

          <button className="pos-go pos-press" disabled={!cart.length || busy || !outletId} onClick={() => checkout(mode)}>
            {busy ? 'Saving…' : `🖨️ Print ${PRINT_LABEL[mode]} · ${rs(t.total)}`}
            <small>F9</small>
          </button>
          <div className="pos-alt">
            {(['both', 'bill', 'kot'] as PrintWhat[]).filter((m) => m !== mode).map((m) => (
              <span key={m} style={{ display: 'contents' }}>
                <button className="pos-link" disabled={!cart.length || busy} onClick={() => checkout(m)}>
                  {m === 'both' ? 'Bill + KOT' : `${PRINT_LABEL[m]} only`}
                </button>
                <span aria-hidden>·</span>
              </span>
            ))}
            <button className="pos-link" disabled={!cart.length || busy} onClick={() => checkout('none')}>Save, don&apos;t print</button>
          </div>
          </div>
        </section>
      </div>

      {cart.length > 0 && (
        <div className="pos-mbar">
          <button className="pos-mbar-info" onClick={() => document.querySelector('.pos-bill')?.scrollIntoView({ behavior: 'smooth' })}>
            <b>{count} item{count > 1 ? 's' : ''} · {rs(t.total)}</b><small>View bill ↓</small>
          </button>
          <button className="pos-mbar-go" disabled={busy} onClick={() => checkout(mode)}>{busy ? 'Saving…' : `Print ${PRINT_LABEL[mode]}`}</button>
        </div>
      )}

      {showBills && outletId && (
        <BillsDrawer api={api} outletId={outletId} onClose={() => setShowBills(false)} showToast={showToast}
          onPrint={print} onChanged={() => outletId && loadMenu(outletId)} />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="pos-row"><span>{label}</span><span>{value}</span></div>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 28, maxWidth: 520 }}>
      <h2 style={{ margin: '0 0 6px', color: C.dark }}>{title}</h2>
      <p style={{ margin: 0, color: C.muted }}>{text}</p>
    </div>
  );
}

/* ═══════════════ today's bills: reprint / cancel ═══════════════ */
function BillsDrawer({ api, outletId, onClose, showToast, onPrint, onChanged }: {
  api: PosApi; outletId: number; onClose: () => void; showToast: (m: string) => void;
  onPrint: (b: PosBill, what: PrintWhat) => Promise<void>; onChanged: () => void;
}) {
  const [date, setDate] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState<{ date: string; bills: PosBill[]; stats: PosDayStats } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [cancelFor, setCancelFor] = useState<PosBill | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.bills(outletId, date || undefined, q.trim() || undefined);
      setData(d);
      if (!date) setDate(d.date);
    } catch (e) { showToast(e instanceof Error ? e.message : 'Could not load bills'); }
  }, [api, outletId, date, q, showToast]);

  useEffect(() => { const h = setTimeout(load, q ? 250 : 0); return () => clearTimeout(h); }, [load, q]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const reprint = async (b: PosBill, what: PrintWhat) => { await onPrint(b, what); void load(); };

  const doCancel = async () => {
    if (!cancelFor) return;
    if (reason.trim().length < 3) { showToast('Write a short reason'); return; }
    setBusy(true);
    try {
      await api.cancelBill(cancelFor.id, reason.trim());
      showToast(`Token ${cancelFor.tokenLabel} cancelled`);
      setCancelFor(null); setReason(''); void load(); onChanged();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Could not cancel'); }
    finally { setBusy(false); }
  };

  return (
    <div className="pos-drawer-bg" onClick={onClose}>
      <style>{POS_CSS}</style>
      <aside className="pos-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Bills">
        <div className="pos-dhead">
          <b>Bills</b>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Business day" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Token, bill no or mobile" style={{ flex: 1, minWidth: 120 }} />
          <button className="pos-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {data && (
          <div className="pos-dstats">{data.stats.bills} paid · <b>{rs(data.stats.sales)}</b></div>
        )}
        <div className="pos-dlist">
          {!data && <div className="pos-none">Loading…</div>}
          {data && !data.bills.length && <div className="pos-none">No bills{q ? ` for “${q}”` : ' yet'}.</div>}
          {data?.bills.map((b) => (
            <div key={b.id} className={`pos-brow ${b.status === 'cancelled' ? 'x' : ''}`}>
              <button className="pos-bmain" onClick={() => setOpen(open === b.id ? null : b.id)}>
                <span className="pos-btok">{b.tokenLabel}</span>
                <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <span style={{ display: 'block', fontWeight: 700, color: C.dark }}>
                    {rs(b.total)} · {b.paymentMethod.toUpperCase()}
                    {b.status === 'cancelled' && <span className="pos-xtag">CANCELLED</span>}
                    {b.printCount > 1 && <span className="pos-rtag">printed {b.printCount}×</span>}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {timeOf(b.createdAt)} · {b.billNo} · {b.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                  </span>
                </span>
              </button>
              {open === b.id && (
                <div className="pos-bmore">
                  {b.items.map((i, k) => (
                    <div key={k} className="pos-row"><span>{i.quantity} × {i.name}</span><span>{rs(i.lineTotal)}</span></div>
                  ))}
                  {b.discount > 0 && <div className="pos-row"><span>Discount{b.discountReason ? ` (${b.discountReason})` : ''}</span><span>− {rs(b.discount)}</span></div>}
                  <div className="pos-row" style={{ color: C.muted, fontSize: 12 }}>
                    <span>{b.orderType === 'dine_in' ? 'Dine in' : 'Takeaway'} · by {b.cashierName || '—'}{b.customerName || b.customerMobile ? ` · ${[b.customerName, b.customerMobile].filter(Boolean).join(' ')}` : ''}</span>
                  </div>
                  {b.status === 'cancelled' && (
                    <div style={{ color: RED, fontSize: 12.5 }}>Cancelled by {b.cancelledBy}: {b.cancelReason}</div>
                  )}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    <button className="pos-mini" onClick={() => reprint(b, 'bill')}>Reprint bill</button>
                    <button className="pos-mini" onClick={() => reprint(b, 'kot')}>Reprint KOT</button>
                    {b.status === 'paid' && <button className="pos-mini danger" onClick={() => { setCancelFor(b); setReason(''); }}>Cancel bill</button>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {cancelFor && (
          <div className="pos-cancel">
            <b>Cancel token {cancelFor.tokenLabel} · {rs(cancelFor.total)}?</b>
            <p>The bill number stays in the series and shows as cancelled on the report. Only managers can do this.</p>
            <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. wrong item, customer left" maxLength={200} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="pos-ghost" onClick={() => setCancelFor(null)}>Keep bill</button>
              <button className="pos-mini danger" disabled={busy} onClick={doCancel}>{busy ? 'Cancelling…' : 'Cancel bill'}</button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

const POS_CSS = `
.pos { --g:${C.green}; --gd:${C.greenDeep}; --dk:${C.dark}; --mu:${C.muted}; --ln:${C.line}; --gs:${C.greenSoft}; --or:${C.orange}; --os:${C.orangeSoft}; }
.pos *, .pos-drawer * { box-sizing:border-box; }
.pos input, .pos-drawer input { font:inherit; padding:10px 12px; border-radius:10px; border:1px solid ${C.line}; background:#fff; color:${C.ink}; outline:none; }
.pos input:focus, .pos-drawer input:focus { border-color:${C.green}; box-shadow:0 0 0 3px ${C.greenSoft}; }
.pos-press { transition:transform .08s ease, box-shadow .12s ease, border-color .12s ease, background .12s ease; }
.pos-press:active { transform:scale(.97); }
.pos-top { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:12px; }
.pos-outlet { font:inherit; font-weight:800; color:${C.dark}; padding:9px 12px; border-radius:11px; border:1.5px solid ${C.green}; background:${C.greenSoft}; }
.pos-stats { display:flex; gap:14px; flex-wrap:wrap; font-size:13.5px; color:${C.muted}; }
.pos-stats b { color:${C.dark}; }
.pos-ghost { font:inherit; font-size:13px; font-weight:700; padding:8px 12px; border-radius:10px; border:1px solid ${C.line}; background:#fff; color:${C.dark}; cursor:pointer; }
.pos-ghost:hover { border-color:${C.green}; }
.pos-err { background:#fdecec; color:${RED}; border-radius:10px; padding:10px 12px; margin-bottom:10px; font-size:13.5px; }
.pos-grid { display:grid; grid-template-columns:minmax(0,1.55fr) minmax(330px,1fr); gap:14px; align-items:start; }
@media (max-width: 900px) { .pos-grid { grid-template-columns:minmax(0,1fr); } .pos-bill { position:static !important; } }
.pos-card { background:#fff; border:1px solid ${C.line}; border-radius:16px; padding:14px; }
.pos-search { width:100%; font-size:15px !important; margin-bottom:10px; }
.pos-chips { display:flex; gap:6px; overflow-x:auto; padding-bottom:8px; scrollbar-width:thin; }
.pos-chip { font:inherit; font-size:13px; font-weight:700; white-space:nowrap; padding:7px 13px; border-radius:999px; border:1px solid ${C.line}; background:#fff; color:${C.dark}; cursor:pointer; }
.pos-chip.on { background:${C.dark}; border-color:${C.dark}; color:#fff; }
.pos-items { display:grid; grid-template-columns:repeat(auto-fill,minmax(148px,1fr)); gap:9px; max-height:calc(100vh - 250px); min-height:200px; overflow-y:auto; padding:4px 2px 2px; }
.pos-tile { position:relative; display:flex; flex-direction:column; align-items:flex-start; gap:6px; text-align:left; min-height:86px; padding:11px 12px; border-radius:13px; border:1.5px solid ${C.line}; background:#fff; cursor:pointer; font:inherit; }
.pos-tile:hover { border-color:${C.green}; box-shadow:0 4px 14px rgba(13,59,46,.08); }
.pos-tile.in { border-color:${C.green}; background:${C.greenSoft}; }
.pos-tname { font-weight:700; font-size:13.5px; line-height:1.25; color:${C.ink}; padding-right:18px; }
.pos-tprice { margin-top:auto; font-weight:900; color:${C.greenDeep}; font-size:15px; }
.pos-badge { position:absolute; top:7px; right:7px; min-width:22px; height:22px; padding:0 6px; border-radius:999px; background:${C.green}; color:#fff; font-size:12px; font-weight:900; display:grid; place-items:center; animation:posPop .18s ease; }
@keyframes posPop { from { transform:scale(.5); } to { transform:scale(1); } }
.pos-veg { width:12px; height:12px; border:1.5px solid #1a8f3c; border-radius:3px; display:grid; place-items:center; }
.pos-veg::after { content:''; width:6px; height:6px; border-radius:50%; background:#1a8f3c; }
.pos-veg.non { border-color:#b3261e; } .pos-veg.non::after { background:#b3261e; }
.pos-skel { min-height:86px; background:linear-gradient(90deg,#f1f4f2 25%,#e7ece9 50%,#f1f4f2 75%); background-size:200% 100%; animation:posShim 1.1s infinite; border:none; }
@keyframes posShim { to { background-position:-200% 0; } }
.pos-none { grid-column:1/-1; text-align:center; color:${C.muted}; padding:26px 0; }
.pos-bill { position:sticky; top:12px; display:flex; flex-direction:column; gap:10px; max-height:calc(100vh - 150px); min-height:420px; overflow-y:auto; padding-bottom:0; }
.pos-foot { position:sticky; bottom:0; background:#fff; display:flex; flex-direction:column; gap:8px; padding:8px 0 14px; margin-top:auto; box-shadow:0 -10px 14px -12px rgba(13,59,46,.25); }
@media (max-width: 900px) { .pos-bill { max-height:none; overflow:visible; } }
.pos-done { display:flex; gap:12px; align-items:center; padding:10px; border-radius:13px; background:${C.greenSoft}; border:1px solid ${C.green}; animation:posIn .22s ease; }
@keyframes posIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }
.pos-done-tok { background:${C.dark}; color:#fff; border-radius:11px; padding:6px 12px; text-align:center; line-height:1; }
.pos-done-tok small { display:block; font-size:10px; letter-spacing:2px; opacity:.8; margin-bottom:3px; }
.pos-done-tok b { font-size:34px; letter-spacing:1px; font-variant-numeric:tabular-nums; }
.pos-billhead { display:flex; justify-content:space-between; align-items:center; color:${C.dark}; font-size:15px; }
.pos-billhead span { font-size:12.5px; color:${C.muted}; }
.pos-emptycart { background:${C.bg}; color:${C.muted}; border-radius:11px; text-align:center; padding:22px 10px; font-size:13.5px; }
.pos-lines { display:grid; gap:7px; }
.pos-line { display:flex; align-items:center; gap:6px; }
.pos-lname { flex:1; min-width:0; font-size:13.5px; font-weight:600; color:${C.ink}; line-height:1.2; }
.pos-lname small { display:block; font-weight:500; color:${C.muted}; font-size:11.5px; }
.pos-q { width:30px; height:30px; border-radius:9px; border:1px solid ${C.line}; background:#fff; font-weight:900; font-size:16px; color:${C.dark}; cursor:pointer; }
.pos-q:hover { border-color:${C.green}; }
.pos .pos-qn { width:40px; text-align:center; padding:5px 2px; font-weight:800; }
.pos-lamt { width:62px; text-align:right; font-weight:800; font-size:13.5px; color:${C.ink}; font-variant-numeric:tabular-nums; }
.pos-seg { display:flex; background:${C.bg}; border-radius:12px; padding:3px; gap:3px; }
.pos-seg button { flex:1; font:inherit; font-size:13.5px; font-weight:800; padding:9px 6px; border:none; border-radius:9px; background:transparent; color:${C.muted}; cursor:pointer; }
.pos-seg button.on { background:#fff; color:${C.dark}; box-shadow:0 1px 4px rgba(13,59,46,.14); }
.pos-seg.pay button { padding:12px 6px; font-size:15px; }
.pos-seg.pay button.on { background:${C.dark}; color:#fff; }
.pos-seg.sm { flex:0 0 auto; } .pos-seg.sm button { padding:6px 12px; }
.pos-extras { display:flex; gap:16px; }
.pos-link { font:inherit; font-size:13px; font-weight:700; color:${C.greenDeep}; background:none; border:none; padding:0; cursor:pointer; }
.pos-link:disabled { color:${C.muted}; cursor:not-allowed; }
.pos-two { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.pos-two input { min-width:0; }
.pos-disc { display:flex; gap:8px; align-items:center; }
.pos-note { width:100%; }
.pos-tot { border-top:1px dashed ${C.line}; padding-top:8px; display:grid; gap:3px; }
.pos-row { display:flex; justify-content:space-between; gap:10px; font-size:13.5px; color:${C.ink}; }
.pos-grand { display:flex; justify-content:space-between; font-weight:900; font-size:24px; color:${C.dark}; margin-top:4px; font-variant-numeric:tabular-nums; }
.pos-cash { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
.pos-cash input { width:130px; }
.pos-change { font-weight:900; color:${C.greenDeep}; font-size:15px; margin-left:auto; }
.pos-change.short { color:${RED}; }
.pos-mini { font:inherit; font-size:12.5px; font-weight:800; padding:7px 10px; border-radius:9px; border:1px solid ${C.line}; background:#fff; color:${C.dark}; cursor:pointer; }
.pos-mini:hover { border-color:${C.green}; }
.pos-mini.danger { color:${RED}; border-color:#f3c9c9; }
.pos-go { position:relative; width:100%; padding:16px 0; border:none; border-radius:14px; background:${C.green}; color:#fff; font:inherit; font-weight:900; font-size:16.5px; cursor:pointer; box-shadow:0 6px 18px rgba(76,175,80,.35); }
.pos-go:hover:not(:disabled) { background:${C.greenDeep}; }
.pos-go:disabled { background:#b9c6bf; box-shadow:none; cursor:not-allowed; }
.pos-go small { position:absolute; right:12px; top:50%; transform:translateY(-50%); font-size:10.5px; opacity:.75; border:1px solid rgba(255,255,255,.6); border-radius:5px; padding:1px 5px; }
.pos-alt { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; color:${C.muted}; font-size:13px; }
.pos-mbar { display:none; }
@media (max-width: 900px) {
  .pos { padding-bottom:84px; }
  .pos-mbar { display:flex; gap:8px; position:fixed; left:10px; right:10px; bottom:10px; z-index:60; background:${C.dark}; border-radius:16px; padding:8px; box-shadow:0 10px 30px rgba(13,59,46,.35); animation:posIn .2s ease; }
  .pos-mbar-info { flex:1; text-align:left; background:none; border:none; color:#fff; font:inherit; padding:2px 8px; cursor:pointer; }
  .pos-mbar-info b { display:block; font-size:15px; } .pos-mbar-info small { opacity:.75; font-size:11.5px; }
  .pos-mbar-go { border:none; border-radius:12px; background:${C.green}; color:#fff; font:inherit; font-weight:900; font-size:14.5px; padding:0 18px; cursor:pointer; }
  .pos-items { max-height:none; }
}
.pos-drawer-bg { position:fixed; inset:0; background:rgba(13,59,46,.35); backdrop-filter:blur(2px); z-index:80; display:flex; justify-content:flex-end; animation:posFade .15s ease; }
@keyframes posFade { from { opacity:0; } }
.pos-drawer { width:min(560px,100%); height:100%; background:#fff; display:flex; flex-direction:column; animation:posSlide .2s ease; position:relative; }
@keyframes posSlide { from { transform:translateX(30px); opacity:.4; } }
.pos-dhead { display:flex; gap:8px; align-items:center; padding:14px; border-bottom:1px solid ${C.line}; flex-wrap:wrap; }
.pos-dhead b { font-size:17px; color:${C.dark}; margin-right:4px; }
.pos-dstats { padding:8px 14px; font-size:13px; color:${C.muted}; border-bottom:1px solid ${C.line}; }
.pos-dlist { flex:1; overflow-y:auto; padding:8px 10px 20px; }
.pos-brow { border:1px solid ${C.line}; border-radius:12px; margin-bottom:7px; overflow:hidden; }
.pos-brow.x { background:#fbf6f6; }
.pos-brow.x .pos-btok { background:#b9a9a9; text-decoration:line-through; }
.pos-bmain { display:flex; gap:10px; align-items:center; width:100%; padding:9px 10px; background:none; border:none; font:inherit; cursor:pointer; }
.pos-btok { background:${C.dark}; color:#fff; border-radius:9px; padding:6px 8px; font-weight:900; font-size:17px; font-variant-numeric:tabular-nums; min-width:52px; text-align:center; }
.pos-xtag { margin-left:6px; font-size:10.5px; color:#fff; background:${RED}; border-radius:5px; padding:1px 5px; vertical-align:middle; }
.pos-rtag { margin-left:6px; font-size:10.5px; color:${C.muted}; border:1px solid ${C.line}; border-radius:5px; padding:0 5px; vertical-align:middle; }
.pos-bmore { padding:4px 12px 12px 72px; display:grid; gap:3px; }
@media (max-width: 520px) { .pos-bmore { padding-left:12px; } }
.pos-cancel { position:absolute; left:12px; right:12px; bottom:12px; background:#fff; border:1px solid ${C.line}; border-radius:14px; padding:14px; box-shadow:0 12px 40px rgba(0,0,0,.18); }
.pos-cancel p { margin:6px 0 10px; color:${C.muted}; font-size:13px; }
.pos-cancel input { width:100%; }
`;
