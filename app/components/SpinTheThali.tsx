'use client';

/**
 * SpinTheThali — "Surprise me!" upgrade.
 * Full-screen wheel of 8 real in-stock dishes. Spin lands on one, then a
 * product card pops with a Bhaiya line + Add to cart. Frontend only.
 *
 * Fairness: we pick a random target angle FIRST, then derive the winning
 * segment from where the pointer lands — the spin is never faked.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Product,
  C,
  money,
  catEmoji,
  effectivePrice,
  hasOffer,
  offerPct,
} from '../lib/bite';
import FoodImage from './FoodImage';

const WHEEL_COLORS = [
  '#4CAF50', '#F59E0B', '#2e7d32', '#EF6C33',
  '#66BB6A', '#F7A73A', '#3B8C3F', '#FB8C4E',
];

const WIN_LINES = [
  'Aaj ye khao! Ekdum mast rahega 😋',
  'Kismat ne bola — yahi hai aaj ka meal! ✨',
  'Wheel jhooth nahi bolta bhaiya 😄',
  'Perfect pick! Bhaiya ki guarantee 💯',
];

const MAX_RESPINS = 3;
const SS_KEY = 'bt_spin_count';

/* Fisher–Yates shuffle + pick up to 8 in-stock, veg-respecting items,
   image-first. Runs once in a lazy state initializer (repo idiom). */
