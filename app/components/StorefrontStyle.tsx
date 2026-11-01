'use client';

/**
 * Styles for the storefront home (launch hero, menu sections, dish cards,
 * price comparison, app tiles). Mobile-first; the desktop layout reuses the
 * same pieces. Mounted once by GlobalStyle (mobile pages) and DesktopApp.
 *
 * Text colours are picked for ≥ 4.5:1 contrast on their background.
 */
export const SF = {
  ink: '#0F1F1A',
  muted: '#55655F',
  line: '#E3E9E6',
  soft: '#F6F8F7',
  green: '#1F7A3A',
  deep: '#0D3B2E',
  orange: '#F59E0B',
  amberInk: '#8A4206',
  mint: '#CFE3D6',
  gold: '#FBD38D',
};

export default function StorefrontStyle() {
  return (
    <style>{`
/* bottom nav: the floating Special button is gone, so no space is kept for it */
.bt-footer .bt-nav{padding-right:6px}
.bt-footer .bt-nav .bt-nav-i{flex:1}

/* ── launch hero ── */
.sf-hero-wrap{padding:14px 16px 0}
.sf-hero{position:relative;overflow:hidden;border-radius:22px;background:${SF.deep};color:#fff;
  box-shadow:0 14px 34px rgba(13,59,46,.28)}
.sf-hero-map{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.sf-hero-pin{position:absolute;right:42px;top:46px;width:34px;height:44px;pointer-events:none}
.sf-hero-ring{position:absolute;right:41px;top:70px;width:36px;height:36px;border-radius:50%;
  border:2px solid ${SF.orange};animation:sfRing 1.8s ease-out infinite;pointer-events:none}
.sf-hero-in{position:relative;padding:20px 18px 18px;display:flex;flex-direction:column;gap:16px}
.sf-badge{align-self:flex-start;display:inline-flex;align-items:center;gap:7px;background:${SF.orange};
  color:${SF.deep};border-radius:999px;padding:5px 11px 5px 9px;font-size:11px;font-weight:800;letter-spacing:.08em;
  text-transform:uppercase}
.sf-badge i{width:7px;height:7px;border-radius:50%;background:${SF.deep};animation:sfDot 1.2s ease-in-out infinite}
.sf-lead{font-size:14px;font-weight:600;color:${SF.mint}}
.sf-area{margin:2px 0 0;font-size:42px;font-weight:800;line-height:1;letter-spacing:-.03em;color:#fff}
.sf-when{font-size:15px;font-weight:700;color:${SF.gold};margin-top:4px}
.sf-count{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.sf-count div{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:12px;
  padding:10px 4px 8px;display:flex;flex-direction:column;align-items:center;gap:2px}
.sf-count b{font-size:24px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1}
.sf-count span{font-size:10.5px;font-weight:700;letter-spacing:.06em;color:${SF.mint}}
.sf-cta{height:50px;border-radius:14px;border:0;background:${SF.orange};color:${SF.deep};font-size:15px;
  font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;width:100%;
  font-family:inherit;transition:transform .12s}
.sf-cta:active{transform:scale(.98)}
.sf-cta:disabled{opacity:.7;cursor:default}
.sf-done{min-height:50px;border-radius:14px;background:rgba(255,255,255,.1);border:1px solid rgba(251,211,141,.5);
  font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 12px;text-align:center}
.sf-phone{display:flex;gap:8px}
.sf-phone label{flex:1;display:flex;align-items:center;gap:6px;background:#fff;border-radius:14px;padding:0 12px;height:50px;
  color:${SF.ink};font-weight:700;font-size:15px}
.sf-phone input{flex:1;min-width:0;border:0;outline:0;font:inherit;font-weight:600;color:${SF.ink};background:transparent}
.sf-phone .sf-cta{width:auto;padding:0 18px}
.sf-small{font-size:12px;color:${SF.mint};text-align:center;line-height:1.45}
.sf-err{font-size:12.5px;color:#FFD1C2;text-align:center}
.sf-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* ── trust strip ── */
.sf-trust{padding:12px 16px 0;display:flex;gap:8px}
.sf-trust div{flex:1;display:flex;align-items:center;gap:6px;background:#fff;border:1px solid ${SF.line};
  border-radius:10px;padding:8px;font-size:11.5px;font-weight:600;line-height:1.25;color:${SF.ink}}
.sf-trust svg{flex:none}
.sf-trust div.wide{flex:1.2}

/* ── category chips (stick under the header while scrolling the menu) ── */
.sf-chips{position:sticky;top:0;z-index:5;background:${'#f4f6f3'};padding:12px 0 10px 16px;display:flex;gap:8px;
  overflow-x:auto;scrollbar-width:none}
.sf-chips::-webkit-scrollbar{display:none}
.sf-chip{flex:none;height:36px;padding:0 14px;border-radius:18px;font:inherit;font-size:13px;font-weight:700;
  white-space:nowrap;background:#fff;color:${SF.ink};border:1px solid #D7E1DC;cursor:pointer}
.sf-chip.on{background:${SF.deep};color:#fff;border-color:${SF.deep}}
.sf-chips::after{content:'';flex:none;width:8px}

/* ── sections ── */
.sf-sec{padding:14px 16px 4px;scroll-margin-top:60px}
.sf-sec-h{display:flex;flex-direction:column;gap:3px;margin-bottom:12px}
.sf-sec-h h2{margin:0;font-size:19px;font-weight:800;letter-spacing:-.01em;color:${SF.ink};display:flex;align-items:center;gap:8px}
.sf-sec-h h2 em{font-style:normal;font-size:12px;font-weight:700;color:${SF.muted}}
.sf-sec-h p{margin:0;font-size:12.5px;color:${SF.muted}}
.sf-sec--menu-start{padding-top:22px}
.sf-menu-title{padding:22px 16px 0;margin:0;font-size:13px;font-weight:800;letter-spacing:.1em;color:${SF.muted};
  text-transform:uppercase;display:flex;align-items:center;gap:10px}
.sf-menu-title::after{content:'';flex:1;height:1px;background:${SF.line}}
.sf-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}

/* ── dish card ── */
.sf-dish{background:#fff;border:1px solid ${SF.line};border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:12px}
.sf-dish.out{opacity:.6}
.sf-dish + .sf-dish{margin-top:12px}
.sf-grid > .sf-dish{margin-top:0}
.sf-dish-row{display:flex;gap:12px}
.sf-dish-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.sf-veg{width:14px;height:14px;border:1.5px solid ${SF.green};border-radius:3px;display:inline-flex;align-items:center;justify-content:center;flex:none}
.sf-veg i{width:6px;height:6px;border-radius:50%;background:${SF.green}}
.sf-tagrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sf-tag{font-size:10.5px;font-weight:700;color:${SF.amberInk};background:#FFF1D6;border-radius:6px;padding:2px 7px}
.sf-tag.red{color:#9B1C1C;background:#FDECEC}
.sf-dish-name{margin:0;font-size:16px;font-weight:700;line-height:1.3;color:${SF.ink}}
.sf-dish-name a{color:inherit}
.sf-rating{display:flex;align-items:center;gap:4px;font-size:12.5px;font-weight:700;color:${SF.green}}
.sf-desc{margin:0;font-size:12.5px;line-height:1.45;color:${SF.muted};display:-webkit-box;-webkit-line-clamp:2;
  -webkit-box-orient:vertical;overflow:hidden}
.sf-macros{font-size:12px;font-weight:600;color:#3A4A44}
.sf-price{display:flex;align-items:baseline;gap:6px;font-size:16px;font-weight:800;color:${SF.ink}}
.sf-price s{font-size:12.5px;font-weight:600;color:${SF.muted}}
.sf-media{position:relative;width:118px;flex:none;padding-bottom:18px}
.sf-media.noimg{padding-bottom:0;display:flex;align-items:center;justify-content:flex-end;width:auto}
.sf-img{display:block;width:118px;height:108px;border-radius:12px;overflow:hidden;background:#EAF3EE}
.sf-img img{width:100%;height:100%;object-fit:cover;display:block}
.sf-img .food-emoji{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px}
.sf-act{position:absolute;left:50%;bottom:0;transform:translateX(-50%)}
.sf-media.noimg .sf-act{position:static;transform:none}
.sf-add{width:92px;height:36px;border-radius:10px;border:1px solid #C9DED0;background:#fff;color:${SF.green};
  font:inherit;font-size:14px;font-weight:800;letter-spacing:.04em;box-shadow:0 4px 12px rgba(13,59,46,.12);cursor:pointer}
.sf-add:active{transform:scale(.96)}
.sf-qty{width:92px;height:36px;border-radius:10px;background:${SF.green};display:flex;align-items:center;justify-content:space-between;
  box-shadow:0 4px 12px rgba(13,59,46,.2)}
.sf-qty button{width:32px;height:36px;border:0;background:transparent;color:#fff;font:inherit;font-size:18px;font-weight:700;cursor:pointer;padding:0}
.sf-qty span{font-size:14px;font-weight:800;color:#fff}
.sf-sold{font-size:11px;font-weight:800;color:#9B1C1C;background:#FDECEC;padding:6px 10px;border-radius:20px;white-space:nowrap}

/* ── price comparison ── */
.sf-cmp{display:grid;border:1px solid ${SF.line};border-radius:12px;overflow:hidden}
.sf-cmp div{background:${SF.soft};padding:8px 4px;display:flex;flex-direction:column;align-items:center;gap:2px;
  border-right:1px solid ${SF.line};min-width:0}
.sf-cmp div:last-child{border-right:0}
.sf-cmp span{font-size:11px;font-weight:600;color:${SF.muted};white-space:nowrap}
.sf-cmp b{font-size:15px;font-weight:700;color:#3A4A44}
.sf-cmp .ours{background:${SF.deep}}
.sf-cmp .ours span{color:${SF.gold};font-weight:700}
.sf-cmp .ours b{color:#fff;font-size:16px;font-weight:800}
.sf-save{display:flex;align-items:center;gap:6px;margin-top:-4px;font-size:12.5px;font-weight:600;color:${SF.green}}
.sf-note{margin:6px 16px 0;font-size:11.5px;line-height:1.45;color:${SF.muted}}

/* ── other apps ── */
.sf-apps{padding:26px 16px 0;display:flex;flex-direction:column;gap:12px}
.sf-apps h2{margin:0;font-size:17px;font-weight:800;color:${SF.ink}}
.sf-apps p{margin:3px 0 0;font-size:12.5px;color:${SF.muted}}
.sf-apps-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:10px}
.sf-app{background:#fff;border:1px solid ${SF.line};border-radius:14px;padding:14px 10px;display:flex;flex-direction:column;
  align-items:center;gap:10px;color:${SF.ink};transition:transform .15s, box-shadow .15s}
.sf-app:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(13,59,46,.08)}
.sf-app strong{font-size:20px;font-weight:800;letter-spacing:-.02em}
.sf-app span{display:flex;align-items:center;gap:4px;font-size:12px;font-weight:700}

.sf-foot{padding:26px 16px 18px;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12.5px;color:#3A4A44}
.sf-foot b{font-weight:700}
.sf-foot nav{display:flex;gap:14px}
.sf-foot a{color:${SF.green};font-weight:600}
.sf-empty{padding:30px 16px;text-align:center;color:${SF.muted};font-size:14px}
.sf-skel{height:150px;border-radius:16px;background:linear-gradient(90deg,#eef2f0 25%,#f7f9f8 50%,#eef2f0 75%);
  background-size:200% 100%;animation:sfShimmer 1.2s infinite}

/* ── desktop sizes ── */
.sf-desk .sf-hero-wrap{padding:24px 0 0}
.sf-desk .sf-hero-in{padding:36px 40px;flex-direction:row;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:28px 40px}
.sf-desk .sf-hero-left{flex:1 1 420px;display:flex;flex-direction:column;gap:18px}
.sf-desk .sf-hero-right{flex:0 1 400px;display:flex;flex-direction:column;gap:10px}
.sf-desk .sf-area{font-size:64px}
.sf-desk .sf-lead,.sf-desk .sf-when{font-size:17px}
.sf-desk .sf-count b{font-size:34px}
.sf-desk .sf-count div{padding:14px 4px 10px;border-radius:14px}
.sf-desk .sf-hero-pin{right:16%;top:60px}
.sf-desk .sf-hero-ring{right:calc(16% - 1px);top:84px}
.sf-desk .sf-cta{width:auto;padding:0 24px}
.sf-desk .sf-small{text-align:left}
.sf-desk .sf-trust,.sf-desk .sf-sec,.sf-desk .sf-apps,.sf-desk .sf-menu-title{padding-left:0;padding-right:0}
.sf-desk .sf-note{margin-left:0;margin-right:0}
.sf-desk .sf-trust div,.sf-desk .sf-trust div.wide{flex:0 1 auto;font-size:13.5px;padding:9px 14px}
.sf-desk .sf-chips{padding-left:0;top:62px;background:#f4f6f3}
.sf-desk .sf-grid{grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
.sf-desk .sf-apps-row{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.sf-desk .sf-app{flex-direction:row;justify-content:space-between;padding:18px 20px}
.sf-desk .sf-app strong{font-size:24px}
.sf-desk .sf-hero-ring,.sf-desk .sf-hero-pin{display:block}

@keyframes sfRing{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.2);opacity:0}}
@keyframes sfDot{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes sfShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@media(prefers-reduced-motion:reduce){.sf-hero-ring,.sf-badge i,.sf-skel{animation:none}}
    `}</style>
  );
}
