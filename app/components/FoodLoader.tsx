'use client';

import { useEffect, useState } from 'react';

/**
 * Bite Theory's signature food loader 🍲
 *
 * - `full`   → full-screen takeover (route transitions / page loads)
 * - default  → inline block (sections, panels)
 * - `size="sm"` → tiny inline spinner for buttons
 *
 * A wok "cooks" a rotating cast of food emoji with rising steam and
 * playful captions that swap every 1.6s, so waiting feels like the
 * kitchen is actually doing something.
 */

const FOODS = ['🍕', '🍔', '🍜', '🍛', '🥘', '🌮', '🍱', '🥟', '🍩', '🍟'];
const CAPTIONS = [
  'Tempering the spices…',
  'Tossing it in the wok…',
  'Bhaiya is tasting it… 😋',
  'Extra masala loading…',
  'Plating it up nicely…',
  'Almost out of the kitchen…',
];

export default function FoodLoader({
  full = false,
  size = 'md',
  caption,
}: {
  full?: boolean;
  size?: 'sm' | 'md';
  caption?: string;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => n + 1), 1600);
    return () => clearInterval(t);
  }, []);

  const food = FOODS[i % FOODS.length];
  const line = caption || CAPTIONS[i % CAPTIONS.length];

  if (size === 'sm') {
    return (
      <span className="fl-inline" role="status" aria-label="Loading">
        <span className="fl-inline-food">{food}</span>
        <style jsx>{`
          .fl-inline { display: inline-flex; align-items: center; }
          .fl-inline-food {
            font-size: 18px; line-height: 1;
            animation: flSpinBounce 0.9s ease-in-out infinite;
            display: inline-block;
          }
          @keyframes flSpinBounce {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-5px) rotate(20deg); }
          }
        `}</style>
      </span>
    );
  }

  return (
    <div className={`fl-wrap ${full ? 'fl-full' : ''}`} role="status" aria-live="polite">
      <div className="fl-stage">
        {/* steam */}
        <span className="fl-steam s1">~</span>
        <span className="fl-steam s2">~</span>
        <span className="fl-steam s3">~</span>
        {/* bouncing food */}
        <span className="fl-food" key={food}>{food}</span>
        {/* wok/pan */}
        <span className="fl-pan">🍳</span>
        {/* shadow */}
        <span className="fl-shadow" />
      </div>
      <div className="fl-caption" key={line}>{line}</div>
      <div className="fl-dots"><i /><i /><i /></div>

      <style jsx>{`
        .fl-wrap {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 6px; padding: 28px 16px;
        }
        .fl-full {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(244, 246, 243, 0.96);
          backdrop-filter: blur(4px);
          min-height: 100dvh;
        }
        .fl-stage { position: relative; width: 90px; height: 96px; }
        .fl-food {
          position: absolute; left: 50%; top: 8px; font-size: 40px;
          transform: translateX(-50%);
          animation: flBounce 1.1s ease-in-out infinite, flPop 0.35s ease;
          display: inline-block; z-index: 2;
        }
        .fl-pan {
          position: absolute; left: 50%; bottom: 4px; font-size: 44px;
          transform: translateX(-50%);
          animation: flPanShake 1.1s ease-in-out infinite;
          display: inline-block; z-index: 1;
        }
        .fl-shadow {
          position: absolute; left: 50%; bottom: 0; width: 52px; height: 8px;
          transform: translateX(-50%);
          background: rgba(13, 59, 46, 0.15); border-radius: 50%;
          animation: flShadow 1.1s ease-in-out infinite;
        }
        .fl-steam {
          position: absolute; left: 50%; color: #9dbcae; font-size: 16px;
          font-weight: 700; opacity: 0;
          animation: flSteam 2.2s ease-out infinite;
        }
        .fl-steam.s1 { margin-left: -18px; animation-delay: 0s; }
        .fl-steam.s2 { margin-left: 0px;  animation-delay: 0.7s; }
        .fl-steam.s3 { margin-left: 16px; animation-delay: 1.4s; }
        .fl-caption {
          font-size: 14px; font-weight: 700; color: #0d3b2e;
          animation: flFadeUp 0.4s ease;
        }
        .fl-dots { display: flex; gap: 5px; }
        .fl-dots i {
          width: 6px; height: 6px; border-radius: 50%;
          background: #f59e0b; display: inline-block;
          animation: flDot 1.2s ease-in-out infinite;
        }
        .fl-dots i:nth-child(2) { animation-delay: 0.2s; background: #4caf50; }
        .fl-dots i:nth-child(3) { animation-delay: 0.4s; background: #f59e0b; }

        @keyframes flBounce {
          0%, 100% { transform: translateX(-50%) translateY(0) rotate(-6deg); }
          50% { transform: translateX(-50%) translateY(-22px) rotate(10deg); }
        }
        @keyframes flPanShake {
          0%, 100% { transform: translateX(-50%) rotate(0deg); }
          25% { transform: translateX(-52%) rotate(-3deg); }
          75% { transform: translateX(-48%) rotate(3deg); }
        }
        @keyframes flShadow {
          0%, 100% { transform: translateX(-50%) scaleX(1); opacity: 0.6; }
          50% { transform: translateX(-50%) scaleX(0.65); opacity: 0.3; }
        }
        @keyframes flSteam {
          0% { bottom: 60px; opacity: 0; transform: rotate(90deg) scale(0.7); }
          30% { opacity: 0.9; }
          100% { bottom: 96px; opacity: 0; transform: rotate(90deg) scale(1.2); }
        }
        @keyframes flPop {
          0% { transform: translateX(-50%) scale(0.4); }
          100% { transform: translateX(-50%) scale(1); }
        }
        @keyframes flFadeUp {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes flDot {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
