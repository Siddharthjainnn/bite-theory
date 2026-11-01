'use client';

/**
 * Admin → Home page. Everything the customer home shows that isn't a dish:
 *   1. Launch banner (Bhawarkua): text, opening time, countdown, "Notify me"
 *   2. Opening-day list: who tapped "Notify me", CSV export
 *   3. Prices on other apps: Zomato / Swiggy / Toing per dish, plus a
 *      one-click "my price = X% below Zomato"
 *   4. "You can also order from" tiles: order, links, on/off
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

type PlatformKey = 'zomato' | 'swiggy' | 'toing';
export interface StorefrontConfig {
  launch: {
    enabled: boolean; badge: string; lead: string; area: string; city: string; opensAt: string;
    showCountdown: boolean; buttonText: string; smallPrint: string; openBadge: string; openLead: string;
    mapsUrl: string; autoNotify: boolean;
  };
  priceCompare: boolean;
  platforms: { key: PlatformKey; name: string; url: string; enabled: boolean }[];
  zomatoRating?: { enabled: boolean; value: number; count: number };
}
interface LaunchStats {
  total: number; notified: number; today: number;
  recent: { phone: string; name: string | null; created_at: string }[];
}
interface PanelProduct {
  id: number; categoryId: number; name: string; price: number; offerPrice: number;
  zomatoPrice?: number | null; swiggyPrice?: number | null; toingPrice?: number | null;
}
interface PanelCategory { id: number; name: string; sortOrder: number; featured?: boolean }

export interface StorefrontApi {
  loadStorefront(): Promise<StorefrontConfig>;
  saveStorefront(c: Record<string, unknown>): Promise<StorefrontConfig>;
  launchStats(): Promise<LaunchStats>;
  launchCsv(): Promise<Blob>;
}
type Api = StorefrontApi & {
  listProducts(): Promise<PanelProduct[]>;
  listCategories(): Promise<PanelCategory[]>;
  updateProduct(id: number, d: Partial<PanelProduct>): Promise<unknown>;
};

const K = {
  ink: '#0F1F1A', muted: '#55655F', line: '#E3E9E6', green: '#1F7A3A', deep: '#0D3B2E', soft: '#F6F8F7', red: '#B42318',
};
const card: React.CSSProperties = { background: '#fff', border: `1px solid ${K.line}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 };
const input: React.CSSProperties = { height: 40, border: '1px solid #CFDAD5', borderRadius: 10, padding: '0 12px', fontSize: 14, color: K.ink, background: '#fff', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
const label: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#3A4A44' };
const btn: React.CSSProperties = { height: 40, padding: '0 18px', borderRadius: 10, border: 0, background: K.deep, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' };
const ghost: React.CSSProperties = { ...btn, background: '#fff', color: K.ink, border: '1px solid #CFDAD5' };
const h2: React.CSSProperties = { margin: 0, fontSize: 17, fontWeight: 800, color: K.ink };
const sub: React.CSSProperties = { margin: '3px 0 0', fontSize: 13, color: K.muted, lineHeight: 1.45 };

/** ISO instant → "YYYY-MM-DDTHH:mm" in India time, for <input type="datetime-local"> */
function toIstLocal(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(t).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}

function Switch({ on, onChange, label: aria }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={aria} onClick={() => onChange(!on)}
      style={{ width: 48, height: 28, flex: 'none', borderRadius: 14, border: 0, padding: 3, cursor: 'pointer', display: 'flex',
        justifyContent: on ? 'flex-end' : 'flex-start', background: on ? K.green : '#C9D3CE', transition: 'background .15s' }}
    >
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff' }} />
    </button>
  );
}

const LOOK: Record<PlatformKey, { color: string; italic?: boolean; mark: string; hint: string }> = {
  zomato: { color: '#E23744', italic: true, mark: 'zomato', hint: 'Paste your Zomato restaurant link' },
  swiggy: { color: '#FC8019', mark: 'Swiggy', hint: 'Paste your Swiggy menu link' },
  toing: { color: '#E0246F', mark: 'Toing', hint: 'Paste your Toing menu link' },
};

