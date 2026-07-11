'use client';

/**
 * MacroBucketBuilder — "Healthy / High Protein" goal upgrade.
 *
 * Step 1: pick a target (calories OR protein) via quick chips or slider.
 * Step 2: build a bucket — live meter fills toward the target, and the
 * suggestion list re-sorts so the item that best closes the remaining gap
 * is always on top. ±10% of target counts as "on target" (hitting the
 * exact number is never required). "Bana do" auto-fills greedily (max 5
 * items) and the user tweaks from there.
 *
 * Frontend only — uses macro columns already served by GET /products.
 * Items with calories = 0 (missing data) are excluded. If fewer than 6
 * usable items exist, we fall back gracefully to the normal menu view.
 */

import { useMemo, useState } from 'react';
import {
  Product,
  C,
  money,
  catEmoji,
  effectivePrice,
} from '../lib/bite';
import FoodImage from './FoodImage';

type Metric = 'cal' | 'protein';
type Step = 'target' | 'build';

const TOLERANCE = 0.1; // ±10% counts as on-target
const AUTO_MAX_ITEMS = 5;
const MIN_CANDIDATES = 6;

const CHIPS: { label: string; sub: string; metric: Metric; target: number }[] = [
  { label: 'Halka lunch 🍃', sub: 'Under 400 kcal', metric: 'cal', target: 400 },
  { label: 'Balanced meal 🍱', sub: '~600 kcal', metric: 'cal', target: 600 },
  { label: 'Post-workout 💪', sub: '40g protein', metric: 'protein', target: 40 },
];

const metricOf = (p: Product, m: Metric) => (m === 'cal' ? p.calories : p.protein);
const metricUnit = (m: Metric) => (m === 'cal' ? 'kcal' : 'g protein');

