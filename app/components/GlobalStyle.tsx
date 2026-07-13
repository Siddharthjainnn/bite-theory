'use client';

import { C } from '../lib/bite';

/**
 * One stylesheet shared by every page (app shell + all screens).
 * v2 — Swiggy/Zomato-grade visual redesign on Bite Theory brand colors.
 * Same class names as before, so ALL functionality (Ask Bhaiya, Today's
 * Special, Spin the Thali, cart, filters, etc.) keeps working untouched.
 */
export default function GlobalStyle() {
  return (
    <style>{`
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0;max-width:100%;overflow-x:hidden}
a{text-decoration:none;color:inherit}

/* ── design tokens layered on brand palette ── */
:root{
  --bt-night:#04160f;
  --bt-deep:${C.dark};
  --bt-panel:#123e2e;
  --bt-panel-hi:#1a5240;
  --bt-green:${C.green};
  --bt-green-deep:${C.greenDeep};
  --bt-orange:${C.orange};
  --bt-orange-deep:${C.orangeDeep};
  --bt-yellow:#ffd84d;
  --bt-gold:#f5d06f;
}

/* stage = desktop backdrop + centered phone frame */
.bt-stage{height:100vh;min-height:100vh;width:100%;background:
  radial-gradient(900px 600px at 50% -10%, #16604733, transparent 60%),
  var(--bt-night);
  display:flex;justify-content:center;align-items:stretch;
  padding:0;overflow:hidden}

/* app = full-height flex column: [header][scroll][footer] */
.bt-app{position:relative;width:100%;max-width:480px;background:${C.bg};
  height:100vh;max-height:100vh;overflow:hidden;
  display:flex;flex-direction:column;
  font-family:'Segoe UI',system-ui,-apple-system,BlinkMacSystemFont,Roboto,sans-serif;
  color:${C.ink}}

.bt-scroll{flex:1 1 auto;overflow-y:auto;overflow-x:hidden;
  -webkit-overflow-scrolling:touch;scrollbar-width:none;background:${C.bg}}
.bt-scroll::-webkit-scrollbar{display:none}

@media(min-width:520px){
  .bt-stage{padding:18px 0;align-items:center}
  .bt-app{height:calc(100vh - 36px);max-height:calc(100vh - 36px);
    margin:0;border-radius:34px;
    box-shadow:0 30px 90px rgba(0,0,0,.5);overflow:hidden}
  .bt-app .bt-head{border-radius:34px 34px 0 0}
}

/* ── DESKTOP / LAPTOP: full-width web app ── */
@media(min-width:1024px){
  .bt-stage{padding:0;align-items:stretch}
  .bt-app{max-width:100%;height:100vh;max-height:100vh;border-radius:0;box-shadow:none}
  .bt-app .bt-head{border-radius:0;padding-left:max(24px,calc((100vw - 1180px)/2));
    padding-right:max(24px,calc((100vw - 1180px)/2))}
  .bt-scroll>*{max-width:1180px;margin-left:auto;margin-right:auto}
  .bt-footer .bt-nav{display:none}
  .bt-hero{border-radius:26px;margin:18px 24px 0;padding:40px 44px}
  .bt-hero-title{font-size:52px}
  .bt-products{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:12px 24px 0}
  .bt-products .bt-sec-title,.bt-products .bt-empty{grid-column:1/-1}
  .bt-card{margin-bottom:0}
  .bt-offers{padding:14px 24px 0}
  .bt-cats,.bt-filters{padding-left:24px;padding-right:24px}
  .bt-special-row{padding:0 24px}
  .bt-banners{padding:14px 24px 0}
}
@media(min-width:768px) and (max-width:1023px){
  .bt-products{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
  .bt-products .bt-sec-title,.bt-products .bt-empty{grid-column:1/-1}
  .bt-card{margin-bottom:0}
}

/* ═══════════════ HEADER ("green world") ═══════════════ */
.bt-head{
  background:radial-gradient(130% 100% at 50% 0%, var(--bt-panel-hi) 0%, var(--bt-panel) 42%, var(--bt-deep) 100%);
  padding:16px 16px 18px;flex:0 0 auto;z-index:30;position:relative;overflow:hidden}
.bt-head::after{content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(60% 40% at 85% 0%, rgba(245,158,11,.14), transparent 70%)}
.bt-head--page{padding:14px 14px 16px}
.bt-head-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:0;gap:10px;position:relative;z-index:1}
.bt-head .bt-search{margin-top:14px}
.bt-brand{display:flex;align-items:center;gap:9px;min-width:0}
.bt-brand-name{color:#fff;font-weight:900;font-size:19px;line-height:1.05;letter-spacing:.2px;
  display:flex;align-items:center;gap:5px}
.bt-loc{color:rgba(255,255,255,.72);font-size:12px;margin-top:3px;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;max-width:210px}
.bt-page-title{color:#fff;font-size:17px;font-weight:800;flex:1;text-align:center;position:relative;z-index:1}
.bt-head-actions{display:flex;gap:8px;align-items:center;flex-shrink:0;position:relative;z-index:1}

/* Ask Bhaiya button — gold->orange, premium */
.bt-bhaiya-btn{border:none;cursor:pointer;border-radius:22px;
  background:linear-gradient(135deg,var(--bt-orange),#f7a73a);color:#fff;
  font-size:11.5px;font-weight:900;padding:0 14px;height:38px;white-space:nowrap;
  display:flex;align-items:center;gap:5px;letter-spacing:.2px;
  box-shadow:0 6px 16px rgba(245,158,11,.4);transition:transform .15s}
.bt-bhaiya-btn:active{transform:scale(.95)}
.bt-bhaiya-label{display:inline}
@media(max-width:360px){.bt-bhaiya-btn{padding:0 11px}.bt-bhaiya-label{display:none}}
.bt-icon-btn{width:38px;height:38px;border-radius:50%;border:none;
  background:rgba(255,255,255,.15);color:#fff;font-size:19px;cursor:pointer;
  display:flex;align-items:center;justify-content:center;transition:background .15s,transform .15s}
.bt-icon-btn:hover{background:rgba(255,255,255,.24)}
.bt-icon-btn:active{transform:scale(.92)}
.bt-avatar-btn{width:38px;height:38px;border-radius:50%;border:none;
  background:linear-gradient(135deg,#a3c93a,var(--bt-orange));color:#fff;font-size:15px;
  font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;
  box-shadow:0 3px 10px rgba(0,0,0,.25)}
.bt-avatar-btn:active{transform:scale(.92)}

/* search pill (rounded, glassy on the green world) */
.bt-search{width:100%;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.16);
  border-radius:26px;padding:13px 16px;display:flex;align-items:center;gap:10px;cursor:pointer;
  text-align:left;position:relative;z-index:1;backdrop-filter:blur(4px)}
.bt-head--page .bt-search{background:#fff;border:1px solid ${C.line};box-shadow:0 2px 8px rgba(13,59,46,.06)}
.bt-search-ph{color:rgba(255,255,255,.82);font-size:14px;white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;font-weight:500}
.bt-head--page .bt-search-ph{color:#8c9992}

.brandmark{width:38px;height:38px;border-radius:11px;
  background:linear-gradient(135deg,var(--bt-green),var(--bt-orange));display:flex;
  align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:19px;flex-shrink:0;
  box-shadow:0 4px 12px rgba(76,175,80,.35)}

.food-emoji{display:flex;align-items:center;justify-content:center;width:100%;height:100%;
  font-size:34px;line-height:1;filter:drop-shadow(0 5px 8px rgba(0,0,0,.18))}

/* ═══════════════ HERO (comic-burst energy) ═══════════════ */
.bt-hero{position:relative;overflow:hidden;text-align:center;
  background:
    radial-gradient(120% 120% at 50% -10%, rgba(255,216,77,.10), transparent 55%),
    radial-gradient(130% 100% at 50% 0%, var(--bt-panel-hi), var(--bt-panel) 48%, var(--bt-deep));
  margin:-2px 0 0;padding:26px 18px 24px;color:#fff}
.bt-hero::before{content:'🎟️';position:absolute;left:14px;top:20px;font-size:24px;
  transform:rotate(-16deg);opacity:.85;animation:heroFloat 3.4s ease-in-out infinite}
.bt-hero::after{content:'🎟️';position:absolute;right:16px;top:64px;font-size:22px;
  transform:rotate(14deg);opacity:.85;animation:heroFloat 3.4s ease-in-out infinite .6s}
@keyframes heroFloat{0%,100%{transform:translateY(0) rotate(-16deg)}50%{transform:translateY(-6px) rotate(-10deg)}}
.bt-veg-badge{display:inline-block;background:rgba(255,255,255,.18);color:#fff;
  font-size:10.5px;font-weight:800;padding:4px 12px;border-radius:20px;margin-bottom:10px;
  letter-spacing:.6px;border:1px solid rgba(255,255,255,.2);position:relative;z-index:1}
.bt-hero-title{color:#fff;font-size:34px;font-weight:900;line-height:1.06;margin:0;
  letter-spacing:.3px;position:relative;z-index:1;
  text-shadow:0 4px 0 rgba(0,0,0,.22);animation:heroPop .5s ease}
.bt-hero-title br+*{color:var(--bt-yellow)}
.bt-hero-sub{color:rgba(255,255,255,.92);font-size:14px;font-weight:600;margin:10px 0 0;
  position:relative;z-index:1}
@keyframes heroPop{0%{opacity:0;transform:scale(.96)}100%{opacity:1;transform:scale(1)}}

/* ═══════════════ BANNERS ═══════════════ */
.bt-banners{padding:14px 14px 0}
.bt-banner-track{display:flex;gap:12px;overflow-x:auto;scrollbar-width:none;
  scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}
.bt-banner-track::-webkit-scrollbar{display:none}
.bt-banner{flex:0 0 88%;max-width:520px;scroll-snap-align:start;border-radius:20px;
  overflow:hidden;position:relative;aspect-ratio:5/2;background:var(--bt-deep);cursor:pointer;
  box-shadow:0 8px 22px rgba(13,59,46,.14)}
@media(min-width:1024px){.bt-banner{flex:0 0 32%}}
.bt-banner img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s}
.bt-banner:active img{transform:scale(1.04)}
.bt-banner-title{position:absolute;left:14px;bottom:12px;color:#fff;font-weight:900;
  font-size:15px;text-shadow:0 2px 8px rgba(0,0,0,.6)}
.bt-banner-dots{display:flex;gap:5px;justify-content:center;padding-top:10px}
.bt-banner-dots i{width:6px;height:6px;border-radius:50%;background:#cdd8d0;transition:.25s}
.bt-banner-dots i.on{background:var(--bt-green);width:18px;border-radius:4px}

/* ═══════════════ TODAY'S SPECIAL ═══════════════ */
.bt-special-head{display:flex;align-items:center;gap:8px;padding:18px 14px 10px;
  font-weight:900;font-size:17px;color:${C.ink};letter-spacing:.2px}
.bt-special-head .zap{font-size:19px;animation:pulseZap 1.6s infinite}
@keyframes pulseZap{0%,100%{transform:scale(1)}50%{transform:scale(1.28)}}
.bt-special-row{display:flex;gap:13px;overflow-x:auto;padding:4px 14px 6px;
  scrollbar-width:none;-webkit-overflow-scrolling:touch}
.bt-special-row::-webkit-scrollbar{display:none}
.bt-sp-card{flex:0 0 172px;background:#fff;border-radius:20px;overflow:hidden;
  border:1.5px solid transparent;position:relative;cursor:pointer;
  background-image:linear-gradient(#fff,#fff),linear-gradient(135deg,var(--bt-orange),var(--bt-green));
  background-origin:border-box;background-clip:padding-box,border-box;
  box-shadow:0 8px 22px rgba(22,96,71,.12);transition:transform .18s}
.bt-sp-card:active{transform:translateY(2px) scale(.99)}
@media(min-width:1024px){.bt-sp-card{flex:0 0 200px}}
.bt-sp-img{height:118px;position:relative;background:linear-gradient(160deg,#ffe0b2,#ffcc80);overflow:hidden}
.bt-sp-img img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s}
.bt-sp-card:hover .bt-sp-img img{transform:scale(1.06)}
.bt-sp-tag{position:absolute;top:9px;left:9px;background:linear-gradient(135deg,var(--bt-orange),#f7a73a);
  color:#fff;font-size:9.5px;font-weight:900;padding:4px 9px;border-radius:999px;
  letter-spacing:.4px;box-shadow:0 3px 8px rgba(245,158,11,.45)}
.bt-sp-body{padding:10px 11px 12px}
.bt-sp-name{font-weight:800;font-size:13px;color:${C.ink};white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.bt-sp-price{display:flex;align-items:center;gap:6px;margin-top:5px;font-size:13.5px}
.bt-sp-price b{color:${C.greenDeep};font-weight:900}
.bt-sp-price s{color:${C.muted};font-size:11px}
.bt-sp-add{margin-top:9px;width:100%;border:1.5px solid var(--bt-green);background:${C.greenSoft};
  color:${C.greenDeep};font-weight:900;font-size:12px;border-radius:11px;padding:8px 0;cursor:pointer;
  letter-spacing:.3px;transition:transform .12s}
.bt-sp-add:active{transform:scale(.96)}

/* veg toggle */
.bt-vegtoggle{display:flex;align-items:center;gap:7px;border:1px solid #d8e0da;
  background:#fff;border-radius:12px;padding:7px 11px;cursor:pointer;flex-shrink:0}
.bt-vegtoggle .lbl{font-size:11px;font-weight:900;color:${C.greenDeep};letter-spacing:.3px}
.bt-vegtoggle .sw{width:32px;height:17px;border-radius:999px;background:#d0d8d2;
  position:relative;transition:.2s}
.bt-vegtoggle .sw i{position:absolute;top:2px;left:2px;width:13px;height:13px;border-radius:50%;
  background:#fff;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.25)}
.bt-vegtoggle.on .sw{background:var(--bt-green)}
.bt-vegtoggle.on .sw i{left:17px}

/* ═══════════════ CATEGORIES (cream circles) ═══════════════ */
.bt-cats{padding:0;max-width:100%;background:#fff}
.bt-cat-scroll{display:flex;gap:15px;overflow-x:auto;padding:16px 14px 8px;
  scrollbar-width:none;-webkit-overflow-scrolling:touch}
.bt-cat-scroll::-webkit-scrollbar{display:none}
.bt-cat{flex-shrink:0;background:none;border:none;cursor:pointer;text-align:center;padding:0;
  display:flex;flex-direction:column;align-items:center;gap:6px}
.bt-cat-ic{width:60px;height:60px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-size:29px;overflow:hidden;transition:transform .18s,box-shadow .18s;
  background:#fdf9f2;border:1px solid ${C.line}}
.bt-cat-ic img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.bt-cat-ic .food-emoji{font-size:29px}
.bt-cat.on .bt-cat-ic{transform:scale(1.06);box-shadow:0 4px 14px rgba(76,175,80,.28)}
.bt-cat-lbl{display:block;font-size:12.5px;color:${C.muted};max-width:66px;font-weight:700;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt-cat.on .bt-cat-lbl{font-weight:900;color:${C.ink}}
.bt-cat.on::after,.bt-cat::after{content:'';display:block;height:3px;width:30px;border-radius:2px;
  background:transparent;transition:background .18s;margin-top:-2px}
.bt-cat.on::after{background:var(--bt-orange)}

/* ═══════════════ OFFERS ═══════════════ */
.bt-offers{display:flex;gap:11px;overflow-x:auto;padding:14px 14px 6px;background:#fff;
  scrollbar-width:none;-webkit-overflow-scrolling:touch}
.bt-offers::-webkit-scrollbar{display:none}
.bt-offer{flex-shrink:0;border-radius:16px;padding:13px 15px;display:flex;align-items:center;
  gap:11px;min-width:192px;transition:transform .15s}
.bt-offer:active{transform:scale(.98)}
.bt-offer.dark{background:linear-gradient(135deg,var(--bt-deep),#0a2d22);box-shadow:0 6px 18px rgba(13,59,46,.2)}
.bt-offer.soft{background:linear-gradient(135deg,${C.orangeSoft},#ffe9cc)}
.bt-offer-ic{width:34px;height:34px;border-radius:11px;display:flex;align-items:center;
  justify-content:center;color:#fff;font-size:17px;font-weight:900;flex-shrink:0}
.bt-offer.dark .bt-offer-t{color:#fff;font-size:13px;font-weight:800}
.bt-offer.dark .bt-offer-s{color:#8fb3a3;font-size:10px;font-weight:700;letter-spacing:.3px}
.bt-offer-t{font-size:13px;font-weight:800}
.bt-offer-s{font-size:10px;font-weight:700;letter-spacing:.3px}

/* ═══════════════ FILTERS ═══════════════ */
.bt-filters{display:flex;gap:8px;overflow-x:auto;padding:12px 14px;background:#fff;
  border-bottom:1px solid ${C.line};scrollbar-width:none;-webkit-overflow-scrolling:touch}
.bt-filters::-webkit-scrollbar{display:none}
.bt-chip{flex-shrink:0;font-size:13px;padding:8px 14px;border-radius:12px;
  border:1px solid #d8e0da;background:#fff;color:${C.ink};cursor:pointer;font-weight:700;
  white-space:nowrap;transition:.15s}
.bt-chip.on{background:${C.greenSoft};color:${C.greenDeep};border-color:var(--bt-green)}
.bt-chip:active{transform:scale(.96)}

/* ═══════════════ PRODUCTS ═══════════════ */
.bt-products{padding:16px 14px 0}
.bt-sec-title{font-size:13px;font-weight:900;margin:6px 0 14px;letter-spacing:2.5px;
  color:#8894a0;text-transform:uppercase}
.bt-card{display:flex;gap:13px;background:#fff;border:1px solid ${C.line};
  border-radius:20px;padding:11px;margin-bottom:13px;box-shadow:0 4px 14px rgba(13,59,46,.05);
  transition:transform .16s,box-shadow .16s}
.bt-card:active{transform:translateY(2px);box-shadow:0 2px 8px rgba(13,59,46,.06)}
.bt-card-img{width:100px;height:100px;border-radius:16px;
  background:linear-gradient(160deg,#dcedc8,#c5e1a5);
  display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;overflow:hidden}
.bt-card-img img{width:100%;height:100%;object-fit:cover;transition:transform .4s}
.bt-card:hover .bt-card-img img{transform:scale(1.06)}
.bt-card-img .food-emoji{font-size:44px}
.veg-dot{position:absolute;top:7px;left:7px;width:16px;height:16px;border:2px solid var(--bt-green);
  border-radius:4px;background:#fff;display:flex;align-items:center;justify-content:center;z-index:2}
.veg-dot i{width:7px;height:7px;background:var(--bt-green);border-radius:50%}
.veg-dot.sm{width:14px;height:14px}
.veg-dot.sm i{width:6px;height:6px}
.bt-card-off{position:absolute;bottom:7px;left:7px;background:var(--bt-orange);color:#fff;
  font-size:9px;font-weight:900;padding:3px 7px;border-radius:6px;z-index:2;
  box-shadow:0 2px 6px rgba(245,158,11,.4)}
.bt-card-body{flex:1;min-width:0;display:flex;flex-direction:column}
.bt-card-name{font-size:15px;font-weight:900;color:${C.ink}}
.bt-card-name-link{color:inherit}
.bt-card-desc{font-size:11.5px;color:${C.muted};margin:3px 0 7px;
  display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.bt-card-tags{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px}
.tag{font-size:9.5px;background:${C.bg};color:${C.muted};padding:3px 7px;border-radius:6px;
  font-weight:700;white-space:nowrap}
.tag.green{background:${C.greenSoft};color:#2e7d32}
.tag.orange{background:${C.orangeSoft};color:#b76e00}
.bt-card-foot{display:flex;align-items:center;justify-content:space-between;margin-top:auto;gap:8px}
.bt-price b{font-size:16px;font-weight:900;color:${C.ink}}
.bt-price s{font-size:11px;color:#9aa8a0;margin-left:6px}
.bt-add{background:var(--bt-green);color:#fff;border:none;font-size:12px;font-weight:900;
  padding:8px 20px;border-radius:11px;cursor:pointer;letter-spacing:.5px;flex-shrink:0;
  box-shadow:0 4px 12px rgba(76,175,80,.3);transition:transform .12s}
.bt-add:active{transform:scale(.94)}
.bt-qty{display:flex;align-items:center;gap:11px;background:var(--bt-green);border-radius:11px;
  padding:6px 12px;flex-shrink:0;box-shadow:0 4px 12px rgba(76,175,80,.3)}
.bt-qty button{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;width:14px}
.bt-qty span{color:#fff;font-weight:900;font-size:13px;min-width:12px;text-align:center}
.bt-empty{background:#fff;border:1px dashed ${C.line};border-radius:16px;padding:34px 18px;
  text-align:center;color:${C.muted};font-size:13px}

/* skeletons */
.skel{background:linear-gradient(90deg,#eef2ee 25%,#e3e9e3 50%,#eef2ee 75%);
  background-size:200% 100%;animation:sh 1.3s infinite}
.skel-txt{height:11px;border-radius:6px;margin:6px 0;
  background:linear-gradient(90deg,#eef2ee 25%,#e3e9e3 50%,#eef2ee 75%);
  background-size:200% 100%;animation:sh 1.3s infinite}
@keyframes sh{0%{background-position:200% 0}100%{background-position:-200% 0}}

/* ═══════════════ FOOTER — floating dock + cart bar ═══════════════ */
.bt-footer{flex:0 0 auto;position:relative;z-index:25;background:transparent}
.bt-cartbar{margin:0 12px 8px;border-radius:18px;
  background:linear-gradient(135deg,var(--bt-green),var(--bt-green-deep));
  padding:13px 18px;display:flex;align-items:center;justify-content:space-between;
  box-shadow:0 10px 28px rgba(76,175,80,.35);animation:slideUpBar .4s ease}
.bt-cartbar-c{color:#eafdea;font-size:11px;font-weight:600}
.bt-cartbar-t{color:#fff;font-weight:900;font-size:17px}
.bt-cartbar-btn{background:#fff;color:${C.greenDeep};border:none;font-weight:900;
  padding:11px 22px;border-radius:22px;cursor:pointer;font-size:13px;
  box-shadow:0 4px 10px rgba(0,0,0,.15);transition:transform .12s}
.bt-cartbar-btn:active{transform:scale(.95)}

/* floating pill nav */
.bt-nav{background:#fff;margin:0 12px 12px;border-radius:30px;
  border:1px solid ${C.line};display:flex;justify-content:space-around;
  padding:8px 8px;box-shadow:0 10px 30px rgba(4,22,15,.18)}
.bt-nav-i{background:none;border:none;cursor:pointer;display:flex;flex-direction:column;
  align-items:center;gap:2px;color:#69766f;font-size:10px;font-weight:700;position:relative;
  flex:1;padding:8px 4px;border-radius:22px;transition:background .18s}
.bt-nav-ic{font-size:20px;position:relative;display:inline-block;transition:transform .18s}
.bt-nav-i.on{color:${C.greenDeep};background:${C.greenSoft}}
.bt-nav-i.on .bt-nav-ic{transform:scale(1.14) translateY(-1px)}
.bt-nav-badge{position:absolute;top:-6px;right:-10px;background:var(--bt-orange);color:#fff;
  font-style:normal;font-size:9px;font-weight:900;min-width:16px;height:16px;border-radius:8px;
  display:flex;align-items:center;justify-content:center;padding:0 3px;
  box-shadow:0 2px 6px rgba(245,158,11,.5)}

/* ═══════════════ generic page bits ═══════════════ */
.bt-page-pad{padding:14px 14px}
.bt-section-h{font-size:15px;font-weight:900;margin:18px 14px 10px}

/* ═══════════════ PRODUCT DETAIL ═══════════════ */
.pd-hero{position:relative;width:100%;aspect-ratio:1/1;max-height:340px;
  background:linear-gradient(160deg,#ffe0b2,#ffcc80);
  display:flex;align-items:center;justify-content:center;overflow:hidden}
.pd-hero img{width:100%;height:100%;object-fit:cover}
.pd-hero .food-emoji{font-size:120px}
.pd-hero-off{position:absolute;top:14px;left:14px;background:var(--bt-orange);color:#fff;
  font-size:12px;font-weight:900;padding:6px 13px;border-radius:10px;
  box-shadow:0 4px 12px rgba(245,158,11,.4)}
.pd-veg{position:absolute;top:14px;right:14px;width:24px;height:24px;border:2px solid var(--bt-green);
  border-radius:5px;background:#fff;display:flex;align-items:center;justify-content:center}
.pd-veg i{width:11px;height:11px;background:var(--bt-green);border-radius:50%}
.pd-body{padding:18px 16px 0}
.pd-name{font-size:23px;font-weight:900;line-height:1.2;color:${C.ink}}
.pd-rating{display:inline-flex;align-items:center;gap:4px;background:var(--bt-green);
  color:#fff;font-size:12px;font-weight:900;padding:4px 10px;border-radius:9px;margin-top:8px}
.pd-desc{font-size:13.5px;color:#3a5a4d;line-height:1.55;margin:12px 0 4px}
.pd-price{display:flex;align-items:baseline;gap:10px;margin:14px 0 4px}
.pd-price b{font-size:27px;font-weight:900;color:${C.ink}}
.pd-price s{font-size:15px;color:#9aa8a0}
.pd-price .pd-save{font-size:12px;font-weight:900;color:${C.greenDeep};background:${C.greenSoft};
  padding:4px 10px;border-radius:8px}
.pd-macros{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0 6px}
.pd-macro{background:#fff;border:1px solid ${C.line};border-radius:15px;padding:13px 6px;text-align:center;
  box-shadow:0 3px 10px rgba(13,59,46,.04)}
.pd-macro b{display:block;font-size:18px;font-weight:900;color:${C.ink}}
.pd-macro span{font-size:10px;color:${C.muted};font-weight:600}
.pd-macro.cal b{color:var(--bt-orange)}
.pd-macro.pro b{color:var(--bt-green)}

/* ═══════════════ CART ═══════════════ */
.cart-item{display:flex;gap:12px;background:#fff;border:1px solid ${C.line};
  border-radius:18px;padding:11px;margin-bottom:12px;align-items:center;
  box-shadow:0 3px 12px rgba(13,59,46,.04)}
.cart-item-img{width:72px;height:72px;border-radius:13px;
  background:linear-gradient(160deg,#dcedc8,#c5e1a5);
  display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;position:relative}
.cart-item-img img{width:100%;height:100%;object-fit:cover}
.cart-item-img .food-emoji{font-size:30px}
.cart-item-info{flex:1;min-width:0}
.cart-item-name{font-size:14px;font-weight:900;color:${C.ink}}
.cart-item-price{font-size:13px;color:${C.muted};margin-top:2px}
.cart-item-price b{color:${C.ink}}
.cart-remove{background:none;border:none;color:#c0392b;font-size:11px;cursor:pointer;
  margin-top:4px;padding:0;font-weight:700}
.bill{background:#fff;border:1px solid ${C.line};border-radius:18px;padding:15px;margin-top:6px;
  box-shadow:0 3px 12px rgba(13,59,46,.04)}
.bill-row{display:flex;justify-content:space-between;font-size:13px;color:#3a5a4d;margin-bottom:9px}
.bill-row.free{color:${C.greenDeep};font-weight:900}
.bill-hr{border:none;border-top:1px dashed ${C.line};margin:11px 0}
.bill-total{display:flex;justify-content:space-between;font-size:16px;font-weight:900;color:${C.ink}}
.coupon{display:flex;gap:8px;align-items:center;background:${C.orangeSoft};border:1px dashed var(--bt-orange);
  border-radius:14px;padding:11px 13px;margin:12px 0;font-size:12px;color:${C.orangeDeep};font-weight:800}
.checkout-bar{padding:12px 16px;background:#fff;border-top:1px solid ${C.line};
  display:flex;align-items:center;justify-content:space-between;gap:12px}
.checkout-total b{font-size:18px;font-weight:900}
.checkout-total span{display:block;font-size:11px;color:${C.muted}}
.checkout-btn{flex:1;max-width:210px;background:linear-gradient(135deg,var(--bt-green),var(--bt-green-deep));
  color:#fff;border:none;font-size:15px;font-weight:900;padding:14px;border-radius:15px;cursor:pointer;
  box-shadow:0 8px 20px rgba(76,175,80,.38);transition:transform .12s}
.checkout-btn:active{transform:scale(.97)}

/* ═══════════════ ORDERS ═══════════════ */
.order-card{background:#fff;border:1px solid ${C.line};border-radius:18px;padding:15px;margin-bottom:13px;
  box-shadow:0 3px 12px rgba(13,59,46,.04)}
.order-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
.order-id{font-size:13px;font-weight:900;color:${C.ink}}
.order-date{font-size:11px;color:${C.muted};margin-top:2px}
.order-status{font-size:10px;font-weight:900;padding:5px 11px;border-radius:20px;white-space:nowrap}
.order-status.placed{background:${C.orangeSoft};color:${C.orangeDeep}}
.order-status.preparing{background:${C.orangeSoft};color:${C.orangeDeep}}
.order-status.on_the_way{background:#e3f2fd;color:#1565c0}
.order-status.delivered{background:${C.greenSoft};color:${C.greenDeep}}
.order-items{display:flex;flex-direction:column;gap:6px}
.order-line{display:flex;justify-content:space-between;font-size:12.5px;color:#3a5a4d}
.order-foot{display:flex;justify-content:space-between;align-items:center;
  border-top:1px dashed ${C.line};margin-top:11px;padding-top:11px}
.order-total{font-size:14px;font-weight:900;color:${C.ink}}
.order-reorder{background:${C.greenSoft};color:${C.greenDeep};border:none;font-size:12px;
  font-weight:900;padding:8px 15px;border-radius:11px;cursor:pointer}

/* ═══════════════ MENU PAGE ═══════════════ */
.menu-jump{display:flex;gap:8px;overflow-x:auto;padding:11px 14px;scrollbar-width:none;
  position:sticky;top:0;background:${C.bg};z-index:5}
.menu-jump::-webkit-scrollbar{display:none}
.menu-jump-chip{flex-shrink:0;font-size:12px;padding:7px 14px;border-radius:20px;
  border:1px solid ${C.line};background:#fff;color:${C.ink};cursor:pointer;font-weight:700;white-space:nowrap}
.menu-jump-chip.on{background:var(--bt-deep);color:#fff;border-color:var(--bt-deep)}
.menu-cat-h{display:flex;align-items:center;gap:8px;font-size:17px;font-weight:900;
  margin:20px 14px 12px;scroll-margin-top:60px;color:${C.ink}}
.menu-cat-h .cnt{font-size:11px;font-weight:600;color:${C.muted}}

/* toast */
.toast{position:absolute;bottom:150px;left:50%;transform:translateX(-50%);
  background:var(--bt-deep);color:#fff;font-size:13px;font-weight:700;padding:12px 20px;border-radius:24px;
  box-shadow:0 10px 30px rgba(0,0,0,.35);z-index:50;animation:toastIn .3s ease;white-space:nowrap}

/* keyframes */
@keyframes slideUpBar{0%{transform:translateY(100px);opacity:0}100%{transform:translateY(0);opacity:1}}
@keyframes toastIn{0%{transform:translate(-50%,20px);opacity:0}100%{transform:translate(-50%,0);opacity:1}}
@keyframes fadeIn{0%{opacity:0}100%{opacity:1}}
@keyframes sheetup{from{transform:translateY(26px);opacity:.4}to{transform:translateY(0);opacity:1}}

/* ── Cuisines & dishes grid (photo tiles, Bite Theory brand) ── */
.cz-wrap{padding:12px 12px 4px}
.cz-search{display:flex;align-items:center;gap:9px;background:#fff;
  border:1px solid ${C.line};border-radius:14px;padding:11px 14px;
  box-shadow:0 2px 8px rgba(13,59,46,.06);margin-bottom:16px}
.cz-search span{font-size:14px;opacity:.6}
.cz-search input{flex:1;border:none;outline:none;font-size:14px;color:${C.ink};background:none}
.cz-search input::placeholder{color:#9aa8a0}
.cz-clear{border:none;background:${C.bg};color:${C.muted};width:22px;height:22px;
  border-radius:50%;cursor:pointer;font-size:11px;line-height:1;flex-shrink:0}

.cz-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px 8px;padding:2px 2px 8px}
@media(min-width:1024px){.cz-grid{grid-template-columns:repeat(6,1fr);gap:22px 12px}}

.cz-tile{background:none;border:none;cursor:pointer;padding:0;text-align:center;
  display:flex;flex-direction:column;align-items:center;gap:2px;
  animation:czIn .42s cubic-bezier(.4,0,.2,1) both}
@keyframes czIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}

.cz-photo{position:relative;width:100%;aspect-ratio:1/1;border-radius:18px;overflow:hidden;
  background:radial-gradient(120% 120% at 50% 15%, #fff, ${C.greenSoft} 90%);
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 6px 16px rgba(13,59,46,.10),0 1px 3px rgba(13,59,46,.06);
  border:1px solid rgba(13,59,46,.05);
  transition:transform .26s cubic-bezier(.34,1.56,.64,1),box-shadow .26s}
.cz-tile:active .cz-photo{transform:scale(.93)}
.cz-tile:hover .cz-photo{transform:translateY(-2px);
  box-shadow:0 10px 24px rgba(13,59,46,.14),0 2px 6px rgba(13,59,46,.06)}
.cz-photo img{width:100%;height:100%;object-fit:cover}
.cz-photo .food-emoji{font-size:34px}
.cz-photo .veg-dot{position:absolute;top:6px;left:6px}

.cz-name{font-size:12px;font-weight:700;color:${C.ink};margin-top:7px;line-height:1.2;
  max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 2px}
.cz-count{font-size:9.5px;font-weight:600;color:var(--bt-orange-deep);
  background:${C.orangeSoft};padding:1px 7px;border-radius:20px}

/* ── Promo hero (coupon-driven, Bite Theory green/gold energy) ── */
.bt-hero--promo{
  background:
    radial-gradient(140% 120% at 15% -20%, #1a5240 0%, var(--bt-panel) 40%, var(--bt-deep) 100%),
    var(--bt-deep);
  text-align:left;position:relative;overflow:hidden;
  padding:22px 20px 20px}
.bt-hero--promo::before{
  content:"";position:absolute;inset:0;pointer-events:none;
  background:
    conic-gradient(from 210deg at 78% 30%,
      transparent 0deg, rgba(245,158,11,.16) 22deg, transparent 44deg,
      rgba(76,175,80,.14) 90deg, transparent 130deg,
      rgba(245,158,11,.12) 200deg, transparent 250deg)}
.bt-hero--promo>*{position:relative;z-index:1}

.bt-hero--promo .bt-veg-badge{
  background:rgba(255,255,255,.14);border:1px solid rgba(255,216,77,.4);
  color:var(--bt-yellow);font-weight:800;letter-spacing:.4px}

.promo-offer{display:flex;flex-direction:column;margin:12px 0 4px;line-height:.94}
.promo-flat{font-size:22px;font-weight:900;font-style:italic;letter-spacing:-.5px;
  color:var(--bt-yellow);text-shadow:0 2px 0 rgba(0,0,0,.25);transform:skewX(-6deg);width:max-content}
.promo-big{font-size:34px;font-weight:900;font-style:italic;letter-spacing:-1px;
  color:#fff;text-shadow:0 3px 0 rgba(0,0,0,.28);transform:skewX(-6deg);
  background:linear-gradient(180deg,#fff 55%,#ffe9b0);-webkit-background-clip:text;background-clip:text;
  -webkit-text-fill-color:transparent;padding-right:4px;width:max-content}

.promo-sub{color:#dff5e6;font-size:12px;margin:8px 0 14px}
.promo-sub b{color:var(--bt-yellow);letter-spacing:.5px;background:rgba(245,158,11,.16);
  padding:1px 7px;border-radius:6px}

.promo-cta{display:inline-flex;align-items:center;gap:7px;border:none;cursor:pointer;
  background:linear-gradient(135deg,var(--bt-green),var(--bt-green-deep));color:#fff;
  font-size:14px;font-weight:800;letter-spacing:.3px;padding:11px 22px;border-radius:13px;
  box-shadow:0 8px 20px rgba(76,175,80,.4),inset 0 1px 0 rgba(255,255,255,.25);
  transition:transform .18s cubic-bezier(.34,1.56,.64,1),box-shadow .18s}
.promo-cta:hover{box-shadow:0 10px 26px rgba(76,175,80,.5)}
.promo-cta:active{transform:scale(.95)}
.promo-cta span{transition:transform .18s}
.promo-cta:hover span{transform:translateX(3px)}

/* floating accents */
.promo-spark,.promo-ticket{position:absolute;z-index:1;pointer-events:none;opacity:.9}
.promo-spark{color:var(--bt-yellow);font-size:14px;animation:twinkle 2.4s ease-in-out infinite}
.promo-spark.s1{top:16px;right:60px}
.promo-spark.s2{bottom:44px;right:24px;font-size:10px;animation-delay:.8s}
.promo-ticket{font-size:26px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.3))}
.promo-ticket.t1{top:14px;right:16px;transform:rotate(18deg);animation:floaty 3.4s ease-in-out infinite}
.promo-ticket.t2{bottom:16px;right:74px;font-size:20px;transform:rotate(-12deg);
  animation:floaty 3.4s ease-in-out infinite;animation-delay:.6s;opacity:.75}
@keyframes twinkle{0%,100%{opacity:.4;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
@keyframes floaty{0%,100%{transform:translateY(0) rotate(18deg)}50%{transform:translateY(-7px) rotate(18deg)}}

@media(min-width:1024px){
  .promo-big{font-size:44px}
  .promo-flat{font-size:28px}
}

/* ── Recommended for you (wide photo cards, Bite Theory brand) ── */
.rec-wrap{padding:6px 0 2px}
.rec-head{display:flex;align-items:baseline;gap:9px;padding:6px 12px 10px}
.rec-title{font-size:17px;font-weight:850;letter-spacing:-.3px;margin:0;color:${C.ink}}
.rec-sub{font-size:11px;color:${C.muted};font-weight:600}

.rec-row{display:flex;gap:13px;overflow-x:auto;padding:2px 12px 6px;
  scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory}
.rec-row::-webkit-scrollbar{display:none}

.rec-card{flex:0 0 158px;scroll-snap-align:start;background:#fff;border-radius:18px;
  overflow:hidden;border:1px solid rgba(13,59,46,.05);
  box-shadow:0 6px 18px rgba(13,59,46,.08);
  transition:transform .2s,box-shadow .2s}
.rec-card:active{transform:scale(.98)}
@media(min-width:1024px){.rec-card{flex:0 0 188px}}

.rec-img{position:relative;display:block;width:100%;aspect-ratio:4/3;
  background:radial-gradient(120% 120% at 50% 10%, #fff, ${C.greenSoft} 92%);
  overflow:hidden}
.rec-img img{width:100%;height:100%;object-fit:cover}
.rec-img .food-emoji{width:100%;height:100%;display:flex;align-items:center;
  justify-content:center;font-size:44px}
.rec-img .veg-dot{position:absolute;top:7px;right:7px}

.rec-ribbon{position:absolute;bottom:0;left:0;
  background:linear-gradient(135deg,var(--bt-green),var(--bt-green-deep));color:#fff;
  font-size:10px;font-weight:850;letter-spacing:.2px;padding:4px 10px 4px 8px;
  border-top-right-radius:12px;box-shadow:0 -1px 6px rgba(0,0,0,.15)}
.rec-ribbon--gold{background:linear-gradient(135deg,var(--bt-orange),#f7a73a)}

.rec-rating{position:absolute;top:7px;left:7px;background:rgba(13,59,46,.86);
  color:#fff;font-size:10.5px;font-weight:800;padding:3px 7px;border-radius:8px;
  backdrop-filter:blur(2px)}

.rec-body{padding:9px 11px 11px}
.rec-name{display:block;font-size:13.5px;font-weight:750;color:${C.ink};line-height:1.25;
  margin-bottom:8px;min-height:34px;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rec-foot{display:flex;align-items:center;justify-content:space-between;gap:6px}
.rec-price b{font-size:14.5px;font-weight:850;color:${C.ink}}
.rec-price s{font-size:10.5px;color:#9aa8a0;margin-left:4px}

.rec-add{background:linear-gradient(135deg,var(--bt-green),var(--bt-green-deep));color:#fff;
  border:none;font-size:11.5px;font-weight:800;letter-spacing:.4px;padding:7px 14px;
  border-radius:10px;cursor:pointer;flex-shrink:0;
  box-shadow:0 3px 10px rgba(76,175,80,.32);transition:transform .16s cubic-bezier(.34,1.56,.64,1)}
.rec-add:active{transform:scale(.9)}
.rec-qty{padding:5px 9px;gap:8px}
.rec-sold{font-size:10px;font-weight:800;color:#c62828;background:#fdecec;
  padding:4px 9px;border-radius:16px}

/* ── Quick filter chips (premium, multi-select) ── */
.bt-filters{gap:8px;padding-top:12px;padding-bottom:2px}
.bt-chip{border-radius:22px;font-weight:650;padding:8px 14px;
  box-shadow:0 1px 3px rgba(13,59,46,.06);
  transition:transform .16s cubic-bezier(.34,1.56,.64,1),background .2s,color .2s,box-shadow .2s}
.bt-chip:active{transform:scale(.94)}
.bt-chip.on{background:linear-gradient(135deg,var(--bt-green),var(--bt-green-deep));
  color:#fff;border-color:transparent;box-shadow:0 4px 12px rgba(76,175,80,.32)}
.bt-chip--clear{background:#fff;color:#c0392b;border-color:#f3d2cd;font-weight:750}
.bt-chip--clear.on,.bt-chip--clear:active{background:#fdecec}

/* ── Product detail: premium layer ── */
.pd-hero{aspect-ratio:4/3;max-height:360px;
  background:radial-gradient(130% 110% at 50% 8%, #fff 0%, ${C.greenSoft} 78%, #dff0e2 100%);
  box-shadow:inset 0 -30px 40px -30px rgba(13,59,46,.18)}
.pd-hero .food-emoji{font-size:110px;filter:drop-shadow(0 8px 16px rgba(13,59,46,.18))}
.pd-hero-off{background:linear-gradient(135deg,var(--bt-orange),#f7a73a);
  box-shadow:0 4px 12px rgba(245,158,11,.4);border-radius:9px;font-weight:850}

.pd-name{letter-spacing:-.6px;font-weight:850}
.pd-rating{box-shadow:0 3px 10px rgba(76,175,80,.3)}
.pd-price b{letter-spacing:-1px}

/* macros as an elevated "nutrition card" — the healthy-brand signature */
.pd-macros{background:#fff;border:1px solid rgba(13,59,46,.06);border-radius:18px;
  padding:6px;gap:0;box-shadow:0 6px 18px rgba(13,59,46,.07);overflow:hidden}
.pd-macro{background:none!important;border:none!important;border-radius:0;
  position:relative;padding:14px 6px}
.pd-macro:not(:last-child)::after{content:"";position:absolute;right:0;top:22%;bottom:22%;
  width:1px;background:rgba(13,59,46,.08)}
.pd-macro b{font-size:19px;letter-spacing:-.5px}
.pd-macro span{text-transform:uppercase;letter-spacing:.4px;font-size:9px}

/* add-to-cart CTA (in body flow, above reviews) */
.pd-cta{margin:20px 0 6px;display:flex;gap:12px;align-items:center}
.pd-sticky-price{display:flex;flex-direction:column;line-height:1.1;flex-shrink:0}
.pd-sticky-price b{font-size:19px;font-weight:850;color:${C.ink};letter-spacing:-.5px}
.pd-sticky-price s{font-size:12px;color:#9aa8a0}
.pd-sticky-btn{flex:1;background:linear-gradient(135deg,var(--bt-green),var(--bt-green-deep));
  color:#fff;border:none;font-size:15px;font-weight:800;padding:14px;border-radius:14px;cursor:pointer;
  box-shadow:0 8px 20px rgba(76,175,80,.4),inset 0 1px 0 rgba(255,255,255,.22);
  transition:transform .16s cubic-bezier(.34,1.56,.64,1)}
.pd-sticky-btn:active{transform:scale(.97)}
.pd-cta .bt-qty{padding:9px 14px}
.pd-sticky-incart{flex:1;display:flex;align-items:center;justify-content:space-between;
  background:${C.greenSoft};border-radius:14px;padding:10px 14px}
.pd-sticky-incart span{font-weight:750;color:${C.greenDeep};font-size:14px}

@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
    `}</style>
  );
}
