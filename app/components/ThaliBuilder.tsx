'use client';

/**
 * ThaliBuilder — Customize Thali with a LIVE ANIMATED PLATE (Feature 1.4).
 *
 * The plate is fully dynamic: sections come from the admin-configured
 * template (GET /thali-templates), and katoris (bowls) are positioned
 * around the plate automatically — admin adds a 5th section, the plate
 * grows a 5th bowl. Picking an option makes food POP into its katori.
 * Price + calories tick live; the review step verifies the total with
 * the server (POST /thali-templates/:id/price-check) so the price shown
 * is always the price charged.
 *
 * Ordering integration (cart/checkout/kitchen slip) lands in the next
 * patch — this ships the full build experience + server validation.
 */

import { useEffect, useMemo, useState } from 'react';
import { C, API_BASE, money, catEmoji } from '../lib/bite';

/* ── API types (shape of GET /thali-templates) ── */
export interface ThaliOptionT {
  id: number; name: string; extraPrice: number; // per-portion price
  calories: number; protein: number; image?: string;
  maxQty: number; // admin-decided portion ceiling
}
export interface ThaliSectionT {
  id: number; name: string; minSelect: number; maxSelect: number;
  options: ThaliOptionT[];
}
export interface ThaliTemplateT {
  id: number; name: string; basePrice: number; image?: string;
  sections: ThaliSectionT[];
}
export interface ThaliConfig {
  templateId: number; templateName: string; total: number;
  selections: Record<string, string[]>; // "Roti / Rice": ["4 × Tawa Roti"]
  portions: { optionId: number; qty: number }[];
}

function buzz(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch {}
}

/* katori position around the plate center, section i of n */
function katoriPos(i: number, n: number) {
  const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
  const r = n <= 3 ? 30 : 33; // % of plate radius
  return {
    left: `${50 + r * Math.cos(angle)}%`,
    top: `${50 + r * Math.sin(angle)}%`,
  };
}

