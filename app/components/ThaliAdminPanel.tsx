'use client';

/**
 * ThaliAdminPanel — admin UI for the Customize Thali builder (Feature 1.4).
 * Templates → sections (min/max portions) → options (₹/portion, max portions,
 * calories, daily availability switch). Every write goes through the global
 * AdminWriteGuard via the x-admin-key header the admin page already uses.
 */

import { useCallback, useEffect, useState } from 'react';
import { API_BASE, C } from '../lib/bite';

type Opt = {
  id: number; name: string; extraPrice: number; calories: number | null;
  protein: number | null; isAvailable: boolean; maxQty: number; sortOrder: number;
};
type Sec = {
  id: number; name: string; minSelect: number; maxSelect: number;
  sortOrder: number; options: Opt[];
};
type Tpl = {
  id: number; name: string; basePrice: number; status: string; sections: Sec[];
};

/* raw shapes from GET /thali-templates/admin (TypeORM entities) */
type RawOpt = {
  id: number | string; name: string; extraPrice: number | string;
  calories: number | null; protein: number | string | null;
  isAvailable: boolean; maxQty?: number; sortOrder: number;
};
type RawSec = {
  id: number | string; name: string; minSelect: number; maxSelect: number;
  sortOrder: number; options?: RawOpt[];
};
type RawTpl = {
  id: number | string; name: string; basePrice: number | string;
  status: string; sections?: RawSec[];
};

const card: React.CSSProperties = {
  background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12,
  padding: 14, marginBottom: 12,
};
const inp: React.CSSProperties = {
  border: `1px solid ${C.line}`, borderRadius: 8, padding: '6px 9px',
  fontSize: 12.5, width: 90,
};
const btn: React.CSSProperties = {
  background: C.green, color: '#fff', border: 'none', borderRadius: 8,
  padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  ...btn, background: '#fff', color: C.ink, border: `1px solid ${C.line}`,
};
const btnDanger: React.CSSProperties = { ...btnGhost, color: '#b3261e' };

