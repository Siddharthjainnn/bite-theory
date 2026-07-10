'use client';

import { useState, useEffect } from 'react';
import { Category, C } from '../lib/bite';

export interface Goal {
  key: string;
  emoji: string;
  title: string;
  sub: string;
  accent: string;
  match: (c: Category) => boolean;
}

export const GOALS: Goal[] = [
  {
    key: 'healthy',
    emoji: '🥗',
    title: 'Healthy / High Protein',
    sub: 'Diet bowls, protein meals',
    accent: '#4CAF50',
    match: (c) => /health|protein|salad|bowl|diet/i.test(c.name),
  },
  {
    key: 'indian',
    emoji: '🍛',
    title: 'Indian Food',
    sub: 'Thali, rajma chawal, sabzi',
    accent: '#F59E0B',
    match: (c) => /thali|indian|combo|meal|rice|dal|sabzi/i.test(c.name),
  },
  {
    key: 'fast',
    emoji: '🍔',
    title: 'Fast Food',
    sub: 'Snacks, quick bites',
    accent: '#EF6C33',
    match: (c) => /fast|snack|burger|wrap|roll|quick/i.test(c.name),
  },
  {
    key: 'surprise',
    emoji: '✨',
    title: 'Surprise me!',
    sub: 'Aaj ka best dikha do',
    accent: '#9C27B0',
    match: () => false,
  },
];