function buildPool(products: Product[], vegOnly: boolean): Product[] {
  const ok = products.filter(
    (p) => p.stockStatus !== 'out_of_stock' && (!vegOnly || p.isVeg),
  );
  const shuffle = <T,>(a: T[]) => {
    const arr = [...a];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  const withImg = ok.filter((p) => p.image);
  const noImg = ok.filter((p) => !p.image);
  return [...shuffle(withImg), ...shuffle(noImg)].slice(0, 8);
}

function loadSpinsUsed(): number {
  try {
    return Number(sessionStorage.getItem(SS_KEY) || 0);
  } catch {
    return 0;
  }
}

export default function SpinTheThali({
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
  const router = useRouter();

  // Segment pool: seeded once on mount (overlay opens only after catalog load).
  const [pool] = useState<Product[]>(() => buildPool(products, vegOnly));

  const n = pool.length;
  const seg = 360 / Math.max(n, 1);

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Product | null>(null);
  const [added, setAdded] = useState(false);
  const [lineIdx] = useState(() => Math.floor(Math.random() * WIN_LINES.length));
  const [spinsUsed, setSpinsUsed] = useState<number>(loadSpinsUsed);
  const spinsLeft = MAX_RESPINS - spinsUsed;

  function spin() {
    if (spinning || n < 4 || spinsLeft <= 0) return;
    setWinner(null);
    setAdded(false);
    setSpinning(true);

    // random target angle first — winner derived from it, never pre-picked
    const extra = Math.random() * 360;
    const target = rotation + 1800 + extra; // 5 full turns + random
    setRotation(target);

    const used = spinsUsed + 1;
    setSpinsUsed(used);
    try { sessionStorage.setItem(SS_KEY, String(used)); } catch {}

    setTimeout(() => {
      // pointer sits at top (270° in standard coords → we use "12 o'clock").
      // wheel rotated by `target`, so the segment under the pointer:
      const norm = ((360 - (target % 360)) + 360) % 360;
      const idx = Math.floor(norm / seg) % n;
      setWinner(pool[idx]);
      setSpinning(false);
    }, 4200);
  }

  // conic-gradient stops for the wheel face
  const gradient = useMemo(() => {
    const stops = pool
      .map((_, i) => {
        const c = WHEEL_COLORS[i % WHEEL_COLORS.length];
        return `${c} ${i * seg}deg ${(i + 1) * seg}deg`;
      })
      .join(', ');
    return `conic-gradient(${stops})`;
  }, [pool, seg]);

  // Too few items → graceful fallback (Rule 6: never spin sold-out air)
  if (n < 4) {
    return (
      <div className="spin-wrap" role="dialog" aria-label="Surprise me">
        <div className="spin-card">
          <div className="spin-fb-emoji">🥲</div>
          <div className="spin-fb-title">Abhi wheel ke liye items kam hain</div>
          <div className="spin-fb-sub">Menu se hi kuch pasand kar lo — sab fresh hai!</div>
          <button className="spin-cta" onClick={onClose}>Menu dekho →</button>
        </div>
        <SpinStyles />
      </div>
    );
  }

  return (
    <div className="spin-wrap" role="dialog" aria-label="Spin the thali">
      <button className="spin-x" onClick={onClose} aria-label="Close">✕</button>

      <div className="spin-head">
        <div className="spin-title">Spin the Thali 🎡</div>
        <div className="spin-sub">Kismat pe chhod do — Bhaiya ghuma raha hai!</div>
      </div>

      <div className="spin-stage">
        <div className="spin-pointer">▼</div>
        <div
          className="spin-wheel"
          style={{
            background: gradient,
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? 'transform 4.2s cubic-bezier(.15,.85,.25,1)'
              : 'none',
          }}
        >
          {pool.map((p, i) => {
            const mid = i * seg + seg / 2;
            return (
              <div
                key={p.id}
                className="spin-label"
                style={{ transform: `rotate(${mid}deg) translateY(-118px)` }}
              >
                <span style={{ transform: `rotate(0deg)` }}>
                  {catEmoji(p.name)}
                </span>
              </div>
            );
          })}
          <div className="spin-hub">🍛</div>
        </div>
      </div>

      {!winner && (
        <button
          className="spin-cta big"
          onClick={spin}
          disabled={spinning || spinsLeft <= 0}
        >
          {spinning
            ? 'Ghum raha hai… 🌀'
            : spinsLeft <= 0
              ? 'Spins khatam aaj ke 😅'
              : 'SPIN KARO! 🎰'}
        </button>
      )}
      {!winner && spinsLeft <= 0 && !spinning && (
        <button className="spin-see" onClick={onClose}>Menu se choose karo →</button>
      )}

      {winner && (
        <div className="spin-result">
          <div className="spin-burst" aria-hidden>🎉</div>
          <div className="spin-line">{WIN_LINES[lineIdx]}</div>

          <div
            className="spin-prod"
            onClick={() => router.push(`/product/${winner.id}`)}
          >
            <div className="spin-prod-img">
              <FoodImage
                src={winner.image}
                alt={winner.name}
                emoji={catEmoji(winner.name)}
              />
            </div>
            <div className="spin-prod-info">
              <div className="spin-prod-name">{winner.name}</div>
              <div className="spin-prod-tags">
                {winner.calories > 0 && (
                  <span className="tag">{winner.calories} cal</span>
                )}
                {winner.protein > 0 && (
                  <span className="tag green">{winner.protein}g protein</span>
                )}
              </div>
              <div className="spin-prod-price">
                <b>{money(effectivePrice(winner))}</b>
                {hasOffer(winner) && <s>{money(winner.price)}</s>}
                {hasOffer(winner) && (
                  <span className="spin-off">{offerPct(winner)}% OFF</span>
                )}
              </div>
            </div>
          </div>

          <div className="spin-actions">
            <button
              className="spin-cta"
              onClick={() => {
                onAdd(winner.id);
                setAdded(true);
              }}
            >
              {added ? 'Cart mein aa gaya ✓' : 'Add to cart 🛒'}
            </button>
            <button
              className="spin-again"
              onClick={spin}
              disabled={spinning || spinsLeft <= 0}
            >
              {spinsLeft > 0 ? `Spin phir se 🔁 (${spinsLeft})` : 'Bas ho gaya 😄'}
            </button>
          </div>
          {added && (
            <button className="spin-see" onClick={onClose}>
              Shopping continue karo →
            </button>
          )}
        </div>
      )}

      <SpinStyles />
    </div>
  );
}

function SpinStyles() {
  return (
    <style>{`
.spin-wrap{position:fixed;top:0;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:480px;z-index:110;overflow-y:auto;
  background:
    radial-gradient(120% 80% at 50% -10%, #1f6e51 0%, transparent 60%),
    linear-gradient(168deg, ${C.dark} 0%, #0f4633 58%, #135a41 100%);
  display:flex;flex-direction:column;align-items:center;padding:22px 20px 30px;
  animation:spinFadeIn .35s ease}
@media(min-width:520px){.spin-wrap{top:18px;bottom:18px;height:calc(100vh - 36px);border-radius:32px}}
.spin-x{position:absolute;top:16px;right:16px;background:rgba(255,255,255,.14);
  border:1px solid rgba(255,255,255,.18);color:#fff;font-size:14px;width:32px;height:32px;
  border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2}
.spin-head{text-align:center;margin-top:14px}
.spin-title{color:#fff;font-size:22px;font-weight:800;letter-spacing:.3px}
.spin-sub{color:#cfe6da;font-size:12.5px;margin-top:4px}
.spin-stage{position:relative;margin:26px 0 8px;display:flex;justify-content:center}
.spin-pointer{position:absolute;top:-14px;left:50%;transform:translateX(-50%);
  color:${C.orange};font-size:26px;z-index:3;filter:drop-shadow(0 3px 4px rgba(0,0,0,.35));
  animation:ptrBob 1.4s ease-in-out infinite}
.spin-wheel{position:relative;width:280px;height:280px;border-radius:50%;
  border:7px solid #fff;box-shadow:0 16px 45px rgba(0,0,0,.4), inset 0 0 30px rgba(0,0,0,.18)}
.spin-label{position:absolute;top:50%;left:50%;width:34px;height:34px;margin:-17px 0 0 -17px;
  display:flex;align-items:center;justify-content:center;font-size:22px;
  transform-origin:center center;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))}
.spin-hub{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:56px;height:56px;border-radius:50%;background:#fff;display:flex;align-items:center;
  justify-content:center;font-size:26px;box-shadow:0 4px 14px rgba(0,0,0,.3);z-index:2}
.spin-cta{background:linear-gradient(135deg,${C.green},${C.greenDeep});color:#fff;border:none;
  font-size:15px;font-weight:800;padding:14px 30px;border-radius:14px;cursor:pointer;
  box-shadow:0 8px 22px rgba(76,175,80,.4);letter-spacing:.4px}
.spin-cta.big{margin-top:22px;font-size:16px;padding:15px 40px;animation:ctaPulse 1.8s ease-in-out infinite}
.spin-cta:disabled{opacity:.55;cursor:default;animation:none}
.spin-see{margin-top:12px;background:transparent;border:none;color:#cfe6da;font-size:13px;
  font-weight:600;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.spin-result{width:100%;max-width:360px;margin-top:18px;text-align:center;animation:resultPop .5s cubic-bezier(.2,.9,.3,1.2)}
.spin-burst{font-size:34px;animation:burstBounce .6s ease}
.spin-line{color:#fff;font-size:14.5px;font-weight:700;margin:6px 0 12px}
.spin-prod{display:flex;gap:12px;background:#fff;border-radius:16px;padding:11px;align-items:center;
  cursor:pointer;box-shadow:0 12px 34px rgba(0,0,0,.3);text-align:left}
.spin-prod-img{width:62px;height:62px;border-radius:13px;background:${C.orangeSoft};display:flex;
  align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}
.spin-prod-img img{width:100%;height:100%;object-fit:cover}
.spin-prod-img .food-emoji{font-size:30px}
.spin-prod-info{flex:1;min-width:0}
.spin-prod-name{font-size:14px;font-weight:800;color:${C.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spin-prod-tags{display:flex;gap:4px;margin:4px 0;flex-wrap:wrap}
.spin-prod-tags .tag{font-size:9.5px;background:${C.bg};color:#3a5a4d;padding:2px 7px;border-radius:6px;font-weight:700}
.spin-prod-tags .tag.green{background:${C.greenSoft};color:${C.greenDeep}}
.spin-prod-price{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.spin-prod-price b{font-size:16px;font-weight:800;color:${C.ink}}
.spin-prod-price s{font-size:11px;color:#9aa8a0}
.spin-off{font-size:9px;background:${C.orangeSoft};color:${C.orangeDeep};padding:2px 6px;border-radius:5px;font-weight:800}
.spin-actions{display:flex;gap:9px;margin-top:14px}
.spin-actions .spin-cta{flex:1;padding:13px 10px;font-size:13.5px}
.spin-again{background:rgba(255,255,255,.14);border:1.5px solid rgba(255,255,255,.25);color:#fff;
  font-size:13px;font-weight:700;padding:13px 14px;border-radius:14px;cursor:pointer}
.spin-again:disabled{opacity:.5;cursor:default}
.spin-card{background:#fff;border-radius:20px;padding:28px 24px;margin:auto;text-align:center;max-width:320px;
  box-shadow:0 18px 50px rgba(0,0,0,.35)}
.spin-fb-emoji{font-size:44px}
.spin-fb-title{font-size:15.5px;font-weight:800;color:${C.ink};margin-top:10px}
.spin-fb-sub{font-size:12.5px;color:${C.muted};margin:6px 0 16px}
@keyframes spinFadeIn{from{opacity:0}to{opacity:1}}
@keyframes ptrBob{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(4px)}}
@keyframes ctaPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
@keyframes resultPop{0%{transform:translateY(26px) scale(.95);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
@keyframes burstBounce{0%{transform:scale(.4)}60%{transform:scale(1.3)}100%{transform:scale(1)}}
    `}</style>
  );
}