export default function ThaliAdminPanel({
  adminHeaders,
  showToast,
}: {
  adminHeaders: () => Record<string, string>;
  showToast: (msg: string, type?: string) => void;
}) {
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [newTpl, setNewTpl] = useState({ name: '', basePrice: 0 });

  const load = useCallback(() => {
    fetch(`${API_BASE}/thali-templates/admin`, { headers: adminHeaders() })
      .then((r) => r.json())
      .then((rows: RawTpl[]) =>
        setTpls(
          (Array.isArray(rows) ? rows : []).map((t) => ({
            id: Number(t.id), name: t.name, basePrice: Number(t.basePrice),
            status: t.status,
            sections: (t.sections || [])
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((s) => ({
                id: Number(s.id), name: s.name, minSelect: s.minSelect,
                maxSelect: s.maxSelect, sortOrder: s.sortOrder,
                options: (s.options || [])
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((o) => ({
                    id: Number(o.id), name: o.name, extraPrice: Number(o.extraPrice),
                    calories: o.calories, protein: o.protein === null ? null : Number(o.protein),
                    isAvailable: !!o.isAvailable, maxQty: o.maxQty ?? 1,
                    sortOrder: o.sortOrder,
                  })),
              })),
          })),
        ),
      )
      .catch(() => showToast('Thali templates load nahi hue', 'error'));
  }, [adminHeaders, showToast]);

  useEffect(() => { load(); }, [load]);

  async function api(method: string, path: string, body?: unknown) {
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || 'Failed');
      load();
      return true;
    } catch (e) {
      showToast((e as Error).message, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10 }}>🍛 Thali Builder</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
        Thali ₹0 se shuru hoti hai; har option ka apna ₹/portion aur max portions.
        Section limits = us katori mein total portions. Availability off = turant app se gayab.
      </div>

      {/* new template */}
      <div style={{ ...card, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input style={{ ...inp, width: 200 }} placeholder="New thali name"
          value={newTpl.name} onChange={(e) => setNewTpl({ ...newTpl, name: e.target.value })} />
        <input style={inp} type="number" placeholder="Base ₹"
          value={newTpl.basePrice} onChange={(e) => setNewTpl({ ...newTpl, basePrice: Number(e.target.value) })} />
        <button style={btn} disabled={busy || !newTpl.name.trim()}
          onClick={async () => {
            if (await api('POST', '/thali-templates', { name: newTpl.name.trim(), basePrice: newTpl.basePrice }))
              { setNewTpl({ name: '', basePrice: 0 }); showToast('Template ban gaya ✓'); }
          }}>
          + Add template
        </button>
      </div>

      {tpls.map((t) => (
        <div key={t.id} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 14 }}>{t.name}</b>
            <span style={{ fontSize: 11, color: C.muted }}>base ₹{t.basePrice}</span>
            <span style={{
              fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
              background: t.status === 'active' ? '#e8f5e9' : '#fdecea',
              color: t.status === 'active' ? C.greenDeep : '#b3261e',
            }}>{t.status}</span>
            <span style={{ flex: 1 }} />
            <button style={btnGhost} disabled={busy}
              onClick={() => api('PATCH', `/thali-templates/${t.id}`, { status: t.status === 'active' ? 'inactive' : 'active' })}>
              {t.status === 'active' ? 'Deactivate' : 'Activate'}
            </button>
            <button style={btnGhost} onClick={() => setOpen(open === t.id ? null : t.id)}>
              {open === t.id ? 'Close ▲' : 'Sections ▼'}
            </button>
            <button style={btnDanger} disabled={busy}
              onClick={() => { if (confirm(`Delete "${t.name}" poora?`)) api('DELETE', `/thali-templates/${t.id}`); }}>
              Delete
            </button>
          </div>

          {open === t.id && (
            <div style={{ marginTop: 12, borderTop: `1px dashed ${C.line}`, paddingTop: 10 }}>
              {t.sections.map((s) => (
                <SectionRow key={s.id} s={s} busy={busy} api={api} showToast={showToast} />
              ))}
              <AddSection tplId={t.id} nextOrder={t.sections.length + 1} busy={busy} api={api} showToast={showToast} />
            </div>
          )}
        </div>
      ))}
      {tpls.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>Koi template nahi — upar se banao.</div>}
    </div>
  );
}

