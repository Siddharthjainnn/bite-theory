'use client';

/**
 * MacroBucketBuilder v2 — "Healthy / High Protein" goal, gamified.
 *
 * Step 1: pick a target (calories OR protein) via quick chips or slider.
 * Step 2: build a bucket around a circular progress ring:
 *  - number counts up, center emoji evolves with progress
 *  - Bhaiya reacts live in Hinglish as the bucket fills
 *  - items that would land the total exactly in the target zone get a
 *    glowing "✨ PERFECT FIT" badge and float to the top
 *  - confetti + vibration the moment the target zone is hit
 * ±10% of target counts as "on target" — hitting the exact number is
 * never required.
 *
 * Skip (✕) → onSkip (home page). Fallback "healthy menu" → onClose.
 * Frontend only — uses macro columns already served by GET /products.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Product,
  C,
  AVATAR_FACE,
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
const metricUnit = (m: Metric) => (m === 'cal' ? 'kcal' : 'g');

/* Bhaiya's live commentary, by progress zone */
function bhaiyaLine(pctVal: number, onTarget: boolean, over: boolean, count: number): string {
  if (count === 0) return 'Chalo shuru karein! Neeche se items uthao 👇';
  if (onTarget) return 'PERFECT! Bhaiya proud hai 🥹 Ab cart mein daalo!';
  if (over) return 'Arre thoda zyada ho gaya 😅 Ek item minus karo?';
  if (pctVal >= 75) return 'Bas thoda sa aur... almost ho gaya! 🔥';
  if (pctVal >= 50) return 'Half way ho gaya! Mast ja rahe ho 💪';
  if (pctVal >= 25) return 'Shuruaat ekdum sahi hai! Aur badhao 😄';
  return 'Achha pick! Ab aur add karo 👌';
}

