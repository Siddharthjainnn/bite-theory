'use client';

import { useState } from 'react';
import { Category, AVATAR_FULL, C } from '../lib/bite';

export interface Goal {
  key: string;
  emoji: string;
  title: string;
  sub: string;
  match: (c: Category) => boolean;
}

export const GOALS: Goal[] = [
  {
    key: 'healthy',
    emoji: '🥗',
    title: 'Healthy / High Protein',
    sub: 'Diet bowls, protein meals',
    match: (c) => /health|protein|salad|bowl|diet/i.test(c.name),
  },
  {
    key: 'indian',
    emoji: '🍛',
    title: 'Indian Food',
    sub: 'Thali, rajma chawal, sabzi',
    match: (c) => /thali|indian|combo|meal|rice|dal|sabzi/i.test(c.name),
  },
  {
    key: 'fast',
    emoji: '🍔',
    title: 'Fast Food',
    sub: 'Snacks, quick bites',
    match: (c) => /fast|snack|burger|wrap|roll|quick/i.test(c.name),
  },
  {
    key: 'surprise',
    emoji: '😋',
    title: 'Surprise me!',
    sub: 'Aaj ka best dikha do',
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

  function choose(goal: Goal) {
    setPicked(goal.key);
    setLeaving(true);
    setTimeout(() => onDone(goal), 420);
  }

  return (
    <div className={`intro-wrap ${leaving ? 'intro-leave' : ''}`}>
      <div className="intro-amb" aria-hidden>
        {['🍛', '🥗', '🫓', '🧃', '🍮'].map((e, i) => (
          <span key={i} className={`amb a${i}`}>
            {e}
          </span>
        ))}
      </div>

      <div className="intro-inner">
        <div className="intro-brand">
          <span className="brandmark">B</span>
          <span>Bites Theory</span>
          <button className="intro-skip" onClick={() => onDone(null)}>
            Skip →
          </button>
        </div>

        <div className="intro-avatar-stage">
          <div className="intro-glow" />
          {avatarFailed ? (
            <div className="intro-avatar-fallback">🧑‍🍳</div>
          ) : (
            <img
              src={AVATAR_FULL}
              alt="Theory Bhaiya"
              className="intro-avatar"
              onError={() => setAvatarFailed(true)}
            />
          )}
          <span className="intro-wave">👋</span>
          <span className="intro-badge">YOUR BITE AGENT 🧪</span>
        </div>

        <div className="intro-bubble">
          <div className="intro-bubble-title">
            Hello! Main hoon aapka Bite Agent 😄
          </div>
          <div className="intro-bubble-sub">
            Bhaiyaaa, aaj kya khaane ka mann hai? Bata do, main perfect cheez
            dikha deta hoon!
          </div>
        </div>

        <div className="intro-goals">
          {GOALS.map((g) => (
            <button
              key={g.key}
              className={`intro-goal ${picked === g.key ? 'sel' : ''}`}
              onClick={() => choose(g)}
            >
              <span className="ig-emoji">{g.emoji}</span>
              <span className="ig-text">
                <span className="ig-title">{g.title}</span>
                <span className="ig-sub">{g.sub}</span>
              </span>
              <span className="ig-arrow">{picked === g.key ? '✓' : '›'}</span>
            </button>
          ))}
        </div>
      </div>

      <style>{`
.intro-wrap{position:fixed;top:0;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:480px;z-index:100;
  background:linear-gradient(165deg,${C.dark} 0%,${C.darkSoft} 55%,#1a6349 100%);
  display:flex;justify-content:center;animation:fadeIn .4s ease;overflow:hidden}
@media(min-width:520px){.intro-wrap{top:18px;bottom:18px;height:calc(100vh - 36px);border-radius:30px}}
.intro-leave{animation:fadeOut .42s ease forwards}
.intro-amb{position:absolute;inset:0;pointer-events:none}
.amb{position:absolute;opacity:.15;font-size:24px}
.amb.a0{top:7%;left:10%;animation:floatA 5s ease-in-out infinite}
.amb.a1{top:12%;right:11%;animation:floatB 6s ease-in-out infinite}
.amb.a2{top:42%;left:7%;animation:floatA 7s ease-in-out infinite}
.amb.a3{top:38%;right:8%;animation:floatB 6.5s ease-in-out infinite}
.amb.a4{bottom:20%;left:14%;animation:floatA 5.5s ease-in-out infinite}
.intro-inner{position:relative;width:100%;max-width:430px;padding:20px 22px 26px;
  display:flex;flex-direction:column;min-height:100%;overflow-y:auto}
.intro-brand{display:flex;align-items:center;gap:8px;color:#fff;font-weight:700;font-size:14px}
.intro-brand .brandmark{width:28px;height:28px;font-size:15px}
.intro-skip{margin-left:auto;background:none;border:none;color:#8fb3a3;font-size:12px;cursor:pointer}
.intro-avatar-stage{position:relative;height:230px;display:flex;align-items:flex-end;justify-content:center;margin-top:6px}
.intro-glow{position:absolute;top:10%;left:50%;transform:translateX(-50%);width:230px;height:230px;border-radius:50%;
  background:radial-gradient(circle,rgba(76,175,80,.45),transparent 68%)}
.intro-avatar{position:relative;max-height:230px;width:auto;object-fit:contain;
  filter:drop-shadow(0 14px 22px rgba(0,0,0,.32));animation:bob 3.2s ease-in-out infinite}
.intro-avatar-fallback{display:flex;align-items:flex-end;justify-content:center;font-size:150px;line-height:1;
  position:relative;animation:bob 3.2s ease-in-out infinite}
.intro-wave{position:absolute;top:18px;right:24%;font-size:30px;animation:wave 1.3s ease-in-out infinite;transform-origin:bottom}
.intro-badge{position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);
  background:${C.orange};color:#fff;font-size:10px;padding:4px 14px;border-radius:20px;white-space:nowrap;
  animation:pulse 2s ease-in-out infinite}
.intro-bubble{background:rgba(255,255,255,.97);border-radius:18px 18px 18px 5px;padding:14px 16px;margin:22px 0 14px;
  box-shadow:0 8px 24px rgba(0,0,0,.18)}
.intro-bubble-title{font-size:16px;font-weight:700;color:${C.ink};line-height:1.3}
.intro-bubble-sub{font-size:12.5px;color:#3a5a4d;margin-top:5px;line-height:1.4}
.intro-goals{display:flex;flex-direction:column;gap:9px;margin-top:auto}
.intro-goal{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.97);
  border:2px solid transparent;border-radius:14px;padding:12px 14px;cursor:pointer;text-align:left;
  transition:transform .12s,border-color .12s}
.intro-goal:active{transform:scale(.98)}
.intro-goal.sel{border-color:${C.green}}
.ig-emoji{font-size:24px}
.ig-text{flex:1;display:flex;flex-direction:column;min-width:0}
.ig-title{font-size:14px;font-weight:700;color:${C.ink}}
.ig-sub{font-size:11px;color:${C.muted}}
.ig-arrow{color:${C.green};font-size:18px;font-weight:700}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes wave{0%,100%{transform:rotate(0)}50%{transform:rotate(22deg)}}
@keyframes floatA{0%,100%{transform:translateY(0)}50%{transform:translateY(-13px)}}
@keyframes floatB{0%,100%{transform:translateY(0)}50%{transform:translateY(11px)}}
@keyframes pulse{0%,100%{transform:translateX(-50%) scale(1)}50%{transform:translateX(-50%) scale(1.05)}}
@keyframes fadeOut{0%{opacity:1}100%{opacity:0;visibility:hidden}}
      `}</style>
    </div>
  );
}