function SectionRow({ s, busy, api, showToast }: {
  s: Sec; busy: boolean;
  api: (m: string, p: string, b?: unknown) => Promise<boolean>;
  showToast: (m: string, t?: string) => void;
}) {
  const [min, setMin] = useState(s.minSelect);
  const [max, setMax] = useState(s.maxSelect);
  const [add, setAdd] = useState({ name: '', price: 0, cal: 0, maxQty: 1 });
  return (
    <div style={{ background: '#fafcfa', border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13 }}>🥣 {s.name}</b>
        <span style={{ fontSize: 11, color: C.muted }}>portions:</span>
        <input style={{ ...inp, width: 52 }} type="number" value={min} onChange={(e) => setMin(Number(e.target.value))} />
        <span style={{ fontSize: 11 }}>–</span>
        <input style={{ ...inp, width: 52 }} type="number" value={max} onChange={(e) => setMax(Number(e.target.value))} />
        {(min !== s.minSelect || max !== s.maxSelect) && (
          <button style={btn} disabled={busy}
            onClick={async () => { if (await api('PATCH', `/thali-templates/sections/${s.id}`, { minSelect: min, maxSelect: max })) showToast('Section update ✓'); }}>
            Save
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button style={btnDanger} disabled={busy}
          onClick={() => { if (confirm(`Delete section "${s.name}"?`)) api('DELETE', `/thali-templates/sections/${s.id}`); }}>
          Delete
        </button>
      </div>

      <div style={{ marginTop: 8 }}>
        {s.options.map((o) => <OptionRow key={o.id} o={o} busy={busy} api={api} showToast={showToast} />)}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
          <input style={{ ...inp, width: 150 }} placeholder="New option"
            value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
          <input style={{ ...inp, width: 70 }} type="number" placeholder="₹/portion" title="₹ per portion"
            value={add.price} onChange={(e) => setAdd({ ...add, price: Number(e.target.value) })} />
          <input style={{ ...inp, width: 62 }} type="number" placeholder="kcal" title="calories"
            value={add.cal} onChange={(e) => setAdd({ ...add, cal: Number(e.target.value) })} />
          <input style={{ ...inp, width: 62 }} type="number" placeholder="max" title="max portions"
            value={add.maxQty} onChange={(e) => setAdd({ ...add, maxQty: Number(e.target.value) })} />
          <button style={btnGhost} disabled={busy || !add.name.trim()}
            onClick={async () => {
              if (await api('POST', '/thali-templates/options', {
                sectionId: s.id, name: add.name.trim(), extraPrice: add.price,
                calories: add.cal || undefined, maxQty: add.maxQty || 1,
                sortOrder: s.options.length + 1,
              })) { setAdd({ name: '', price: 0, cal: 0, maxQty: 1 }); showToast('Option add ✓'); }
            }}>
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionRow({ o, busy, api, showToast }: {
  o: Opt; busy: boolean;
  api: (m: string, p: string, b?: unknown) => Promise<boolean>;
  showToast: (m: string, t?: string) => void;
}) {
  const [price, setPrice] = useState(o.extraPrice);
  const [maxQty, setMaxQty] = useState(o.maxQty);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '5px 0', flexWrap: 'wrap' }}>
      <span style={{ minWidth: 150, fontWeight: 600, opacity: o.isAvailable ? 1 : 0.45 }}>
        {o.name}{o.calories ? <em style={{ fontStyle: 'normal', color: C.muted, fontSize: 10.5 }}> · {o.calories} kcal</em> : null}
      </span>
      <span style={{ fontSize: 10.5, color: C.muted }}>₹</span>
      <input style={{ ...inp, width: 60 }} type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
      <span style={{ fontSize: 10.5, color: C.muted }}>max</span>
      <input style={{ ...inp, width: 52 }} type="number" value={maxQty} onChange={(e) => setMaxQty(Number(e.target.value))} />
      {(price !== o.extraPrice || maxQty !== o.maxQty) && (
        <button style={btn} disabled={busy}
          onClick={async () => { if (await api('PATCH', `/thali-templates/options/${o.id}`, { extraPrice: price, maxQty })) showToast('Option update ✓'); }}>
          Save
        </button>
      )}
      <button
        style={{ ...btnGhost, color: o.isAvailable ? C.greenDeep : '#b3261e' }}
        disabled={busy}
        title="Daily on/off — off = turant app se gayab"
        onClick={() => api('PATCH', `/thali-templates/options/${o.id}`, { isAvailable: !o.isAvailable })}
      >
        {o.isAvailable ? '● Available' : '○ Off'}
      </button>
      <button style={btnDanger} disabled={busy}
        onClick={() => { if (confirm(`Delete "${o.name}"?`)) api('DELETE', `/thali-templates/options/${o.id}`); }}>
        ✕
      </button>
    </div>
  );
}

function AddSection({ tplId, nextOrder, busy, api, showToast }: {
  tplId: number; nextOrder: number; busy: boolean;
  api: (m: string, p: string, b?: unknown) => Promise<boolean>;
  showToast: (m: string, t?: string) => void;
}) {
  const [f, setF] = useState({ name: '', min: 0, max: 3 });
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input style={{ ...inp, width: 150 }} placeholder="New section (e.g. Sweet)"
        value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input style={{ ...inp, width: 52 }} type="number" title="min portions"
        value={f.min} onChange={(e) => setF({ ...f, min: Number(e.target.value) })} />
      <span style={{ fontSize: 11 }}>–</span>
      <input style={{ ...inp, width: 52 }} type="number" title="max portions"
        value={f.max} onChange={(e) => setF({ ...f, max: Number(e.target.value) })} />
      <button style={btnGhost} disabled={busy || !f.name.trim()}
        onClick={async () => {
          if (await api('POST', '/thali-templates/sections', {
            templateId: tplId, name: f.name.trim(), minSelect: f.min, maxSelect: f.max, sortOrder: nextOrder,
          })) { setF({ name: '', min: 0, max: 3 }); showToast('Section add ✓ (plate mein nayi katori!)'); }
        }}>
        + Add section
      </button>
    </div>
  );
}