/* count-up hook: animates displayed number toward `value` */
function useCountUp(value: number, ms = 450): number {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

function buzz(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {}
}

export default function MacroBucketBuilder({
  products,
  vegOnly,
  onAdd,
  onClose,
  onSkip,
}: {
  products: Product[];
  vegOnly: boolean;
  onAdd: (id: number) => void;
  /** fallback / continue — keeps the healthy menu view behind */
  onClose: () => void;
  /** ✕ skip — lands the user on the clean home page */
  onSkip: () => void;
}) {
  const [step, setStep] = useState<Step>('target');
  const [metric, setMetric] = useState<Metric>('cal');
  const [target, setTarget] = useState(600);
  const [bucket, setBucket] = useState<Record<number, number>>({});
  const [added, setAdded] = useState(false);
  const [burst, setBurst] = useState(false);
  const [faceFailed, setFaceFailed] = useState(false);
  const wasOnTarget = useRef(false);

  // Usable items: macro data present, in stock, veg-respecting.
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
  const onTarget =
    current >= target * (1 - TOLERANCE) && current <= target * (1 + TOLERANCE);
  const over = current > target * (1 + TOLERANCE);
  const shownCurrent = useCountUp(current);

  // celebrate entering the target zone: confetti + vibration
  useEffect(() => {
    if (onTarget && !wasOnTarget.current) {
      setBurst(true);
      buzz([40, 60, 40]);
      const t = setTimeout(() => setBurst(false), 1400);
      return () => clearTimeout(t);
    }
    wasOnTarget.current = onTarget;
  }, [onTarget]);

  /* would adding this item land the total inside the target zone? */
  const isPerfectFit = (p: Product) => {
    const after = current + metricOf(p, metric);
    return after >= target * (1 - TOLERANCE) && after <= target * (1 + TOLERANCE);
  };

  // Suggestion order: perfect fits first (glowing), then by gap-closing;
  // picked items sink to the bottom with steppers.
  const list = useMemo(() => {
    const unpicked = candidates
      .filter((p) => !bucket[p.id])
      .sort((a, b) => {
        const pa = isPerfectFit(a) ? 0 : 1;
        const pb = isPerfectFit(b) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return (
          Math.abs(metricOf(a, metric) - remaining) -
          Math.abs(metricOf(b, metric) - remaining)
        );
      })
      .slice(0, 12);
    const picked = candidates.filter((p) => bucket[p.id]);
    return [...unpicked, ...picked];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, bucket, remaining, metric]);

  const addItem = (id: number) => {
    setAdded(false);
    buzz(20);
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
        if (!best || m > metricOf(best, metric)) best = p;
      }
      if (!best) break;
      b[best.id] = (b[best.id] || 0) + 1;
      total += metricOf(best, metric);
    }
    setAdded(false);
    buzz(20);
    setBucket(b);
  }

  function addBucketToCart() {
    for (const [idStr, qty] of Object.entries(bucket)) {
      const id = Number(idStr);
      for (let i = 0; i < qty; i++) onAdd(id);
    }
    buzz([30, 40, 30]);
    setAdded(true);
  }

  /* ── ring geometry ── */
  const R = 62;
  const CIRC = 2 * Math.PI * R;
  const dash = CIRC - (Math.min(pct, 100) / 100) * CIRC;
  const ringEmoji =
    totals.count === 0 ? '🍽️' : onTarget ? '🤩' : over ? '😅' : pct >= 50 ? '😋' : '🥗';

  /* ── fallback: not enough macro-tagged items ── */
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
        <button className="mb-x" onClick={onSkip} aria-label="Skip">✕</button>

        <div className="mb-head">
          <div className="mb-title">Aaj ka goal kya hai? 🎯</div>
          <div className="mb-sub">Target set karo — Bhaiya bucket bharne mein help karega</div>
        </div>

        <div className="mb-chips">
          {CHIPS.map((c, i) => (
            <button
              key={c.label}
              className="mb-chip"
              style={{ animationDelay: `${0.06 * i}s` }}
              onClick={() => {
                setMetric(c.metric);
                setTarget(c.target);
                setBucket({});
                setStep('build');
              }}
            >
              <span className="mb-chip-title">{c.label}</span>
              <span className="mb-chip-sub">{c.sub}</span>
              <span className="mb-chip-go">→</span>
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
              {target} {metric === 'cal' ? 'kcal' : 'g protein'}
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
      <button className="mb-x" onClick={onSkip} aria-label="Skip">✕</button>
      <button className="mb-back" onClick={() => setStep('target')}>← Goal</button>

      {burst && (
        <div className="mb-confetti" aria-hidden>
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className={`cf cf${i % 7}`} style={{ left: `${6 + i * 6.5}%` }} />
          ))}
        </div>
      )}

      {/* Bhaiya reacts live */}
      <div className="mb-bhaiya">
        <span className="mb-face">
          {faceFailed ? (
            <span className="mb-face-fb">🧑‍🍳</span>
          ) : (
            <img src={AVATAR_FACE} alt="Bhaiya" onError={() => setFaceFailed(true)} />
          )}
        </span>
        <div className="mb-bubble">{bhaiyaLine(pct, onTarget, over, totals.count)}</div>
      </div>

      {/* progress ring */}
      <div className="mb-ring-stage">
        <svg width="160" height="160" viewBox="0 0 160 160" className={onTarget ? 'ring-hit' : ''}>
          <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="11" />
          <circle
            cx="80" cy="80" r={R} fill="none"
            stroke={over ? C.orange : '#7ee787'}
            strokeWidth="11" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={dash}
            transform="rotate(-90 80 80)"
            style={{ transition: 'stroke-dashoffset .5s cubic-bezier(.2,.8,.3,1), stroke .3s' }}
          />
        </svg>
        <div className="mb-ring-center">
          <div className="mb-ring-emoji">{ringEmoji}</div>
          <div className="mb-ring-num">{shownCurrent}</div>
          <div className="mb-ring-sub">/ {target} {metricUnit(metric)}</div>
        </div>
      </div>

      <div className="mb-status">
        {totals.count === 0
          ? ' '
          : onTarget
            ? '🎯 Target zone mein ho!'
            : over
              ? `${current - target} ${metricUnit(metric)} zyada`
              : `${remaining} ${metricUnit(metric)} aur chahiye`}
      </div>

      <div className="mb-stats">
        <span>🔥 <b>{totals.cal}</b> kcal</span>
        <span>💪 <b>{totals.protein}g</b></span>
        <span>🧈 <b>{totals.fat}g</b></span>
        <span>💰 <b>{money(totals.price)}</b></span>
      </div>

      {totals.count === 0 && (
        <button className="mb-auto" onClick={autoBuild}>
          ✨ Bhaiya, bana do mere liye
        </button>
      )}

      <div className="mb-list">
        {list.map((p) => {
          const qty = bucket[p.id] || 0;
          const m = metricOf(p, metric);
          const perfect = qty === 0 && isPerfectFit(p);
          const tight = qty === 0 && !perfect && m > remaining + target * TOLERANCE;
          return (
            <div key={p.id} className={`mb-item ${qty ? 'picked' : ''} ${perfect ? 'perfect' : ''}`}>
              {perfect && <span className="mb-perfect-badge">✨ PERFECT FIT</span>}
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
  display:flex;flex-direction:column;padding:56px 18px 26px;
  animation:mbFadeIn .35s ease}
@media(min-width:520px){.mb-wrap{top:18px;bottom:18px;height:calc(100vh - 36px);border-radius:32px}}
.mb-x{position:absolute;top:16px;right:16px;background:rgba(255,255,255,.14);
  border:1px solid rgba(255,255,255,.18);color:#fff;font-size:14px;width:32px;height:32px;
  border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5}
.mb-back{position:absolute;top:18px;left:16px;background:transparent;border:none;color:#cfe6da;
  font-size:13px;font-weight:700;cursor:pointer;z-index:5}
.mb-head{text-align:center;margin-bottom:20px}
.mb-title{color:#fff;font-size:21px;font-weight:800}
.mb-sub{color:#cfe6da;font-size:12.5px;margin-top:5px}
.mb-chips{display:flex;flex-direction:column;gap:10px;margin-bottom:22px}
.mb-chip{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:2px;background:rgba(255,255,255,.97);
  border:none;border-radius:15px;padding:13px 44px 13px 16px;cursor:pointer;text-align:left;
  box-shadow:0 8px 24px rgba(0,0,0,.22);transition:transform .12s;
  animation:mbRowIn .4s ease both}
.mb-chip:active{transform:scale(.98)}
.mb-chip-title{font-size:14.5px;font-weight:800;color:${C.ink}}
.mb-chip-sub{font-size:11.5px;color:${C.muted}}
.mb-chip-go{position:absolute;right:15px;top:50%;transform:translateY(-50%);font-size:17px;font-weight:800;color:${C.green}}
.mb-custom{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:16px}
.mb-custom-label{color:#cfe6da;font-size:12px;font-weight:700;margin-bottom:11px}
.mb-seg{display:flex;gap:8px;margin-bottom:14px}
.mb-seg button{flex:1;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.18);color:#cfe6da;
  font-size:13px;font-weight:700;padding:10px;border-radius:11px;cursor:pointer}
.mb-seg button.on{background:#fff;color:${C.ink};border-color:#fff}
.mb-slider-row{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.mb-slider-row input[type=range]{flex:1;accent-color:${C.green}}
.mb-slider-val{color:#fff;font-size:14px;font-weight:800;min-width:104px;text-align:right}
.mb-cta{background:linear-gradient(135deg,${C.green},${C.greenDeep});color:#fff;border:none;
  font-size:14px;font-weight:800;padding:13px 24px;border-radius:13px;cursor:pointer;
  box-shadow:0 8px 22px rgba(76,175,80,.4)}
.mb-cta.big{width:100%;font-size:15px}
.mb-cta:disabled{opacity:.55;cursor:default}
.mb-bhaiya{display:flex;align-items:flex-start;gap:9px;margin-bottom:14px}
.mb-face{width:34px;height:34px;border-radius:50%;background:#fff;overflow:hidden;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.3);
  animation:mbBob 2.6s ease-in-out infinite}
.mb-face img{width:100%;height:100%;object-fit:cover}
.mb-face-fb{font-size:19px}
.mb-bubble{background:rgba(255,255,255,.97);border-radius:14px 14px 14px 4px;padding:9px 13px;
  font-size:12.5px;font-weight:700;color:${C.ink};box-shadow:0 6px 18px rgba(0,0,0,.22);
  animation:mbRowIn .3s ease}
.mb-ring-stage{position:relative;display:flex;justify-content:center;margin:2px 0 4px}
.mb-ring-stage svg.ring-hit{animation:ringPop .5s cubic-bezier(.2,.9,.3,1.4)}
.mb-ring-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center}
.mb-ring-emoji{font-size:23px;line-height:1}
.mb-ring-num{color:#fff;font-size:29px;font-weight:800;line-height:1.15}
.mb-ring-sub{color:#cfe6da;font-size:11px;font-weight:700}
.mb-status{text-align:center;color:#fff;font-size:12.5px;font-weight:800;min-height:18px;margin-bottom:8px}
.mb-stats{display:flex;justify-content:center;gap:13px;flex-wrap:wrap;margin-bottom:10px}
.mb-stats span{font-size:11px;color:#cfe6da}
.mb-stats b{color:#fff}
.mb-auto{width:100%;background:${C.orangeSoft};color:${C.orangeDeep};border:1.5px dashed ${C.orange};
  font-size:13px;font-weight:800;padding:12px;border-radius:12px;cursor:pointer;margin-bottom:6px;
  animation:autoPulse 2s ease-in-out infinite}
.mb-list{display:flex;flex-direction:column;gap:8px;flex:1;margin-top:8px}
.mb-item{position:relative;display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.97);border-radius:13px;
  padding:9px 11px;animation:mbRowIn .25s ease}
.mb-item.picked{outline:2px solid ${C.green}}
.mb-item.perfect{outline:2px solid ${C.orange};box-shadow:0 0 18px rgba(245,158,11,.55);animation:perfectGlow 1.6s ease-in-out infinite}
.mb-perfect-badge{position:absolute;top:-8px;right:10px;background:linear-gradient(90deg,${C.orange},#f7a73a);
  color:#fff;font-size:8.5px;font-weight:800;letter-spacing:.5px;padding:3px 8px;border-radius:7px;
  box-shadow:0 3px 10px rgba(245,158,11,.5)}
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
.mb-confetti{position:absolute;top:0;left:0;right:0;height:0;z-index:4;pointer-events:none}
.cf{position:absolute;top:-8px;width:8px;height:13px;border-radius:2px;animation:cfFall 1.3s ease-in forwards}
.cf0{background:#7ee787}.cf1{background:${C.orange}}.cf2{background:#fff}.cf3{background:#f7a73a}
.cf4{background:#a5d6a7}.cf5{background:#ffd54f}.cf6{background:#80cbc4}
@keyframes cfFall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(340px) rotate(520deg);opacity:0}}
@keyframes mbFadeIn{from{opacity:0}to{opacity:1}}
@keyframes mbRowIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes mbBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes ringPop{0%{transform:scale(1)}45%{transform:scale(1.07)}100%{transform:scale(1)}}
@keyframes perfectGlow{0%,100%{box-shadow:0 0 10px rgba(245,158,11,.35)}50%{box-shadow:0 0 22px rgba(245,158,11,.7)}}
@keyframes autoPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.015)}}
    `}</style>
  );
}