export default function StorefrontPanel({ api, showToast }: { api: Api; showToast: (m: string) => void }) {
  const [cfg, setCfg] = useState<StorefrontConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<LaunchStats | null>(null);
  const [products, setProducts] = useState<PanelProduct[]>([]);
  const [cats, setCats] = useState<PanelCategory[]>([]);
  const [edits, setEdits] = useState<Record<number, Partial<PanelProduct>>>({});
  const [savingPrices, setSavingPrices] = useState(false);
  const [pct, setPct] = useState('30');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const [c, st, ps, cs] = await Promise.all([
        api.loadStorefront(),
        api.launchStats().catch(() => null),
        api.listProducts(),
        api.listCategories(),
      ]);
      setCfg(c);
      setStats(st);
      setProducts(ps);
      setCats(cs);
      setDirty(false);
      setEdits({});
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Could not load');
    }
  }, [api]);
  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  const setLaunch = (k: keyof StorefrontConfig['launch'], v: unknown) => {
    setCfg((c) => (c ? { ...c, launch: { ...c.launch, [k]: v } } : c));
    setDirty(true);
  };
  const setTile = (i: number, patch: Partial<StorefrontConfig['platforms'][number]>) => {
    setCfg((c) => (c ? { ...c, platforms: c.platforms.map((t, j) => (j === i ? { ...t, ...patch } : t)) } : c));
    setDirty(true);
  };
  const moveTile = (i: number, d: -1 | 1) => {
    setCfg((c) => {
      if (!c) return c;
      const arr = [...c.platforms];
      const j = i + d;
      if (j < 0 || j >= arr.length) return c;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...c, platforms: arr };
    });
    setDirty(true);
  };

  async function save() {
    if (!cfg) return;
    setSaving(true);
    try {
      const next = await api.saveStorefront({
        ...cfg,
        launch: { ...cfg.launch, opensAt: toIstLocal(cfg.launch.opensAt) || cfg.launch.opensAt },
      });
      setCfg(next);
      setDirty(false);
      const dropped = cfg.platforms.filter((t, i) => t.url && !next.platforms[i]?.url);
      showToast(dropped.length ? 'Saved. A link that is not https:// was removed.' : 'Home page saved');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Save failed');
    }
    setSaving(false);
  }

  async function downloadCsv() {
    try {
      const blob = await api.launchCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'opening-day-list.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Download failed');
    }
  }

  /* ── prices ── */
  const val = (p: PanelProduct, k: 'price' | 'zomatoPrice' | 'swiggyPrice' | 'toingPrice') =>
    (edits[p.id] && k in edits[p.id] ? edits[p.id][k] : p[k]) as number | null | undefined;
  const editPrice = (id: number, k: string, raw: string) =>
    setEdits((e) => ({ ...e, [id]: { ...e[id], [k]: raw === '' ? (k === 'price' ? 0 : null) : Number(raw) } }));
  const changed = Object.keys(edits).length;

  const grouped = useMemo(() => {
    const order = [...cats].sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || a.sortOrder - b.sortOrder);
    return order
      .map((c) => ({ c, items: products.filter((p) => p.categoryId === c.id) }))
      .filter((g) => g.items.length);
  }, [cats, products]);

  function applyPct() {
    const n = Number(pct);
    if (!(n > 0 && n < 90)) return showToast('Enter a percentage between 1 and 89');
    const withZ = products.filter((p) => Number(val(p, 'zomatoPrice')) > 0);
    if (!withZ.length) return showToast('No dish has a Zomato price yet');
    if (!window.confirm(`Set YOUR price to ${n}% below the Zomato price for ${withZ.length} dishes? You can still edit any of them before saving.`)) return;
    setEdits((e) => {
      const next = { ...e };
      for (const p of withZ) next[p.id] = { ...next[p.id], price: Math.round(Number(val(p, 'zomatoPrice')) * (1 - n / 100)) };
      return next;
    });
  }

  async function savePrices() {
    setSavingPrices(true);
    let ok = 0;
    const failed: string[] = [];
    for (const [id, patch] of Object.entries(edits)) {
      const p = products.find((x) => x.id === Number(id));
      if (!p) continue;
      const merged = { ...p, ...patch };
      if (!(Number(merged.price) > 0)) {
        failed.push(`${p.name} (your price is required)`);
        continue;
      }
      if (merged.offerPrice && merged.offerPrice >= merged.price) merged.offerPrice = 0; // an old offer can't be above the new price
      try {
        await api.updateProduct(p.id, merged);
        ok++;
      } catch (e: unknown) {
        failed.push(`${p.name} (${e instanceof Error ? e.message : 'failed'})`);
      }
    }
    setSavingPrices(false);
    showToast(failed.length ? `Saved ${ok}. Not saved: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}` : `Saved prices for ${ok} dish${ok === 1 ? '' : 'es'}`);
    load();
  }

  if (err) return <div style={{ ...card, color: K.red }}>{err} <button style={ghost} onClick={load}>Try again</button></div>;
  if (!cfg) return <div style={{ ...card, color: K.muted }}>Loading home page settings…</div>;
  const l = cfg.launch;
  const zomatoTile = cfg.platforms.find((t) => t.key === 'zomato');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1160, fontFamily: 'inherit' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#F3F5F4', padding: '6px 0' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: K.ink }}>Home page</h1>
          <p style={sub}>What customers see above and around the menu. Dishes and their order come from Products and Categories.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/" target="_blank" rel="noopener noreferrer" style={{ ...ghost, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Preview site</a>
          <button style={{ ...btn, opacity: dirty ? 1 : 0.55 }} disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        {/* ── 1. launch banner ── */}
        <section style={{ ...card, flex: '999 1 560px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h2 style={h2}>Launch banner</h2>
              <p style={sub}>The big card at the top of the home page. From the opening time on it switches to the &quot;now open&quot; text by itself.</p>
            </div>
            <Switch on={l.enabled} onChange={(v) => setLaunch('enabled', v)} label="Show launch banner" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, opacity: l.enabled ? 1 : 0.55 }}>
            <label style={label}>Badge<input style={input} value={l.badge} maxLength={30} onChange={(e) => setLaunch('badge', e.target.value)} /></label>
            <label style={label}>Line above the area<input style={input} value={l.lead} maxLength={80} onChange={(e) => setLaunch('lead', e.target.value)} /></label>
            <label style={label}>Area (big text)<input style={input} value={l.area} maxLength={40} onChange={(e) => setLaunch('area', e.target.value)} /></label>
            <label style={label}>City<input style={input} value={l.city} maxLength={40} onChange={(e) => setLaunch('city', e.target.value)} /></label>
            <label style={label}>Opening date and time (India)
              <input style={input} type="datetime-local" value={toIstLocal(l.opensAt)} onChange={(e) => setLaunch('opensAt', e.target.value ? `${e.target.value}:00+05:30` : l.opensAt)} />
            </label>
            <label style={label}>Button text<input style={input} value={l.buttonText} maxLength={40} onChange={(e) => setLaunch('buttonText', e.target.value)} /></label>
            <label style={label}>After opening: badge<input style={input} value={l.openBadge} maxLength={30} onChange={(e) => setLaunch('openBadge', e.target.value)} /></label>
            <label style={label}>After opening: line above the area<input style={input} value={l.openLead} maxLength={80} onChange={(e) => setLaunch('openLead', e.target.value)} /></label>
          </div>
          <label style={label}>Small print<input style={input} value={l.smallPrint} maxLength={160} onChange={(e) => setLaunch('smallPrint', e.target.value)} /></label>
          <label style={label}>Google Maps link (shows &quot;Get directions&quot; after opening; optional)
            <input style={input} value={l.mapsUrl} placeholder="https://maps.app.goo.gl/…" onChange={(e) => setLaunch('mapsUrl', e.target.value)} />
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px', fontSize: 13.5, color: K.ink }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={l.showCountdown} onChange={(e) => setLaunch('showCountdown', e.target.checked)} style={{ width: 18, height: 18, accentColor: K.green }} />
              Show the countdown
            </label>
          </div>
        </section>

        {/* ── 2. opening-day list ── */}
        <section style={{ ...card, flex: '1 1 300px' }}>
          <h2 style={h2}>Opening-day list</h2>
          <p style={{ ...sub, margin: 0 }}>Customers who tapped &quot;{l.buttonText || 'Notify me'}&quot;.</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-.02em', color: K.ink }}>{stats?.total ?? '—'}</span>
            <span style={{ fontSize: 13.5, color: K.muted }}>people waiting{stats?.today ? ` · ${stats.today} today` : ''}</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13.5, color: K.ink }}>
            <input type="checkbox" checked={l.autoNotify} onChange={(e) => setLaunch('autoNotify', e.target.checked)} style={{ width: 18, height: 18, accentColor: K.green, marginTop: 1 }} />
            <span>Send them one WhatsApp at the opening time
              <span style={{ display: 'block', fontSize: 12, color: K.muted, marginTop: 3, lineHeight: 1.45 }}>
                Needs WhatsApp set up and the <b>bt_outlet_open</b> template approved (category Marketing) before then.
                {stats?.notified ? ` Sent to ${stats.notified} so far.` : ''}
              </span>
            </span>
          </label>
          {!!stats?.recent?.length && (
            <div style={{ borderTop: `1px solid ${K.line}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
              {stats.recent.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, color: K.ink }}>
                  <span>{r.name || 'Guest'} · {r.phone}</span>
                  <span style={{ color: K.muted }}>{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
              ))}
            </div>
          )}
          <button style={ghost} onClick={downloadCsv} disabled={!stats?.total}>Download list (CSV)</button>
        </section>
      </div>

      {/* ── your real Zomato rating ── */}
      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={h2}>Your Zomato rating</h2>
            <p style={sub}>Shown under the launch card as &quot;★ 4.3 · 712 ratings on Zomato&quot;. Copy the numbers from your Zomato page and keep them up to date; it is always labelled as Zomato&apos;s rating.</p>
          </div>
          <Switch
            on={!!cfg.zomatoRating?.enabled}
            onChange={(v) => { setCfg({ ...cfg, zomatoRating: { value: 0, count: 0, ...cfg.zomatoRating, enabled: v } }); setDirty(true); }}
            label="Show Zomato rating"
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          <label style={{ ...label, width: 160 }}>Rating (1.0 – 5.0)
            <input style={input} type="number" min={1} max={5} step={0.1} value={cfg.zomatoRating?.value || ''}
              onChange={(e) => { setCfg({ ...cfg, zomatoRating: { enabled: false, count: 0, ...cfg.zomatoRating, value: Number(e.target.value) || 0 } }); setDirty(true); }} />
          </label>
          <label style={{ ...label, width: 200 }}>Number of ratings
            <input style={input} type="number" min={0} value={cfg.zomatoRating?.count || ''}
              onChange={(e) => { setCfg({ ...cfg, zomatoRating: { enabled: false, value: 0, ...cfg.zomatoRating, count: Math.max(0, Math.floor(Number(e.target.value) || 0)) } }); setDirty(true); }} />
          </label>
        </div>
      </section>

      {/* ── 3. prices on other apps ── */}
      <section style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
          <div>
            <h2 style={h2}>Prices on other apps</h2>
            <p style={sub}>Customers see Zomato | Swiggy | Toing | Order here on each dish, with &quot;You save up to ₹X&quot;. A dish shows the row only when at least one app is dearer than your price. Blank = not on that app.</p>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 600, color: K.ink }}>
            <Switch on={cfg.priceCompare} onChange={(v) => { setCfg({ ...cfg, priceCompare: v }); setDirty(true); }} label="Show price comparison on the site" />
            Show comparison on the site
          </label>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, background: K.soft, borderRadius: 12, padding: '10px 14px', fontSize: 13.5, color: K.ink }}>
          Set my price to
          <input style={{ ...input, width: 70, height: 36 }} inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value.replace(/\D/g, ''))} aria-label="Percent below Zomato" />
          % below Zomato for every dish
          <button style={{ ...ghost, height: 36 }} onClick={applyPct}>Apply</button>
          <span style={{ color: K.muted, fontSize: 12.5 }}>Fills the table below; nothing is saved until you press Save prices.</span>
        </div>
        <div style={{ overflowX: 'auto', border: `1px solid ${K.line}`, borderRadius: 12 }}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: K.soft, textAlign: 'left' }}>
                {['Dish', 'Your price', 'Zomato', 'Swiggy', 'Toing', 'Customer saves'].map((h) => (
                  <th key={h} style={{ padding: '11px 12px', fontSize: 12, fontWeight: 700, color: K.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ c, items }) => (
                <FragmentRows key={c.id} title={`${c.name}${c.featured ? ' · featured' : ''}`}>
                  {items.map((p) => {
                    const ours = Number(val(p, 'price')) || 0;
                    const apps = (['zomatoPrice', 'swiggyPrice', 'toingPrice'] as const).map((k) => Number(val(p, k)) || 0).filter((n) => n > 0);
                    const save = apps.length ? Math.max(...apps) - ours : 0;
                    const isEdited = !!edits[p.id];
                    return (
                      <tr key={p.id} style={{ borderTop: `1px solid ${K.line}`, background: isEdited ? '#FFFBEB' : '#fff' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: K.ink }}>{p.name}</td>
                        {(['price', 'zomatoPrice', 'swiggyPrice', 'toingPrice'] as const).map((k) => (
                          <td key={k} style={{ padding: '8px 12px' }}>
                            <input
                              aria-label={`${k === 'price' ? 'Your' : k.replace('Price', '')} price for ${p.name}`}
                              style={{ ...input, width: 88, height: 36, fontWeight: k === 'price' ? 800 : 500 }}
                              type="number" min={0}
                              value={val(p, k) ?? ''}
                              placeholder="—"
                              onChange={(e) => editPrice(p.id, k, e.target.value)}
                            />
                          </td>
                        ))}
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: save > 0 ? K.green : K.muted }}>
                          {save > 0 ? `up to ₹${Math.round(save)}` : apps.length ? 'not cheaper' : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </FragmentRows>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>
          {changed > 0 && <span style={{ fontSize: 13, color: K.muted }}>{changed} dish{changed === 1 ? '' : 'es'} changed</span>}
          {changed > 0 && <button style={ghost} onClick={() => setEdits({})}>Undo</button>}
          <button style={{ ...btn, opacity: changed ? 1 : 0.55 }} disabled={!changed || savingPrices} onClick={savePrices}>{savingPrices ? 'Saving…' : 'Save prices'}</button>
        </div>
      </section>

      {/* ── 4. other apps ── */}
      <section style={card}>
        <div>
          <h2 style={h2}>&quot;You can also order from&quot;</h2>
          <p style={sub}>Tiles show in this order. A tile without a link stays hidden.</p>
        </div>
        {zomatoTile && zomatoTile.enabled && !zomatoTile.url && (
          <div style={{ background: '#FFF4E5', color: '#8A4206', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontWeight: 600 }}>
            Add your Zomato link so the Zomato tile appears.
          </div>
        )}
        {cfg.platforms.map((t, i) => (
          <div key={t.key} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, border: `1px solid ${K.line}`, borderRadius: 12, padding: '10px 14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button type="button" style={{ ...ghost, height: 22, padding: '0 8px', fontSize: 11 }} onClick={() => moveTile(i, -1)} disabled={i === 0} aria-label={`Move ${t.name} up`}>▲</button>
              <button type="button" style={{ ...ghost, height: 22, padding: '0 8px', fontSize: 11 }} onClick={() => moveTile(i, 1)} disabled={i === cfg.platforms.length - 1} aria-label={`Move ${t.name} down`}>▼</button>
            </div>
            <span style={{ width: 90, fontSize: 17, fontWeight: 800, color: LOOK[t.key].color, fontStyle: LOOK[t.key].italic ? 'italic' : 'normal' }}>{LOOK[t.key].mark}</span>
            <input aria-label={`${t.name} link`} style={{ ...input, flex: '1 1 280px', width: 'auto' }} value={t.url} placeholder={LOOK[t.key].hint} onChange={(e) => setTile(i, { url: e.target.value })} />
            <Switch on={t.enabled} onChange={(v) => setTile(i, { enabled: v })} label={`Show ${t.name} tile`} />
          </div>
        ))}
      </section>
    </div>
  );
}

function FragmentRows({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <tr style={{ background: '#FAFBFA', borderTop: `1px solid ${K.line}` }}>
        <td colSpan={6} style={{ padding: '8px 12px', fontSize: 11.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: K.muted }}>{title}</td>
      </tr>
      {children}
    </>
  );
}