export default function BiteAgentIntro({
  onDone,
}: {
  onDone: (g: Goal | null) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  function choose(goal: Goal) {
    setPicked(goal.key);
    setLeaving(true);
    setTimeout(() => onDone(goal), 460);
  }

  return (
    <div className={`intro-wrap ${leaving ? 'intro-leave' : ''} ${mounted ? 'in' : ''}`}>
      {/* soft ambient blobs */}
      <div className="intro-blobs" aria-hidden>
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
      </div>

      <div className="intro-inner">
        {/* top bar */}
        <div className="intro-brand">
          <span className="brandmark">B</span>
          <span className="intro-brand-name">Bites Theory</span>
          <button className="intro-skip" onClick={() => onDone(null)}>
            Skip <span aria-hidden>→</span>
          </button>
        </div>

        {/* mascot */}
        <div className="intro-avatar-stage">
          <div className="intro-ring" />
          <div className="intro-glow" />
          {avatarFailed ? (
            <div className="intro-avatar-fallback">🧑‍🍳</div>
          ) : (
            <img
              src="/bite-mascot.png"
              alt="Your Bite Agent"
              className="intro-avatar"
              onError={() => setAvatarFailed(true)}
            />
          )}
          <span className="intro-badge">
            <span className="intro-badge-dot" /> YOUR BITE AGENT
          </span>
        </div>

        {/* greeting */}
        <div className="intro-bubble">
          <div className="intro-bubble-title">
            Namaste! Main hoon aapka Bite Agent <span className="wave">👋</span>
          </div>
          <div className="intro-bubble-sub">
            Aaj kya khaane ka mann hai? Bataiye — main aapke liye perfect meal
            dhoond deta hoon.
          </div>
        </div>

        {/* goals */}
        <div className="intro-goals">
          {GOALS.map((g, i) => (
            <button
              key={g.key}
              className={`intro-goal ${picked === g.key ? 'sel' : ''}`}
              style={{
                // stagger the entrance
                transitionDelay: `${0.15 + i * 0.07}s`,
                ['--accent' as any]: g.accent,
              }}
              onClick={() => choose(g)}
            >
              <span className="ig-emoji" style={{ background: `${g.accent}1f` }}>
                {g.emoji}
              </span>
              <span className="ig-text">
                <span className="ig-title">{g.title}</span>
                <span className="ig-sub">{g.sub}</span>
              </span>
              <span className="ig-arrow">{picked === g.key ? '✓' : '›'}</span>
            </button>
          ))}
        </div>

        <div className="intro-foot">Smart Food. Better Living.</div>
      </div>

      <style>{`
.intro-wrap{position:fixed;top:0;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:480px;z-index:100;
  background:
    radial-gradient(120% 80% at 50% -10%, #1f6e51 0%, transparent 60%),
    linear-gradient(168deg, ${C.dark} 0%, #0f4633 58%, #135a41 100%);
  display:flex;justify-content:center;overflow:hidden;
  opacity:0;transition:opacity .45s ease}
.intro-wrap.in{opacity:1}
@media(min-width:520px){.intro-wrap{top:18px;bottom:18px;height:calc(100vh - 36px);border-radius:32px}}
.intro-leave{opacity:0 !important;transition:opacity .46s ease}

.intro-blobs{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.blob{position:absolute;border-radius:50%;filter:blur(46px);opacity:.5}
.blob.b1{width:230px;height:230px;background:rgba(76,175,80,.42);top:-40px;right:-50px;animation:drift 12s ease-in-out infinite}
.blob.b2{width:200px;height:200px;background:rgba(245,158,11,.28);bottom:8%;left:-60px;animation:drift 14s ease-in-out infinite reverse}
.blob.b3{width:160px;height:160px;background:rgba(76,175,80,.25);top:38%;right:-40px;animation:drift 10s ease-in-out infinite}

.intro-inner{position:relative;width:100%;max-width:430px;padding:22px 22px 20px;
  display:flex;flex-direction:column;min-height:100%;overflow-y:auto}

.intro-brand{display:flex;align-items:center;gap:9px;color:#fff;font-weight:800;font-size:15px}
.intro-brand .brandmark{width:30px;height:30px;display:flex;align-items:center;justify-content:center;
  font-size:16px;font-weight:800;color:#fff;border-radius:9px;
  background:linear-gradient(135deg,${C.green},${C.orange})}
.intro-brand-name{letter-spacing:.2px}
.intro-skip{margin-left:auto;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.16);
  color:#cfe6da;font-size:12px;font-weight:600;cursor:pointer;padding:6px 12px;border-radius:20px;
  transition:background .15s}
.intro-skip:active{background:rgba(255,255,255,.22)}

.intro-avatar-stage{position:relative;height:216px;display:flex;align-items:flex-end;justify-content:center;margin-top:10px}
.intro-ring{position:absolute;top:2%;left:50%;transform:translateX(-50%);width:210px;height:210px;border-radius:50%;
  border:1.5px dashed rgba(255,255,255,.14);animation:spin 26s linear infinite}
.intro-glow{position:absolute;top:8%;left:50%;transform:translateX(-50%);width:220px;height:220px;border-radius:50%;
  background:radial-gradient(circle,rgba(76,175,80,.5),transparent 66%)}
.intro-avatar{position:relative;max-height:220px;width:auto;object-fit:contain;
  filter:drop-shadow(0 16px 26px rgba(0,0,0,.4));animation:bob 3.4s ease-in-out infinite;
  transform:translateY(14px) scale(.9);opacity:0;transition:transform .6s cubic-bezier(.2,.8,.2,1),opacity .6s}
.intro-wrap.in .intro-avatar{transform:translateY(0) scale(1);opacity:1}
.intro-avatar-fallback{display:flex;align-items:flex-end;justify-content:center;font-size:150px;line-height:1;
  position:relative;animation:bob 3.4s ease-in-out infinite}
.intro-badge{position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:7px;
  background:rgba(255,255,255,.96);color:${C.dark};font-size:10.5px;font-weight:800;letter-spacing:.5px;
  padding:6px 15px;border-radius:22px;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.25)}
.intro-badge-dot{width:7px;height:7px;border-radius:50%;background:${C.green};animation:blink 1.6s ease-in-out infinite}

.intro-bubble{position:relative;background:rgba(255,255,255,.98);border-radius:20px 20px 20px 6px;padding:15px 17px;
  margin:26px 0 16px;box-shadow:0 10px 30px rgba(0,0,0,.22);
  transform:translateY(12px);opacity:0;transition:transform .5s ease .1s,opacity .5s ease .1s}
.intro-wrap.in .intro-bubble{transform:translateY(0);opacity:1}
.intro-bubble-title{font-size:16.5px;font-weight:800;color:${C.ink};line-height:1.32}
.intro-bubble-sub{font-size:13px;color:#3a5a4d;margin-top:6px;line-height:1.45}
.wave{display:inline-block;animation:wave 1.4s ease-in-out infinite;transform-origin:70% 70%}

.intro-goals{display:flex;flex-direction:column;gap:10px;margin-top:auto}
.intro-goal{display:flex;align-items:center;gap:13px;background:rgba(255,255,255,.98);
  border:1.5px solid rgba(255,255,255,0);border-radius:16px;padding:13px 15px;cursor:pointer;text-align:left;
  box-shadow:0 4px 16px rgba(0,0,0,.14);
  transform:translateY(14px);opacity:0;
  transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .45s,border-color .15s,box-shadow .15s}
.intro-wrap.in .intro-goal{transform:translateY(0);opacity:1}
.intro-goal:active{transform:scale(.98)}
.intro-goal.sel{border-color:var(--accent);box-shadow:0 6px 22px color-mix(in srgb,var(--accent) 30%,transparent)}
.ig-emoji{width:44px;height:44px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
  font-size:23px;border-radius:13px}
.ig-text{flex:1;display:flex;flex-direction:column;min-width:0}
.ig-title{font-size:14.5px;font-weight:800;color:${C.ink}}
.ig-sub{font-size:11.5px;color:${C.muted};margin-top:1px}
.ig-arrow{color:var(--accent);font-size:20px;font-weight:800;width:22px;text-align:center}

.intro-foot{text-align:center;color:rgba(255,255,255,.5);font-size:11px;font-weight:600;
  letter-spacing:1.5px;text-transform:uppercase;margin-top:16px}

@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes wave{0%,60%,100%{transform:rotate(0)}30%{transform:rotate(18deg)}}
@keyframes spin{to{transform:translateX(-50%) rotate(360deg)}}
@keyframes drift{0%,100%{transform:translate(0,0)}50%{transform:translate(14px,-16px)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
      `}</style>
    </div>
  );
}