export default function ThaliBuilder({
  onDone,
  onSkip,
}: {
  /** full validated config, after server price-check */
  onDone: (config: ThaliConfig) => void;
  /** ✕ — back to clean home */
  onSkip: () => void;
}) {
  const [templates, setTemplates] = useState<ThaliTemplateT[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState(0); // section index; sections.length = review
  const [picked, setPicked] = useState<Record<number, Record<number, number>>>({}); // sectionId → optionId → qty
  const [justFilled, setJustFilled] = useState<number | null>(null); // sectionId pop anim
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [serverErr, setServerErr] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/thali-templates`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => setFailed(true));
  }, []);

  const t = templates?.[0] || null; // v1: first active template
  const sections = useMemo(() => t?.sections || [], [t]);
  const optionById = useMemo(() => {
    const m = new Map<number, ThaliOptionT>();
    sections.forEach((s) => s.options.forEach((o) => m.set(o.id, o)));
    return m;
  }, [sections]);

  const portions = useMemo(() => {
    const out: { optionId: number; qty: number }[] = [];
    for (const m of Object.values(picked)) {
      for (const [id, q] of Object.entries(m)) {
        if (q > 0) out.push({ optionId: Number(id), qty: q });
      }
    }
    return out;
  }, [picked]);
  const totals = useMemo(() => {
    let items = 0, cal = 0, protein = 0, units = 0;
    for (const { optionId, qty } of portions) {
      const o = optionById.get(optionId);
      if (!o) continue;
      items += o.extraPrice * qty; cal += o.calories * qty;
      protein += o.protein * qty; units += qty;
    }
    return {
      price: Math.round((t?.basePrice || 0) + items),
      cal: Math.round(cal),
      protein: Math.round(protein),
      units,
    };
  }, [portions, optionById, t]);

  const isReview = t ? step >= sections.length : false;
  const cur = !isReview ? sections[step] : null;
  const curQty = cur ? picked[cur.id] || {} : {};
  const sectionUnits = (sid: number) =>
    Object.values(picked[sid] || {}).reduce((a, b) => a + b, 0);
  const canNext = cur ? sectionUnits(cur.id) >= cur.minSelect : false;

  /* change portions of an option: delta = +1 / -1 (admin caps respected) */
  function changeQty(s: ThaliSectionT, o: ThaliOptionT, delta: number) {
    setServerTotal(null); setServerErr('');
    setPicked((prev) => {
      const secNow = { ...(prev[s.id] || {}) };
      const now = secNow[o.id] || 0;
      const units = Object.values(secNow).reduce((a, b) => a + b, 0);
      let next = now + delta;
      if (next < 0) next = 0;
      if (next > o.maxQty) next = o.maxQty; // per-option admin ceiling
      if (delta > 0 && units >= s.maxSelect) return prev; // section portion cap
      if (delta > 0 && next > now) {
        buzz(20);
        setJustFilled(s.id);
        setTimeout(() => setJustFilled(null), 500);
      }
      if (next === 0) delete secNow[o.id];
      else secNow[o.id] = next;
      return { ...prev, [s.id]: secNow };
    });
  }

  /* review step → verify with server (price shown = price charged).
     `verifying` is derived: on review, with picks, and no result yet. */
  const verifying =
    isReview && portions.length > 0 && serverTotal === null && !serverErr;

  useEffect(() => {
    if (!isReview || !t || portions.length === 0) return;
    fetch(`${API_BASE}/thali-templates/${t.id}/price-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selections: portions }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.message || 'Validation failed');
        setServerTotal(Math.round(Number(d.total)));
      })
      .catch((e: Error) => setServerErr(e.message || 'Validation failed'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReview, t?.id, portions.map((p) => `${p.optionId}x${p.qty}`).join(',')]);

  function finish() {
    if (!t || serverTotal === null) return;
    const selections: Record<string, string[]> = {};
    for (const s of sections) {
      const names = Object.entries(picked[s.id] || {})
        .filter(([, q]) => q > 0)
        .map(([id, q]) => {
          const o = optionById.get(Number(id));
          return o ? (q > 1 ? `${q} × ${o.name}` : o.name) : '';
        })
        .filter(Boolean);
      if (names.length) selections[s.name] = names;
    }
    buzz([40, 60, 40]);
    onDone({
      templateId: t.id,
      templateName: t.name,
      total: serverTotal,
      selections,
      portions,
    });
  }

  /* ── loading / failure / empty ── */
  if (failed || (templates && templates.length === 0)) {
    return (
      <div className="tb-wrap" role="dialog" aria-label="Customize thali">
        <div className="tb-fb-card">
          <div className="tb-fb-emoji">🎨</div>
          <div className="tb-fb-title">Customize Thali jald aa raha hai!</div>
          <div className="tb-fb-sub">Tab tak Regular Thali try karo — aaj ki set thali ekdum fresh hai 😊</div>
          <button className="tb-cta" onClick={onSkip}>Theek hai →</button>
        </div>
        <TbStyles />
      </div>
    );
  }
  if (!templates || !t) {
    return (
      <div className="tb-wrap" role="dialog" aria-label="Customize thali">
        <div className="tb-loading">🍛 Thali sajai ja rahi hai…</div>
        <TbStyles />
      </div>
    );
  }

  const n = Math.max(sections.length, 1);

  return (
    <div className="tb-wrap" role="dialog" aria-label="Customize thali">
      <button className="tb-x" onClick={onSkip} aria-label="Skip">✕</button>
      {step > 0 && (
        <button className="tb-back" onClick={() => setStep((v) => v - 1)}>← Wapas</button>
      )}

      <div className="tb-head">
        <div className="tb-title">{t.name} 🎨</div>
        <div className="tb-progress">
          {sections.map((s, i) => (
            <span key={s.id} className={`dot ${i < step || isReview ? 'done' : ''} ${i === step ? 'cur' : ''}`} />
          ))}
          <span className={`dot ${isReview ? 'cur' : ''}`} />
        </div>
      </div>

      {/* ── THE ANIMATED PLATE — katoris generated from admin sections ── */}
      <div className="tb-plate-stage">
        <div className="tb-plate">
          {sections.map((s, i) => {
            const secQty = picked[s.id] || {};
            const units = Object.values(secQty).reduce((a, b) => a + b, 0);
            const firstId = Object.keys(secQty)[0];
            const first = firstId ? optionById.get(Number(firstId)) : null;
            const pos = katoriPos(i, n);
            return (
              <div
                key={s.id}
                className={`tb-katori ${units ? 'filled' : ''} ${cur?.id === s.id ? 'active' : ''} ${justFilled === s.id ? 'pop' : ''}`}
                style={pos}
                title={s.name}
              >
                {units ? (
                  <span className="tb-katori-food">
                    {catEmoji(first?.name || s.name)}
                    {units > 1 && <b className="tb-katori-n">{units}</b>}
                  </span>
                ) : (
                  <span className="tb-katori-empty">{s.name.slice(0, 6)}</span>
                )}
              </div>
            );
          })}
          <div className="tb-plate-center">
            <span className="tb-plate-price">{money(serverTotal ?? totals.price)}</span>
            {totals.cal > 0 && <span className="tb-plate-cal">{totals.cal} kcal</span>}
          </div>
        </div>
      </div>

      {/* ── section picker / review ── */}
      {!isReview && cur ? (
        <>
          <div className="tb-sec-head">
            <span className="tb-sec-name">{cur.name} chuno</span>
            <span className="tb-sec-rule">
              {`${sectionUnits(cur.id)}/${cur.maxSelect} portions${cur.minSelect > 0 ? ` · min ${cur.minSelect}` : ''}`}
            </span>
          </div>
          <div className="tb-opts">
            {cur.options.map((o) => {
              const q = curQty[o.id] || 0;
              return (
                <div key={o.id} className={`tb-opt ${q ? 'on' : ''}`}>
                  <span className="tb-opt-emoji">{catEmoji(o.name)}</span>
                  <span className="tb-opt-info">
                    <span className="tb-opt-name">{o.name}</span>
                    <span className="tb-opt-meta">
                      {o.extraPrice > 0
                        ? <b className="tb-opt-extra">{money(o.extraPrice)}/portion</b>
                        : 'free'}
                      {o.calories > 0 && ` · ${o.calories} kcal`}
                      {o.maxQty > 1 && ` · max ${o.maxQty}`}
                    </span>
                  </span>
                  {q === 0 ? (
                    <button className="tb-opt-add" onClick={() => changeQty(cur, o, 1)}>
                      Add
                    </button>
                  ) : (
                    <span className="tb-opt-step">
                      <button onClick={() => changeQty(cur, o, -1)} aria-label="Kam karo">−</button>
                      <b>{q}</b>
                      <button
                        onClick={() => changeQty(cur, o, 1)}
                        disabled={q >= o.maxQty || sectionUnits(cur.id) >= cur.maxSelect}
                        aria-label="Aur badhao"
                      >
                        +
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="tb-foot">
            <button
              className="tb-cta big"
              disabled={!canNext || (step === sections.length - 1 && totals.units === 0)}
              onClick={() => setStep((v) => v + 1)}
            >
              {!canNext
                ? `Pehle ${cur.name.toLowerCase()} chuno (min ${cur.minSelect})`
                : step === sections.length - 1
                  ? totals.units === 0 ? 'Kuch toh add karo 😄' : 'Review karo →'
                  : 'Aage badho →'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="tb-review">
            {sections.map((s) => {
              const names = Object.entries(picked[s.id] || {})
                .filter(([, q]) => q > 0)
                .map(([id, q]) => {
                  const o = optionById.get(Number(id));
                  return o ? (q > 1 ? `${q} × ${o.name}` : o.name) : '';
                })
                .filter(Boolean);
              if (!names.length) return null;
              return (
                <div key={s.id} className="tb-rev-row">
                  <span className="tb-rev-sec">{s.name}</span>
                  <span className="tb-rev-val">{names.join(', ')}</span>
                </div>
              );
            })}
            <div className="tb-rev-row total">
              <span className="tb-rev-sec">Total</span>
              <span className="tb-rev-val">
                {verifying ? 'Bhaiya check kar raha hai…' : serverTotal !== null ? (
                  <>
                    {money(serverTotal)} <em className="tb-verified">✓ verified</em>
                  </>
                ) : serverErr ? '—' : money(totals.price)}
              </span>
            </div>
            {serverErr && <div className="tb-err">⚠️ {serverErr}</div>}
          </div>
          <div className="tb-foot">
            <button
              className="tb-cta big"
              disabled={verifying || serverTotal === null}
              onClick={finish}
            >
              Meri thali taiyaar 🍛 {serverTotal !== null ? money(serverTotal) : ''}
            </button>
          </div>
        </>
      )}
      <TbStyles />
    </div>
  );
}

function TbStyles() {
  return (
    <style>{`
.tb-wrap{position:fixed;top:0;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:480px;z-index:110;overflow-y:auto;
  background:
    radial-gradient(120% 80% at 50% -10%, #1f6e51 0%, transparent 60%),
    linear-gradient(168deg, ${C.dark} 0%, #0f4633 58%, #135a41 100%);
  display:flex;flex-direction:column;padding:56px 18px 26px;animation:tbFadeIn .35s ease}
@media(min-width:520px){.tb-wrap{top:18px;bottom:18px;height:calc(100vh - 36px);border-radius:32px}}
.tb-x{position:absolute;top:16px;right:16px;background:rgba(255,255,255,.14);
  border:1px solid rgba(255,255,255,.18);color:#fff;font-size:14px;width:32px;height:32px;
  border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5}
.tb-back{position:absolute;top:18px;left:16px;background:transparent;border:none;color:#cfe6da;
  font-size:13px;font-weight:700;cursor:pointer;z-index:5}
.tb-head{text-align:center;margin-bottom:10px}
.tb-title{color:#fff;font-size:20px;font-weight:800}
.tb-progress{display:flex;justify-content:center;gap:6px;margin-top:9px}
.dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.25);transition:all .25s}
.dot.done{background:#7ee787}
.dot.cur{background:#fff;transform:scale(1.35)}
.tb-plate-stage{display:flex;justify-content:center;margin:6px 0 12px}
.tb-plate{position:relative;width:230px;height:230px;border-radius:50%;
  background:radial-gradient(circle at 38% 32%, #ffffff 0%, #eef2ee 46%, #d7ded7 78%, #c3ccc3 100%);
  box-shadow:0 18px 44px rgba(0,0,0,.4), inset 0 2px 10px rgba(255,255,255,.9), inset 0 -6px 16px rgba(0,0,0,.12);
  animation:plateIn .5s cubic-bezier(.2,.9,.3,1.15)}
.tb-katori{position:absolute;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;transition:all .25s;
  background:radial-gradient(circle at 40% 32%, #f7f9f7, #dfe6df 70%, #ccd5cc);
  box-shadow:inset 0 3px 8px rgba(0,0,0,.18), 0 2px 6px rgba(0,0,0,.12)}
.tb-katori.active{outline:2.5px dashed ${C.orange};outline-offset:2px;animation:katoriHint 1.3s ease-in-out infinite}
.tb-katori.filled{background:radial-gradient(circle at 40% 32%, #fff7ea, ${C.orangeSoft} 75%)}
.tb-katori.pop{animation:katoriPop .45s cubic-bezier(.2,.9,.3,1.4)}
.tb-katori-food{font-size:26px;line-height:1;position:relative;animation:foodDrop .4s cubic-bezier(.2,.9,.3,1.3)}
.tb-katori-n{position:absolute;top:-7px;right:-11px;background:${C.green};color:#fff;font-size:9px;
  font-weight:800;width:15px;height:15px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.tb-katori-empty{font-size:8.5px;font-weight:800;color:#8fa295;text-transform:uppercase;letter-spacing:.3px;text-align:center}
.tb-plate-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;
  background:rgba(255,255,255,.92);border-radius:50%;width:74px;height:74px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;box-shadow:inset 0 2px 8px rgba(0,0,0,.12)}
.tb-plate-price{font-size:16px;font-weight:800;color:${C.ink};transition:all .2s}
.tb-plate-cal{font-size:9px;font-weight:700;color:${C.muted}}
.tb-sec-head{display:flex;justify-content:space-between;align-items:baseline;margin:2px 2px 8px}
.tb-sec-name{color:#fff;font-size:15px;font-weight:800}
.tb-sec-rule{color:#cfe6da;font-size:11px;font-weight:700}
.tb-opts{display:flex;flex-direction:column;gap:8px;flex:1}
.tb-opt{display:flex;align-items:center;gap:11px;background:rgba(255,255,255,.97);border:none;border-radius:13px;
  padding:11px 12px;text-align:left;animation:tbRowIn .25s ease}
.tb-opt.on{outline:2px solid ${C.green};background:#f4fbf4}
.tb-opt-emoji{font-size:24px;flex-shrink:0}
.tb-opt-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.tb-opt-name{font-size:13.5px;font-weight:800;color:${C.ink}}
.tb-opt-meta{font-size:10.5px;color:${C.muted}}
.tb-opt-extra{color:${C.orangeDeep}}
.tb-opt-add{background:${C.greenSoft};color:${C.greenDeep};border:1.5px solid ${C.green};font-size:12px;
  font-weight:800;padding:7px 16px;border-radius:9px;cursor:pointer;flex-shrink:0}
.tb-opt-step{display:flex;align-items:center;gap:8px;flex-shrink:0}
.tb-opt-step button{width:27px;height:27px;border-radius:8px;border:1.5px solid ${C.line};background:#fff;
  font-size:15px;font-weight:800;color:${C.ink};cursor:pointer;display:flex;align-items:center;justify-content:center}
.tb-opt-step button:disabled{opacity:.4;cursor:default}
.tb-opt-step b{font-size:13.5px;font-weight:800;color:${C.ink};min-width:14px;text-align:center}
.tb-foot{margin-top:14px;text-align:center}
.tb-cta{background:linear-gradient(135deg,${C.green},${C.greenDeep});color:#fff;border:none;
  font-size:14px;font-weight:800;padding:13px 24px;border-radius:13px;cursor:pointer;
  box-shadow:0 8px 22px rgba(76,175,80,.4)}
.tb-cta.big{width:100%;font-size:15px}
.tb-cta:disabled{opacity:.5;cursor:default}
.tb-review{background:rgba(255,255,255,.97);border-radius:16px;padding:6px 14px;box-shadow:0 12px 32px rgba(0,0,0,.26)}
.tb-rev-row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px dashed ${C.line}}
.tb-rev-row:last-child{border-bottom:none}
.tb-rev-row.total .tb-rev-sec,.tb-rev-row.total .tb-rev-val{font-size:14.5px;font-weight:800;color:${C.ink}}
.tb-rev-sec{font-size:12px;font-weight:800;color:${C.muted};flex-shrink:0}
.tb-rev-val{font-size:12.5px;font-weight:700;color:${C.ink};text-align:right}
.tb-verified{font-style:normal;font-size:10px;color:${C.greenDeep};font-weight:800}
.tb-err{color:#b3261e;font-size:11.5px;font-weight:700;padding:8px 0}
.tb-loading{margin:auto;color:#fff;font-size:15px;font-weight:800;animation:tbPulse 1.2s ease-in-out infinite}
.tb-fb-card{background:#fff;border-radius:20px;padding:28px 24px;margin:auto;text-align:center;max-width:320px;
  box-shadow:0 18px 50px rgba(0,0,0,.35)}
.tb-fb-emoji{font-size:44px}
.tb-fb-title{font-size:15.5px;font-weight:800;color:${C.ink};margin-top:10px}
.tb-fb-sub{font-size:12.5px;color:${C.muted};margin:6px 0 16px}
@keyframes tbFadeIn{from{opacity:0}to{opacity:1}}
@keyframes tbRowIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes plateIn{0%{transform:scale(.85);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes katoriPop{0%{transform:scale(1)}45%{transform:scale(1.22)}100%{transform:scale(1)}}
@keyframes foodDrop{0%{transform:translateY(-14px) scale(.6);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
@keyframes katoriHint{0%,100%{outline-offset:2px}50%{outline-offset:5px}}
@keyframes tbPulse{0%,100%{opacity:.7}50%{opacity:1}}
    `}</style>
  );
}