export default function MacroBucketBuilder({
  products,
  vegOnly,
  onAdd,
  onClose,
}: {
  products: Product[];
  vegOnly: boolean;
  onAdd: (id: number) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>('target');
  const [metric, setMetric] = useState<Metric>('cal');
  const [target, setTarget] = useState(600);
  const [bucket, setBucket] = useState<Record<number, number>>({});
  const [added, setAdded] = useState(false);

  // Usable items: macro data present, in stock, veg-respecting (Rules 4–6).
  const candidates = useMemo(
    () =>
      products.filter(
        (p) =>
          p.calories > 0 &&
          (metric === 'cal' || p.protein > 0) &&
          p.stockStatus !== 'out_of_stock' &&
          (!vegOnly || p.isVeg),
      ),
    [products, vegOnly, metric],
  );

  const byId = useMemo(
    () => new Map(candidates.map((p) => [p.id, p])),
    [candidates],
  );

  // Bucket totals (always whole numbers on screen — Rule: no float artifacts).
  const totals = useMemo(() => {
    let cal = 0, protein = 0, fat = 0, price = 0, count = 0;
    for (const [idStr, qty] of Object.entries(bucket)) {
      const p = byId.get(Number(idStr));
      if (!p) continue;
      cal += p.calories * qty;
      protein += p.protein * qty;
      fat += p.fat * qty;
      price += effectivePrice(p) * qty;
      count += qty;
    }
    return {
      cal: Math.round(cal),
      protein: Math.round(protein),
      fat: Math.round(fat),
      price: Math.round(price),
      count,
    };
  }, [bucket, byId]);

  const current = metric === 'cal' ? totals.cal : totals.protein;
  const remaining = target - current;
  const pct = Math.min(100, Math.round((current / target) * 100));
  const onTarget = current >= target * (1 - TOLERANCE) && current <= target * (1 + TOLERANCE);
  const over = current > target * (1 + TOLERANCE);

  // Suggestion order: unpicked sorted by "closes the gap best"; picked sink
  // to the bottom with qty steppers (matches the approved design).
  const list = useMemo(() => {
    const unpicked = candidates
      .filter((p) => !bucket[p.id])
      .sort(
        (a, b) =>
          Math.abs(metricOf(a, metric) - remaining) -
          Math.abs(metricOf(b, metric) - remaining),
      )
      .slice(0, 12);
    const picked = candidates.filter((p) => bucket[p.id]);
    return [...unpicked, ...picked];
  }, [candidates, bucket, remaining, metric]);

  const addItem = (id: number) => {
    setAdded(false);
    setBucket((b) => ({ ...b, [id]: (b[id] || 0) + 1 }));
  };
  const subItem = (id: number) => {
    setAdded(false);
    setBucket((b) => {
      const n = { ...b };
      if ((n[id] || 0) > 1) n[id] -= 1;
      else delete n[id];
      return n;
    });
  };

  // "Bana do" — greedy auto-fill: repeatedly add the item ≤ remaining that
  // is closest to remaining; cap at AUTO_MAX_ITEMS; stop once ≥90% filled.
  function autoBuild() {
    const b: Record<number, number> = {};
    let total = 0;
    for (let i = 0; i < AUTO_MAX_ITEMS; i++) {
      const rem = target - total;
      if (total >= target * (1 - TOLERANCE)) break;
      let best: Product | null = null;
      for (const p of candidates) {
        const m = metricOf(p, metric);
        if (m <= 0 || m > rem) continue;
        if (!best || rem - m < rem - metricOf(best, metric)) best = p;
      }
      if (!best) break;
      b[best.id] = (b[best.id] || 0) + 1;
      total += metricOf(best, metric);
    }
    setAdded(false);
    setBucket(b);
  }

  function addBucketToCart() {
    for (const [idStr, qty] of Object.entries(bucket)) {
      const id = Number(idStr);
      for (let i = 0; i < qty; i++) onAdd(id);
    }
    setAdded(true);
  }

  /* ── fallback: not enough macro-tagged items (Rule 5) ── */
  if (candidates.length < MIN_CANDIDATES) {
    return (
      <div className="mb-wrap" role="dialog" aria-label="Healthy meal builder">
        <div className="mb-fb-card">
          <div className="mb-fb-emoji">🥗</div>
          <div className="mb-fb-title">Macro data abhi thodi kam hai</div>
          <div className="mb-fb-sub">
            Koi baat nahi — healthy section se seedha choose kar lo. Sab fresh
            aur pure veg hai!
          </div>
          <button className="mb-cta" onClick={onClose}>Healthy menu dekho →</button>
        </div>
        <MbStyles />
      </div>
    );
  }

  /* ── STEP 1: target picker ── */
  if (step === 'target') {
    const min = metric === 'cal' ? 200 : 10;
    const max = metric === 'cal' ? 1200 : 100;
    const stp = metric === 'cal' ? 50 : 5;
    return (
      <div className="mb-wrap" role="dialog" aria-label="Set your goal">
        <button className="mb-x" onClick={onClose} aria-label="Close">✕</button>

        <div className="mb-head">
          <div className="mb-title">Aaj ka goal kya hai? 🎯</div>
          <div className="mb-sub">Target set karo — Bhaiya bucket bharne mein help karega</div>
        </div>

        <div className="mb-chips">
          {CHIPS.map((c) => (
            <button
              key={c.label}
              className="mb-chip"
              onClick={() => {
                setMetric(c.metric);
                setTarget(c.target);
                setBucket({});
                setStep('build');
              }}
            >
              <span className="mb-chip-title">{c.label}</span>
              <span className="mb-chip-sub">{c.sub}</span>
            </button>
          ))}
        </div>

        <div className="mb-custom">
          <div className="mb-custom-label">Ya apna custom target:</div>

          <div className="mb-seg">
            <button
              className={metric === 'cal' ? 'on' : ''}
              onClick={() => { setMetric('cal'); setTarget(600); }}
            >
              🔥 Calories
            </button>
            <button
              className={metric === 'protein' ? 'on' : ''}
              onClick={() => { setMetric('protein'); setTarget(40); }}
            >
              💪 Protein
            </button>
          </div>

          <div className="mb-slider-row">
            <input
              type="range"
              min={min}
              max={max}
              step={stp}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
            />
            <span className="mb-slider-val">
              {target} {metricUnit(metric)}
            </span>
          </div>

          <button
            className="mb-cta big"
            onClick={() => { setBucket({}); setStep('build'); }}
          >
            Chalo, bucket banao →
          </button>
        </div>
        <MbStyles />
      </div>
    );
  }

  /* ── STEP 2: builder ── */
  return (
    <div className="mb-wrap" role="dialog" aria-label="Build your bucket">
      <button className="mb-x" onClick={onClose} aria-label="Close">✕</button>
      <button className="mb-back" onClick={() => setStep('target')}>← Goal</button>

      <div className="mb-meter-card">
        <div className="mb-meter-top">
          <span className="mb-meter-label">
            {current} / {target} {metricUnit(metric)}
          </span>
          <span
            className="mb-meter-status"
            style={{ color: onTarget ? C.greenDeep : over ? C.orangeDeep : '#3a5a4d' }}
          >
            {totals.count === 0
              ? 'Items add karo ↓'
              : onTarget
                ? 'Target hit! ✓'
                : over
                  ? `${current - target} zyada ho gaya`
                  : `${remaining} aur chahiye`}
          </span>
        </div>
        <div className="mb-bar">
          <div
            className="mb-bar-fill"
            style={{
              width: `${pct}%`,
              background: over
                ? `linear-gradient(90deg,${C.orange},#f7a73a)`
                : `linear-gradient(90deg,${C.green},${C.greenDeep})`,
            }}
          />
        </div>
        <div className="mb-stats">
          <span>🔥 <b>{totals.cal}</b> kcal</span>
          <span>💪 <b>{totals.protein}g</b> protein</span>
          <span>🧈 <b>{totals.fat}g</b> fat</span>
          <span>💰 <b>{money(totals.price)}</b></span>
        </div>
        {totals.count === 0 && (
          <button className="mb-auto" onClick={autoBuild}>
            ✨ Bhaiya, bana do mere liye
          </button>
        )}
      </div>

      <div className="mb-list-label">
        {totals.count === 0 ? 'Best matches pehle 👇' : 'Gap ke hisaab se sorted 👇'}
      </div>

      <div className="mb-list">
        {list.map((p) => {
          const qty = bucket[p.id] || 0;
          const m = metricOf(p, metric);
          const tight = qty === 0 && m > remaining + target * TOLERANCE;
          return (
            <div key={p.id} className={`mb-item ${qty ? 'picked' : ''}`}>
              <div className="mb-item-img">
                <FoodImage src={p.image} alt={p.name} emoji={catEmoji(p.name)} />
              </div>
              <div className="mb-item-info">
                <div className="mb-item-name">{p.name}</div>
                <div className="mb-item-meta">
                  {p.calories} kcal · {Math.round(p.protein)}g protein ·{' '}
                  {money(effectivePrice(p))}
                  {tight && <span className="mb-tight"> · thoda zyada</span>}
                </div>
              </div>
              {qty ? (
                <div className="mb-step">
                  <button onClick={() => subItem(p.id)} aria-label="Remove one">−</button>
                  <span>{qty}</span>
                  <button onClick={() => addItem(p.id)} aria-label="Add one">+</button>
                </div>
              ) : (
                <button className="mb-add" onClick={() => addItem(p.id)}>Add</button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mb-foot">
        <button
          className="mb-cta big"
          disabled={totals.count === 0}
          onClick={addBucketToCart}
        >
          {added
            ? 'Cart mein aa gaya ✓'
            : `Bucket cart mein daalo 🛒 ${totals.count > 0 ? `(${totals.count})` : ''}`}
        </button>
        {added && (
          <button className="mb-see" onClick={onClose}>
            Shopping continue karo →
          </button>
        )}
      </div>
      <MbStyles />
    </div>
  );
}

function MbStyles() {
  return (
    <style>{`
.mb-wrap{position:fixed;top:0;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:480px;z-index:110;overflow-y:auto;
  background:
    radial-gradient(120% 80% at 50% -10%, #1f6e51 0%, transparent 60%),
    linear-gradient(168deg, ${C.dark} 0%, #0f4633 58%, #135a41 100%);
  display:flex;flex-direction:column;padding:60px 18px 26px;
  animation:mbFadeIn .35s ease}
@media(min-width:520px){.mb-wrap{top:18px;bottom:18px;height:calc(100vh - 36px);border-radius:32px}}
.mb-x{position:absolute;top:16px;right:16px;background:rgba(255,255,255,.14);
  border:1px solid rgba(255,255,255,.18);color:#fff;font-size:14px;width:32px;height:32px;
  border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2}
.mb-back{position:absolute;top:18px;left:16px;background:transparent;border:none;color:#cfe6da;
  font-size:13px;font-weight:700;cursor:pointer}
.mb-head{text-align:center;margin-bottom:20px}
.mb-title{color:#fff;font-size:21px;font-weight:800}
.mb-sub{color:#cfe6da;font-size:12.5px;margin-top:5px}
.mb-chips{display:flex;flex-direction:column;gap:10px;margin-bottom:22px}
.mb-chip{display:flex;flex-direction:column;align-items:flex-start;gap:2px;background:rgba(255,255,255,.97);
  border:none;border-radius:15px;padding:13px 16px;cursor:pointer;text-align:left;
  box-shadow:0 8px 24px rgba(0,0,0,.22);transition:transform .12s}
.mb-chip:active{transform:scale(.98)}
.mb-chip-title{font-size:14.5px;font-weight:800;color:${C.ink}}
.mb-chip-sub{font-size:11.5px;color:${C.muted}}
.mb-custom{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:16px}
.mb-custom-label{color:#cfe6da;font-size:12px;font-weight:700;margin-bottom:11px}
.mb-seg{display:flex;gap:8px;margin-bottom:14px}
.mb-seg button{flex:1;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.18);color:#cfe6da;
  font-size:13px;font-weight:700;padding:10px;border-radius:11px;cursor:pointer}
.mb-seg button.on{background:#fff;color:${C.ink};border-color:#fff}
.mb-slider-row{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.mb-slider-row input[type=range]{flex:1;accent-color:${C.green}}
.mb-slider-val{color:#fff;font-size:14px;font-weight:800;min-width:100px;text-align:right}
.mb-cta{background:linear-gradient(135deg,${C.green},${C.greenDeep});color:#fff;border:none;
  font-size:14px;font-weight:800;padding:13px 24px;border-radius:13px;cursor:pointer;
  box-shadow:0 8px 22px rgba(76,175,80,.4)}
.mb-cta.big{width:100%;font-size:15px}
.mb-cta:disabled{opacity:.55;cursor:default}
.mb-meter-card{background:#fff;border-radius:18px;padding:14px 15px;box-shadow:0 12px 34px rgba(0,0,0,.28)}
.mb-meter-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
.mb-meter-label{font-size:15px;font-weight:800;color:${C.ink}}
.mb-meter-status{font-size:11.5px;font-weight:800}
.mb-bar{height:13px;background:${C.bg};border-radius:8px;overflow:hidden}
.mb-bar-fill{height:100%;border-radius:8px;transition:width .3s ease}
.mb-stats{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
.mb-stats span{font-size:11px;color:#3a5a4d}
.mb-stats b{color:${C.ink}}
.mb-auto{width:100%;margin-top:11px;background:${C.orangeSoft};color:${C.orangeDeep};border:1.5px dashed ${C.orange};
  font-size:13px;font-weight:800;padding:11px;border-radius:11px;cursor:pointer}
.mb-list-label{color:#cfe6da;font-size:11.5px;font-weight:700;margin:14px 2px 8px}
.mb-list{display:flex;flex-direction:column;gap:8px;flex:1}
.mb-item{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.97);border-radius:13px;
  padding:9px 11px;animation:mbRowIn .25s ease}
.mb-item.picked{outline:2px solid ${C.green}}
.mb-item-img{width:44px;height:44px;border-radius:10px;background:${C.orangeSoft};display:flex;
  align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}
.mb-item-img img{width:100%;height:100%;object-fit:cover}
.mb-item-img .food-emoji{font-size:22px}
.mb-item-info{flex:1;min-width:0}
.mb-item-name{font-size:13px;font-weight:800;color:${C.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mb-item-meta{font-size:10.5px;color:${C.muted};margin-top:2px}
.mb-tight{color:${C.orangeDeep};font-weight:800}
.mb-add{background:${C.greenSoft};color:${C.greenDeep};border:1.5px solid ${C.green};font-size:12px;
  font-weight:800;padding:7px 16px;border-radius:9px;cursor:pointer}
.mb-step{display:flex;align-items:center;gap:9px}
.mb-step button{width:27px;height:27px;border-radius:8px;border:1.5px solid ${C.line};background:#fff;
  font-size:15px;font-weight:800;color:${C.ink};cursor:pointer;display:flex;align-items:center;justify-content:center}
.mb-step span{font-size:13.5px;font-weight:800;color:${C.ink};min-width:14px;text-align:center}
.mb-foot{margin-top:14px;text-align:center}
.mb-see{margin-top:11px;background:transparent;border:none;color:#cfe6da;font-size:13px;
  font-weight:600;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.mb-fb-card{background:#fff;border-radius:20px;padding:28px 24px;margin:auto;text-align:center;max-width:320px;
  box-shadow:0 18px 50px rgba(0,0,0,.35)}
.mb-fb-emoji{font-size:44px}
.mb-fb-title{font-size:15.5px;font-weight:800;color:${C.ink};margin-top:10px}
.mb-fb-sub{font-size:12.5px;color:${C.muted};margin:6px 0 16px}
@keyframes mbFadeIn{from{opacity:0}to{opacity:1}}
@keyframes mbRowIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    `}</style>
  );
}
