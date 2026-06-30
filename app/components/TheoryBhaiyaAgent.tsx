'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Product,
  AVATAR_FACE,
  money,
  catEmoji,
  effectivePrice,
  hasOffer,
  offerPct,
  C,
} from '../lib/bite';
import FoodImage from './FoodImage';

export interface BhaiyaLine {
  greet: string;
  push: string;
}

export const BHAIYA_LINES: BhaiyaLine[] = [
  { greet: 'Aur bhaiyooo, kaise ho? 😄', push: 'Ye try kiya? Ek number hai —' },
  { greet: 'Bhaiyyaaa, bhookh lagi kya? 😋', push: 'Hamare yaha ka ye dekho —' },
  { greet: 'Aaiye aaiye! 🙏', push: 'Aaj ye special bana hai —' },
  { greet: 'Arre wah, aap aa gaye! 🤩', push: 'Ye to aapke liye perfect hai —' },
];

export default function TheoryBhaiyaAgent({
  product,
  line,
  inCart,
  hasCart,
  onOrder,
  onClose,
}: {
  product: Product;
  line: BhaiyaLine;
  inCart: boolean;
  hasCart: boolean;
  onOrder: () => void;
  onClose: () => void;
}) {
  const [faceFailed, setFaceFailed] = useState(false);
  const router = useRouter();
  const off = hasOffer(product);

  return (
    <div
      className={`agent-wrap ${hasCart ? 'has-cart' : ''}`}
      role="dialog"
      aria-label="Today's special"
    >
      <div className="agent-card">
        <div className="agent-ribbon">
          <span className="agent-spark">✨</span> TODAY&apos;S SPECIAL
        </div>

        <div className="agent-head">
          <span className="agent-face">
            {faceFailed ? (
              <span className="agent-face-fb">🧑‍🍳</span>
            ) : (
              <img
                src={AVATAR_FACE}
                alt="Theory Bhaiya"
                onError={() => setFaceFailed(true)}
              />
            )}
          </span>
          <div className="agent-id">
            <div className="agent-name">Theory Bhaiya</div>
            <div className="agent-online">
              <i className="dot" /> online · aapke liye
            </div>
          </div>
          <button className="agent-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="agent-body">
          <div className="agent-bubble">
            <div className="agent-greet">{line.greet}</div>
            <div className="agent-push">
              {line.push} <b>{product.name}</b> 🍛
            </div>
          </div>

          <div
            className="agent-prod"
            onClick={() => router.push(`/product/${product.id}`)}
            style={{ cursor: 'pointer' }}
          >
            <div className="agent-prod-img">
              <FoodImage
                src={product.image}
                alt={product.name}
                emoji={catEmoji(product.name)}
              />
              <span className="veg-dot sm">
                <i />
              </span>
            </div>
            <div className="agent-prod-info">
              <div className="agent-prod-name">{product.name}</div>
              <div className="agent-prod-tags">
                {product.calories > 0 && (
                  <span className="tag">{product.calories} cal</span>
                )}
                {product.protein > 0 && (
                  <span className="tag green">{product.protein}g protein</span>
                )}
              </div>
              <div className="agent-prod-price">
                <b>{money(effectivePrice(product))}</b>
                {off && <s>{money(product.price)}</s>}
                {off && <span className="agent-off">{offerPct(product)}% OFF</span>}
              </div>
            </div>
          </div>

          <div className="agent-actions">
            <button className="agent-order" onClick={onOrder}>
              {inCart ? 'Add one more 🛒' : 'Order Now 🛒'}
            </button>
            <button
              className="agent-see"
              onClick={() => router.push(`/product/${product.id}`)}
            >
              Dekho →
            </button>
          </div>
        </div>
      </div>

      <style>{`
.agent-wrap{position:absolute;left:0;right:0;bottom:70px;padding:0 12px;z-index:26;pointer-events:none}
.agent-wrap.has-cart{bottom:122px}
.agent-card{pointer-events:auto;background:#fff;border-radius:20px;
  box-shadow:0 18px 50px rgba(13,59,46,.30);overflow:hidden;
  animation:popIn .5s cubic-bezier(.2,.9,.3,1.2);border:1px solid #d9efdc}
.agent-ribbon{background:linear-gradient(90deg,${C.orange},#f7a73a);color:#fff;font-size:10.5px;font-weight:800;
  letter-spacing:.8px;padding:5px 14px;display:flex;align-items:center;gap:6px}
.agent-spark{font-size:11px}
.agent-head{background:linear-gradient(135deg,${C.green},#3b8c3f);padding:10px 13px;display:flex;align-items:center;gap:10px}
.agent-face{width:34px;height:34px;border-radius:50%;background:#fff;overflow:hidden;flex-shrink:0;
  animation:bob 2.4s ease-in-out infinite;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.18)}
.agent-face img{width:100%;height:100%;object-fit:cover}
.agent-face-fb{font-size:19px}
.agent-id{flex:1;min-width:0}
.agent-name{color:#fff;font-size:13px;font-weight:700}
.agent-online{color:#d6f5e0;font-size:9px;display:flex;align-items:center;gap:4px}
.agent-online .dot{width:6px;height:6px;border-radius:50%;background:#aef5c0;display:inline-block;animation:pulseDot 1.6s ease-in-out infinite}
.agent-x{background:rgba(255,255,255,.18);border:none;color:#fff;font-size:13px;width:24px;height:24px;border-radius:50%;
  cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.agent-body{padding:12px 13px}
.agent-bubble{background:${C.bg};border-radius:13px 13px 13px 4px;padding:10px 12px;margin-bottom:10px}
.agent-greet{font-size:13.5px;color:${C.ink};font-weight:700}
.agent-push{font-size:12px;color:#3a5a4d;margin-top:2px}
.agent-prod{display:flex;gap:11px;background:#fff;border:1.5px solid ${C.greenSoft};border-radius:14px;padding:9px;align-items:center}
.agent-prod-img{width:58px;height:58px;border-radius:12px;background:${C.orangeSoft};display:flex;align-items:center;
  justify-content:center;flex-shrink:0;position:relative;overflow:hidden}
.agent-prod-img img{width:100%;height:100%;object-fit:cover}
.agent-prod-img .food-emoji{font-size:28px}
.agent-prod-info{flex:1;min-width:0}
.agent-prod-name{font-size:13px;font-weight:700;color:${C.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.agent-prod-tags{display:flex;gap:4px;margin:3px 0 4px;flex-wrap:wrap}
.agent-prod-price{display:flex;align-items:center;flex-wrap:wrap}
.agent-prod-price b{font-size:15px;font-weight:800}
.agent-prod-price s{font-size:10px;color:#9aa8a0;margin-left:5px}
.agent-off{font-size:8.5px;background:${C.orangeSoft};color:${C.orangeDeep};padding:2px 6px;border-radius:5px;font-weight:800;margin-left:6px}
.agent-actions{display:flex;gap:8px;margin-top:11px}
.agent-order{flex:1;background:linear-gradient(135deg,${C.green},${C.greenDeep});color:#fff;border:none;font-size:13px;
  font-weight:800;padding:11px;border-radius:11px;cursor:pointer;box-shadow:0 6px 16px rgba(76,175,80,.35)}
.agent-see{background:#fff;color:${C.ink};border:1.5px solid ${C.line};font-size:13px;font-weight:700;padding:11px 15px;border-radius:11px;cursor:pointer}
@keyframes popIn{0%{transform:translateY(40px) scale(.96);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
@keyframes pulseDot{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
      `}</style>
    </div>
  );
}
