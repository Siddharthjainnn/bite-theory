'use client';

/**
 * IndianFoodChooser — "Indian Food" goal branching (Feature 1.3).
 *
 * Step 1: "Combo ya Thali?" — two big cards.
 * Step 2 (Thali): "Regular Thali" or "Customize Thali".
 * Customize Thali is a teaser until the Thali Builder module (Feature 1.4)
 * ships — tapping it shows a "jald aa raha hai" note and offers Regular.
 *
 * Category mapping is defensive: Combo prefers a /combo/i category and
 * Regular Thali prefers /thali/i; if that category doesn't exist, we fall
 * back to the general indian matcher, then 'all' — never a dead end.
 */

import { useState } from 'react';
import { Category, C } from '../lib/bite';

type Pick2 = 'combo' | 'thali_regular';

const INDIAN_FALLBACK = /thali|indian|combo|meal|rice|dal|sabzi/i;

function findCat(categories: Category[], primary: RegExp): number | null {
  const hit =
    categories.find((c) => primary.test(c.name)) ||
    categories.find((c) => INDIAN_FALLBACK.test(c.name));
  return hit ? hit.id : null;
}

export default function IndianFoodChooser({
  categories,
  onSelectCategory,
  onCustomize,
  onSkip,
}: {
  categories: Category[];
  /** land on this category id in the menu ('all' = unfiltered) */
  onSelectCategory: (catId: number | 'all') => void;
  /** open the Customize Thali builder */
  onCustomize: () => void;
  /** ✕ — back to clean home */
  onSkip: () => void;
}) {
  const [step, setStep] = useState<'main' | 'thali'>('main');

  function pick(kind: Pick2) {
    const catId =
      kind === 'combo'
        ? findCat(categories, /combo/i)
        : findCat(categories, /thali/i);
    onSelectCategory(catId ?? 'all');
  }

  return (
    <div className="ifc-wrap" role="dialog" aria-label="Indian food chooser">
      <button className="ifc-x" onClick={onSkip} aria-label="Skip">✕</button>
      {step === 'thali' && (
        <button className="ifc-back" onClick={() => setStep('main')}>
          ← Wapas
        </button>
      )}

      {step === 'main' ? (
        <>
          <div className="ifc-head">
            <div className="ifc-title">Ghar jaisa khaana 🍛</div>
            <div className="ifc-sub">Bataiye — combo chahiye ya poori thali?</div>
          </div>

          <div className="ifc-cards">
            <button className="ifc-card" onClick={() => pick('combo')}>
              <span className="ifc-emoji">🍱</span>
              <span className="ifc-card-title">Combo</span>
              <span className="ifc-card-sub">Ready-made value meals — jaldi aur sasta</span>
              <span className="ifc-go">→</span>
            </button>

            <button className="ifc-card" onClick={() => setStep('thali')}>
              <span className="ifc-emoji">🍽️</span>
              <span className="ifc-card-title">Thali</span>
              <span className="ifc-card-sub">Poora bhojan — dal, sabzi, roti, sab kuch</span>
              <span className="ifc-go">→</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="ifc-head">
            <div className="ifc-title">Kaunsi thali? 🍽️</div>
            <div className="ifc-sub">Bani-banayi lo ya apni banao</div>
          </div>

          <div className="ifc-cards">
            <button className="ifc-card" onClick={() => pick('thali_regular')}>
              <span className="ifc-emoji">🍽️</span>
              <span className="ifc-card-title">Regular Thali</span>
              <span className="ifc-card-sub">Aaj ki set thali — bas order karo</span>
              <span className="ifc-go">→</span>
            </button>

            <button className="ifc-card" onClick={onCustomize}>
              <span className="ifc-emoji">🎨</span>
              <span className="ifc-card-title">
                Customize Thali <span className="ifc-soon-badge">NAYA</span>
              </span>
              <span className="ifc-card-sub">Har item khud choose karo — sabzi se sweet tak</span>
              <span className="ifc-go">→</span>
            </button>
          </div>
        </>
      )}

      <style>{`
.ifc-wrap{position:fixed;top:0;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:480px;z-index:110;overflow-y:auto;
  background:
    radial-gradient(120% 80% at 50% -10%, #1f6e51 0%, transparent 60%),
    linear-gradient(168deg, ${C.dark} 0%, #0f4633 58%, #135a41 100%);
  display:flex;flex-direction:column;justify-content:center;padding:60px 20px 40px;
  animation:ifcFadeIn .35s ease}
@media(min-width:520px){.ifc-wrap{top:18px;bottom:18px;height:calc(100vh - 36px);border-radius:32px}}
.ifc-x{position:absolute;top:16px;right:16px;background:rgba(255,255,255,.14);
  border:1px solid rgba(255,255,255,.18);color:#fff;font-size:14px;width:32px;height:32px;
  border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2}
.ifc-back{position:absolute;top:18px;left:16px;background:transparent;border:none;color:#cfe6da;
  font-size:13px;font-weight:700;cursor:pointer;z-index:2}
.ifc-head{text-align:center;margin-bottom:24px}
.ifc-title{color:#fff;font-size:22px;font-weight:800}
.ifc-sub{color:#cfe6da;font-size:13px;margin-top:6px}
.ifc-cards{display:flex;flex-direction:column;gap:13px}
.ifc-card{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:3px;
  background:rgba(255,255,255,.97);border:none;border-radius:18px;padding:17px 48px 17px 18px;
  cursor:pointer;text-align:left;box-shadow:0 10px 28px rgba(0,0,0,.25);
  transition:transform .12s;animation:ifcRowIn .4s ease both}
.ifc-card:nth-child(2){animation-delay:.07s}
.ifc-card:active{transform:scale(.98)}
.ifc-emoji{font-size:30px;line-height:1;margin-bottom:4px}
.ifc-card-title{font-size:16px;font-weight:800;color:${C.ink};display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.ifc-card-sub{font-size:12px;color:${C.muted};line-height:1.45}
.ifc-go{position:absolute;right:17px;top:50%;transform:translateY(-50%);font-size:19px;font-weight:800;color:${C.green}}
.ifc-card.soon{background:rgba(255,255,255,.82)}
.ifc-card.teased{outline:2px solid ${C.orange}}
.ifc-soon-badge{font-size:8.5px;font-weight:800;letter-spacing:.5px;color:#fff;
  background:linear-gradient(90deg,${C.orange},#f7a73a);padding:3px 8px;border-radius:7px}
@keyframes ifcFadeIn{from{opacity:0}to{opacity:1}}
@keyframes ifcRowIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  );
}
