'use client';

import { C } from '../lib/bite';

/** One stylesheet shared by every page (app shell + all screens). */
export default function GlobalStyle() {
  return (
    <style>{`
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0;max-width:100%;overflow-x:hidden}
a{text-decoration:none;color:inherit}

/* stage = desktop backdrop + centered phone frame */
.bt-stage{height:100vh;min-height:100vh;width:100%;background:
  radial-gradient(900px 600px at 50% -10%, #16604733, transparent 60%),
  ${C.dark};
  display:flex;justify-content:center;align-items:stretch;
  padding:0;overflow:hidden}

/* app = full-height flex column: [header][scroll][footer] */
.bt-app{position:relative;width:100%;max-width:480px;background:${C.bg};
  height:100vh;max-height:100vh;overflow:hidden;
  display:flex;flex-direction:column;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  color:${C.ink}}

.bt-scroll{flex:1 1 auto;overflow-y:auto;overflow-x:hidden;
  -webkit-overflow-scrolling:touch;scrollbar-width:none}
.bt-scroll::-webkit-scrollbar{display:none}

@media(min-width:520px){
  .bt-stage{padding:18px 0;align-items:center}
  .bt-app{height:calc(100vh - 36px);max-height:calc(100vh - 36px);
    margin:0;border-radius:30px;
    box-shadow:0 30px 90px rgba(0,0,0,.5);overflow:hidden}
  .bt-app .bt-head{border-radius:30px 30px 0 0}
}

/* ── DESKTOP / LAPTOP: full-width web app, Swiggy-web style ── */
@media(min-width:1024px){
  .bt-stage{padding:0;align-items:stretch}
  .bt-app{max-width:100%;height:100vh;max-height:100vh;border-radius:0;box-shadow:none}
  .bt-app .bt-head{border-radius:0;padding-left:max(24px,calc((100vw - 1180px)/2));
    padding-right:max(24px,calc((100vw - 1180px)/2))}
  .bt-scroll>*{max-width:1180px;margin-left:auto;margin-right:auto}
  .bt-footer .bt-nav{display:none}
  .bt-hero{border-radius:22px;margin:18px 24px 0;padding:34px 38px}
  .bt-hero-title{font-size:38px}
  .bt-products{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:12px 24px 0}
  .bt-products .bt-sec-title,.bt-products .bt-empty{grid-column:1/-1}
  .bt-card{margin-bottom:0}
  .bt-offers{padding:14px 24px 0}
  .bt-cats,.bt-filters{padding-left:24px;padding-right:24px}
  .bt-special-row{padding:0 24px}
  .bt-banners{padding:14px 24px 0}
}
@media(min-width:768px) and (max-width:1023px){
  .bt-products{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
  .bt-products .bt-sec-title,.bt-products .bt-empty{grid-column:1/-1}
  .bt-card{margin-bottom:0}
}

/* ── banners carousel ── */
.bt-banners{padding:12px 12px 0}
.bt-banner-track{display:flex;gap:12px;overflow-x:auto;scrollbar-width:none;
  scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}
.bt-banner-track::-webkit-scrollbar{display:none}
.bt-banner{flex:0 0 88%;max-width:520px;scroll-snap-align:start;border-radius:18px;
  overflow:hidden;position:relative;aspect-ratio:5/2;background:${C.dark};cursor:pointer}
@media(min-width:1024px){.bt-banner{flex:0 0 32%}}
.bt-banner img{width:100%;height:100%;object-fit:cover;display:block}
.bt-banner-title{position:absolute;left:14px;bottom:12px;color:#fff;font-weight:800;
  font-size:15px;text-shadow:0 2px 8px rgba(0,0,0,.55)}
.bt-banner-dots{display:flex;gap:5px;justify-content:center;padding-top:8px}
.bt-banner-dots i{width:6px;height:6px;border-radius:50%;background:${C.line};transition:.2s}
.bt-banner-dots i.on{background:${C.green};width:16px;border-radius:4px}

/* ── today's special ── */
.bt-special-head{display:flex;align-items:center;gap:8px;padding:16px 12px 8px;
  font-weight:900;font-size:16px;color:${C.ink};letter-spacing:.2px}
.bt-special-head .zap{font-size:18px;animation:pulseZap 1.6s infinite}
@keyframes pulseZap{0%,100%{transform:scale(1)}50%{transform:scale(1.25)}}
.bt-special-row{display:flex;gap:12px;overflow-x:auto;padding:2px 12px 4px;
  scrollbar-width:none;-webkit-overflow-scrolling:touch}
.bt-special-row::-webkit-scrollbar{display:none}
.bt-sp-card{flex:0 0 168px;background:#fff;border-radius:16px;overflow:hidden;
  border:1.5px solid transparent;position:relative;cursor:pointer;
  background-image:linear-gradient(#fff,#fff),linear-gradient(135deg,${C.orange},${C.green});
  background-origin:border-box;background-clip:padding-box,border-box;
  box-shadow:0 6px 18px rgba(22,96,71,.10)}
@media(min-width:1024px){.bt-sp-card{flex:0 0 200px}}
.bt-sp-img{height:110px;position:relative;background:${C.greenSoft}}
.bt-sp-img img{width:100%;height:100%;object-fit:cover;display:block}
.bt-sp-tag{position:absolute;top:8px;left:8px;background:linear-gradient(135deg,${C.orange},#f7a73a);
  color:#fff;font-size:9.5px;font-weight:900;padding:4px 8px;border-radius:999px;
  letter-spacing:.4px;box-shadow:0 3px 8px rgba(245,158,11,.4)}
.bt-sp-body{padding:9px 10px 11px}
.bt-sp-name{font-weight:800;font-size:12.5px;color:${C.ink};white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.bt-sp-price{display:flex;align-items:center;gap:6px;margin-top:4px;font-size:13px}
.bt-sp-price b{color:${C.greenDeep}}
.bt-sp-price s{color:${C.muted};font-size:11px}
.bt-sp-add{margin-top:8px;width:100%;border:1.5px solid ${C.green};background:${C.greenSoft};
  color:${C.greenDeep};font-weight:900;font-size:12px;border-radius:9px;padding:7px 0;cursor:pointer}
.bt-sp-add:active{transform:scale(.97)}

/* ── veg toggle (Swiggy style) ── */
.bt-vegtoggle{display:flex;align-items:center;gap:7px;border:1px solid ${C.line};
  background:#fff;border-radius:10px;padding:6px 10px;cursor:pointer;flex-shrink:0}
.bt-vegtoggle .lbl{font-size:11px;font-weight:800;color:${C.greenDeep};letter-spacing:.3px}
.bt-vegtoggle .sw{width:30px;height:16px;border-radius:999px;background:${C.line};
  position:relative;transition:.2s}
.bt-vegtoggle .sw i{position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;
  background:#fff;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.25)}
.bt-vegtoggle.on .sw{background:${C.green}}
.bt-vegtoggle.on .sw i{left:16px}

.brandmark{width:34px;height:34px;border-radius:9px;
  background:linear-gradient(135deg,${C.green},${C.orange});display:flex;
  align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px;flex-shrink:0}

.food-emoji{display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:34px;line-height:1}

/* ── header ── */
.bt-head{background:${C.dark};padding:14px 16px 16px;flex:0 0 auto;z-index:30}
.bt-head--page{padding:14px 12px}
.bt-head-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:0;gap:10px}
.bt-head .bt-search{margin-top:12px}
.bt-brand{display:flex;align-items:center;gap:9px;min-width:0}
.bt-brand-name{color:#fff;font-weight:700;font-size:15px;line-height:1}
.bt-loc{color:#8fb3a3;font-size:10px;margin-top:2px}
.bt-page-title{color:#fff;font-size:16px;font-weight:700;flex:1;text-align:center}
.bt-head-actions{display:flex;gap:8px;align-items:center;flex-shrink:0}
.bt-bhaiya-btn{border:none;cursor:pointer;border-radius:20px;
  background:linear-gradient(135deg,${C.orange},#f7a73a);color:#fff;
  font-size:11.5px;font-weight:800;padding:0 12px;height:36px;white-space:nowrap;
  display:flex;align-items:center;gap:4px;box-shadow:0 4px 12px rgba(245,158,11,.35)}
.bt-bhaiya-label{display:inline}
@media(max-width:360px){.bt-bhaiya-btn{padding:0 10px}.bt-bhaiya-label{display:none}}
.bt-icon-btn{width:36px;height:36px;border-radius:10px;border:none;
  background:rgba(255,255,255,.12);color:#fff;font-size:20px;cursor:pointer;
  display:flex;align-items:center;justify-content:center;transition:background .15s}
.bt-icon-btn:hover{background:rgba(255,255,255,.2)}
.bt-avatar-btn{width:36px;height:36px;border-radius:50%;border:none;
  background:linear-gradient(135deg,#a3c93a,${C.orange});color:#fff;font-size:15px;
  font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center}
.bt-search{width:100%;background:#fff;border:none;border-radius:12px;
  padding:11px 13px;display:flex;align-items:center;gap:8px;cursor:pointer;text-align:left}
.bt-search-ph{color:#9aa8a0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* ── hero ── */
.bt-hero{background:linear-gradient(135deg,${C.green},#3b8c3f);
  margin:12px;border-radius:18px;padding:16px}
.bt-veg-badge{display:inline-block;background:rgba(255,255,255,.2);color:#fff;
  font-size:10px;padding:3px 10px;border-radius:20px;margin-bottom:8px;letter-spacing:.5px}
.bt-hero-title{color:#fff;font-size:21px;font-weight:800;line-height:1.2;margin:0}
.bt-hero-sub{color:#eafdea;font-size:12px;margin:6px 0 0}

/* ── categories ── */
.bt-cats{padding:2px 0 0;max-width:100%}
.bt-cat-scroll{display:flex;gap:12px;overflow-x:auto;padding:8px 12px 4px;
  scrollbar-width:none;-webkit-overflow-scrolling:touch}
.bt-cat-scroll::-webkit-scrollbar{display:none}
.bt-cat{flex-shrink:0;background:none;border:none;cursor:pointer;text-align:center;padding:0}
.bt-cat-ic{width:60px;height:60px;border-radius:17px;display:flex;align-items:center;
  justify-content:center;font-size:27px;overflow:hidden;transition:transform .15s}
.bt-cat-ic img{width:100%;height:100%;object-fit:cover}
.bt-cat-ic .food-emoji{font-size:27px}
.bt-cat.on .bt-cat-ic{transform:scale(1.06);box-shadow:0 0 0 2.5px ${C.green}}
.bt-cat-lbl{display:block;font-size:11px;color:${C.ink};margin-top:5px;max-width:64px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt-cat.on .bt-cat-lbl{font-weight:700;color:${C.green}}

/* ── offers ── */
.bt-offers{display:flex;gap:10px;overflow-x:auto;padding:12px 12px 4px;
  scrollbar-width:none;-webkit-overflow-scrolling:touch}
.bt-offers::-webkit-scrollbar{display:none}
.bt-offer{flex-shrink:0;border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:10px;min-width:185px}
.bt-offer.dark{background:${C.dark}}
.bt-offer.soft{background:${C.orangeSoft}}
.bt-offer-ic{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;
  justify-content:center;color:#fff;font-size:16px;font-weight:700;flex-shrink:0}
.bt-offer.dark .bt-offer-t{color:#fff;font-size:13px;font-weight:700}
.bt-offer.dark .bt-offer-s{color:#8fb3a3;font-size:10px}
.bt-offer-t{font-size:13px;font-weight:700}
.bt-offer-s{font-size:10px}

/* ── filters ── */
.bt-filters{display:flex;gap:7px;overflow-x:auto;padding:10px 12px 2px;
  scrollbar-width:none;-webkit-overflow-scrolling:touch}
.bt-filters::-webkit-scrollbar{display:none}
.bt-chip{flex-shrink:0;font-size:11.5px;padding:6px 13px;border-radius:20px;
  border:1px solid ${C.line};background:#fff;color:${C.ink};cursor:pointer;font-weight:600;white-space:nowrap}
.bt-chip.on{background:${C.dark};color:#fff;border-color:${C.dark}}

/* ── products ── */
.bt-products{padding:12px 12px 0}
.bt-sec-title{font-size:16px;font-weight:800;margin:4px 0 12px}
.bt-card{display:flex;gap:12px;background:#fff;border:1px solid ${C.line};
  border-radius:15px;padding:10px;margin-bottom:11px}
.bt-card-img{width:92px;height:92px;border-radius:11px;background:${C.greenSoft};
  display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;overflow:hidden}
.bt-card-img img{width:100%;height:100%;object-fit:cover}
.bt-card-img .food-emoji{font-size:40px}
.veg-dot{position:absolute;top:6px;left:6px;width:15px;height:15px;border:1.5px solid ${C.green};
  border-radius:3px;background:#fff;display:flex;align-items:center;justify-content:center;z-index:2}
.veg-dot i{width:7px;height:7px;background:${C.green};border-radius:50%}
.veg-dot.sm{width:13px;height:13px}
.veg-dot.sm i{width:6px;height:6px}
.bt-card-off{position:absolute;bottom:6px;left:6px;background:${C.orange};color:#fff;
  font-size:9px;font-weight:800;padding:2px 6px;border-radius:5px;z-index:2}
.bt-card-body{flex:1;min-width:0;display:flex;flex-direction:column}
.bt-card-name{font-size:14px;font-weight:700}
.bt-card-name-link{color:inherit}
.bt-card-desc{font-size:11px;color:${C.muted};margin:2px 0 6px;
  display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.bt-card-tags{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:7px}
.tag{font-size:9px;background:${C.bg};color:${C.muted};padding:2px 6px;border-radius:5px;font-weight:600;white-space:nowrap}
.tag.green{background:${C.greenSoft};color:#2e7d32}
.tag.orange{background:${C.orangeSoft};color:#b76e00}
.bt-card-foot{display:flex;align-items:center;justify-content:space-between;margin-top:auto;gap:8px}
.bt-price b{font-size:15px;font-weight:800}
.bt-price s{font-size:11px;color:#9aa8a0;margin-left:6px}
.bt-add{background:${C.green};color:#fff;border:none;font-size:12px;font-weight:700;
  padding:7px 18px;border-radius:9px;cursor:pointer;letter-spacing:.5px;flex-shrink:0}
.bt-qty{display:flex;align-items:center;gap:10px;background:${C.green};border-radius:9px;padding:5px 11px;flex-shrink:0}
.bt-qty button{background:none;border:none;color:#fff;font-size:17px;cursor:pointer;line-height:1;width:14px}
.bt-qty span{color:#fff;font-weight:700;font-size:13px;min-width:12px;text-align:center}
.bt-empty{background:#fff;border:1px dashed ${C.line};border-radius:14px;padding:32px 18px;
  text-align:center;color:${C.muted};font-size:13px}

/* ── skeletons ── */
.skel{background:linear-gradient(90deg,#eef2ee 25%,#e3e9e3 50%,#eef2ee 75%);
  background-size:200% 100%;animation:sh 1.3s infinite}
.skel-txt{height:11px;border-radius:5px;margin:5px 0;
  background:linear-gradient(90deg,#eef2ee 25%,#e3e9e3 50%,#eef2ee 75%);
  background-size:200% 100%;animation:sh 1.3s infinite}
@keyframes sh{0%{background-position:200% 0}100%{background-position:-200% 0}}

/* ── footer (cart bar + nav) ── */
.bt-footer{flex:0 0 auto;position:relative;z-index:25}
.bt-cartbar{background:${C.green};padding:12px 18px;display:flex;
  align-items:center;justify-content:space-between;animation:slideUpBar .4s ease}
.bt-cartbar-c{color:#eafdea;font-size:11px}
.bt-cartbar-t{color:#fff;font-weight:800;font-size:16px}
.bt-cartbar-btn{background:${C.orange};color:#fff;border:none;font-weight:800;
  padding:10px 20px;border-radius:22px;cursor:pointer;font-size:13px}
.bt-nav{background:#fff;border-top:1px solid ${C.line};display:flex;justify-content:space-around;
  padding:8px 0 10px}
.bt-nav-i{background:none;border:none;cursor:pointer;display:flex;flex-direction:column;
  align-items:center;gap:1px;color:#9aa8a0;font-size:9px;position:relative}
.bt-nav-ic{font-size:19px;position:relative;display:inline-block}
.bt-nav-i.on{color:${C.green}}
.bt-nav-badge{position:absolute;top:-6px;right:-10px;background:${C.orange};color:#fff;
  font-style:normal;font-size:9px;font-weight:700;min-width:15px;height:15px;border-radius:8px;
  display:flex;align-items:center;justify-content:center;padding:0 3px}

/* ── generic page bits ── */
.bt-page-pad{padding:14px 12px}
.bt-section-h{font-size:15px;font-weight:800;margin:18px 12px 10px}

/* ── product detail ── */
.pd-hero{position:relative;width:100%;aspect-ratio:1/1;max-height:340px;background:${C.greenSoft};
  display:flex;align-items:center;justify-content:center;overflow:hidden}
.pd-hero img{width:100%;height:100%;object-fit:cover}
.pd-hero .food-emoji{font-size:120px}
.pd-hero-off{position:absolute;top:14px;left:14px;background:${C.orange};color:#fff;
  font-size:12px;font-weight:800;padding:5px 12px;border-radius:8px}
.pd-veg{position:absolute;top:14px;right:14px;width:22px;height:22px;border:2px solid ${C.green};
  border-radius:4px;background:#fff;display:flex;align-items:center;justify-content:center}
.pd-veg i{width:10px;height:10px;background:${C.green};border-radius:50%}
.pd-body{padding:16px 16px 0}
.pd-name{font-size:22px;font-weight:800;line-height:1.2}
.pd-rating{display:inline-flex;align-items:center;gap:4px;background:${C.greenSoft};
  color:${C.greenDeep};font-size:12px;font-weight:700;padding:3px 9px;border-radius:8px;margin-top:8px}
.pd-desc{font-size:13.5px;color:#3a5a4d;line-height:1.5;margin:12px 0 4px}
.pd-price{display:flex;align-items:baseline;gap:10px;margin:14px 0 4px}
.pd-price b{font-size:26px;font-weight:800}
.pd-price s{font-size:15px;color:#9aa8a0}
.pd-price .pd-save{font-size:12px;font-weight:800;color:${C.greenDeep};background:${C.greenSoft};
  padding:3px 9px;border-radius:7px}
.pd-macros{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0 6px}
.pd-macro{background:#fff;border:1px solid ${C.line};border-radius:13px;padding:12px 6px;text-align:center}
.pd-macro b{display:block;font-size:17px;font-weight:800;color:${C.ink}}
.pd-macro span{font-size:10px;color:${C.muted}}
.pd-macro.cal b{color:${C.orange}}
.pd-macro.pro b{color:${C.green}}

/* ── cart ── */
.cart-item{display:flex;gap:12px;background:#fff;border:1px solid ${C.line};
  border-radius:15px;padding:10px;margin-bottom:11px;align-items:center}
.cart-item-img{width:70px;height:70px;border-radius:11px;background:${C.greenSoft};
  display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;position:relative}
.cart-item-img img{width:100%;height:100%;object-fit:cover}
.cart-item-img .food-emoji{font-size:30px}
.cart-item-info{flex:1;min-width:0}
.cart-item-name{font-size:14px;font-weight:700}
.cart-item-price{font-size:13px;color:${C.muted};margin-top:2px}
.cart-item-price b{color:${C.ink}}
.cart-remove{background:none;border:none;color:#c0392b;font-size:11px;cursor:pointer;margin-top:4px;padding:0}
.bill{background:#fff;border:1px solid ${C.line};border-radius:15px;padding:14px;margin-top:6px}
.bill-row{display:flex;justify-content:space-between;font-size:13px;color:#3a5a4d;margin-bottom:8px}
.bill-row.free{color:${C.green};font-weight:700}
.bill-hr{border:none;border-top:1px dashed ${C.line};margin:10px 0}
.bill-total{display:flex;justify-content:space-between;font-size:16px;font-weight:800;color:${C.ink}}
.coupon{display:flex;gap:8px;align-items:center;background:${C.orangeSoft};border:1px dashed ${C.orange};
  border-radius:12px;padding:10px 12px;margin:12px 0;font-size:12px;color:${C.orangeDeep};font-weight:700}
.checkout-bar{padding:12px 16px;background:#fff;border-top:1px solid ${C.line};
  display:flex;align-items:center;justify-content:space-between;gap:12px}
.checkout-total b{font-size:18px;font-weight:800}
.checkout-total span{display:block;font-size:11px;color:${C.muted}}
.checkout-btn{flex:1;max-width:200px;background:linear-gradient(135deg,${C.green},${C.greenDeep});
  color:#fff;border:none;font-size:15px;font-weight:800;padding:13px;border-radius:13px;cursor:pointer;
  box-shadow:0 6px 16px rgba(76,175,80,.35)}

/* ── orders ── */
.order-card{background:#fff;border:1px solid ${C.line};border-radius:15px;padding:14px;margin-bottom:12px}
.order-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
.order-id{font-size:13px;font-weight:800}
.order-date{font-size:11px;color:${C.muted};margin-top:2px}
.order-status{font-size:10px;font-weight:800;padding:4px 10px;border-radius:20px;white-space:nowrap}
.order-status.placed{background:${C.orangeSoft};color:${C.orangeDeep}}
.order-status.preparing{background:${C.orangeSoft};color:${C.orangeDeep}}
.order-status.on_the_way{background:#e3f2fd;color:#1565c0}
.order-status.delivered{background:${C.greenSoft};color:${C.greenDeep}}
.order-items{display:flex;flex-direction:column;gap:6px}
.order-line{display:flex;justify-content:space-between;font-size:12.5px;color:#3a5a4d}
.order-foot{display:flex;justify-content:space-between;align-items:center;
  border-top:1px dashed ${C.line};margin-top:10px;padding-top:10px}
.order-total{font-size:14px;font-weight:800}
.order-reorder{background:${C.greenSoft};color:${C.greenDeep};border:none;font-size:12px;
  font-weight:700;padding:7px 14px;border-radius:9px;cursor:pointer}

/* ── menu page ── */
.menu-jump{display:flex;gap:7px;overflow-x:auto;padding:10px 12px;scrollbar-width:none;
  position:sticky;top:0;background:${C.bg};z-index:5}
.menu-jump::-webkit-scrollbar{display:none}
.menu-jump-chip{flex-shrink:0;font-size:11.5px;padding:6px 13px;border-radius:20px;
  border:1px solid ${C.line};background:#fff;color:${C.ink};cursor:pointer;font-weight:600;white-space:nowrap}
.menu-jump-chip.on{background:${C.dark};color:#fff;border-color:${C.dark}}
.menu-cat-h{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:800;
  margin:18px 12px 10px;scroll-margin-top:60px}
.menu-cat-h .cnt{font-size:11px;font-weight:600;color:${C.muted}}

/* toast */
.toast{position:absolute;bottom:78px;left:50%;transform:translateX(-50%);
  background:${C.dark};color:#fff;font-size:13px;font-weight:600;padding:11px 18px;border-radius:24px;
  box-shadow:0 10px 30px rgba(0,0,0,.3);z-index:50;animation:toastIn .3s ease;white-space:nowrap}

/* keyframes */
@keyframes slideUpBar{0%{transform:translateY(100px)}100%{transform:translateY(0)}}
@keyframes toastIn{0%{transform:translate(-50%,20px);opacity:0}100%{transform:translate(-50%,0);opacity:1}}
@keyframes fadeIn{0%{opacity:0}100%{opacity:1}}

@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
    `}</style>
  );
}
