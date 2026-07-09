'use client';

/**
 * DesktopApp — the full-width desktop ordering layout (sidebar · grid · cart).
 * Shown only on wide screens after the visitor enters the app; mobile is
 * untouched. Wired to the real catalog (useCatalog) and cart (useCart), so
 * add/remove/checkout behave exactly like the mobile app.
 *
 * Rendered from app/page.tsx only, so /admin and /rider never mount it.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCatalog } from '../lib/useCatalog';
import { useCart } from '../providers/CartProvider';
import { C, money, effectivePrice, hasOffer, Product } from '../lib/bite';
import { useStoreSettings } from '../lib/useStoreSettings';
import { useMenu } from './MenuProvider';

type Sort = 'pop' | 'protein' | 'lowcal' | 'cheap';

export default function DesktopApp({
  onOpenProfile,
}: {
  onOpenProfile?: () => void;
}) {
  const router = useRouter();
  const { openMenu } = useMenu();
  const openProfile = onOpenProfile || openMenu;
  const { products, categories, loading } = useCatalog();
  const { settings } = useStoreSettings();
  const { cart, add, sub, count, totalFor } = useCart();

  const [activeCat, setActiveCat] = useState<number | 'all'>('all');
  const [sort, setSort] = useState<Sort>('pop');
  const [vegOnly, setVegOnly] = useState(true);
  const [q, setQ] = useState('');

  const shown = useMemo(() => {
    let list = products.filter((p) => (p.stockStatus ?? 'in_stock') !== 'out_of_stock');
    if (vegOnly) list = list.filter((p) => p.isVeg);
    if (activeCat !== 'all') list = list.filter((p) => p.categoryId === activeCat);
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(t) || p.description?.toLowerCase().includes(t));
    }
    const arr = [...list];
    if (sort === 'protein') arr.sort((a, b) => (b.protein || 0) - (a.protein || 0));
    else if (sort === 'lowcal') arr.sort((a, b) => (a.calories || 0) - (b.calories || 0));
    else if (sort === 'cheap') arr.sort((a, b) => effectivePrice(a) - effectivePrice(b));
    return arr;
  }, [products, vegOnly, activeCat, q, sort]);

  const cartLines = useMemo(
    () => Object.entries(cart)
      .map(([id, qty]) => ({ p: products.find((x) => x.id === Number(id)), qty }))
      .filter((l) => l.p) as { p: Product; qty: number }[],
    [cart, products],
  );

  const subtotal = totalFor(products);
  const freeAbove = Number(settings.freeDeliveryAbove || 0);
  const deliveryFree = freeAbove > 0 && subtotal >= freeAbove;
  const deliveryCharge = deliveryFree ? 0 : Number(settings.deliveryCharge || 0);
  const total = subtotal + deliveryCharge;

  return (
    <div className="da-root">
      {/* ── TOP BAR ── */}
      <header className="da-top">
        <div className="da-logo">B</div>
        <div className="da-brand">Bite Theory <span>· Indore</span></div>
        <div className="da-search">
          <span>🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search thali, healthy meals, snacks…"
          />
          {q && <button className="da-search-x" onClick={() => setQ('')}>✕</button>}
        </div>
        <button className="da-avatar" onClick={openProfile} aria-label="Profile">S</button>
      </header>

      <div className="da-body">
        {/* ── LEFT: CATEGORIES ── */}
        <aside className="da-side">
          <div className="da-side-h">CATEGORIES</div>
          <div className="da-cats">
            <button
              className={`da-cat ${activeCat === 'all' ? 'on' : ''}`}
              onClick={() => setActiveCat('all')}
            >🍽️ All</button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={`da-cat ${activeCat === c.id ? 'on' : ''}`}
                onClick={() => setActiveCat(c.id)}
              >
                <span>{c.emoji || '🍴'}</span> {c.name}
              </button>
            ))}
          </div>
          <div className="da-veg">
            <div className="da-veg-top">
              <span className="da-veg-badge">VEG</span>
              <span>Pure veg only</span>
            </div>
            <button
              className={`da-toggle ${vegOnly ? 'on' : ''}`}
              onClick={() => setVegOnly((v) => !v)}
              aria-label="Toggle veg only"
            >
              <span className="da-knob" />
            </button>
          </div>
        </aside>

        {/* ── CENTER: PRODUCTS ── */}
        <main className="da-main">
          <div className="da-toolbar">
            <div className="da-title">
              {activeCat === 'all' ? 'Popular near you'
                : categories.find((c) => c.id === activeCat)?.name || 'Menu'}
              <span className="da-count-mini">{shown.length} items</span>
            </div>
            <div className="da-sorts">
              {([['pop', 'Popular'], ['protein', 'High protein'], ['lowcal', 'Under 400 cal'], ['cheap', 'Cheapest']] as [Sort, string][])
                .map(([k, label]) => (
                  <button
                    key={k}
                    className={`da-sort ${sort === k ? 'on' : ''}`}
                    onClick={() => setSort(k)}
                  >{label}</button>
                ))}
            </div>
          </div>

          {loading ? (
            <div className="da-empty">Loading menu…</div>
          ) : shown.length === 0 ? (
            <div className="da-empty">Nothing here yet. Try another category.</div>
          ) : (
            <div className="da-grid">
              {shown.map((p) => {
                const qty = cart[p.id] || 0;
                const off = hasOffer(p);
                return (
                  <div key={p.id} className="da-card">
                    <div
                      className="da-card-img"
                      onClick={() => router.push(`/product/${p.id}`)}
                    >
                      {p.image ? <img src={p.image} alt={p.name} /> : <span>🍛</span>}
                      {off && <span className="da-card-off">{Math.round((1 - effectivePrice(p) / p.price) * 100)}% OFF</span>}
                      {p.specialTag && <span className="da-card-tag">{p.specialTag}</span>}
                    </div>
                    <div className="da-card-body">
                      <div className="da-card-name" onClick={() => router.push(`/product/${p.id}`)}>{p.name}</div>
                      <div className="da-card-meta">
                        {p.isVeg && '🟢 '}
                        {p.protein ? `${p.protein}g protein` : p.calories ? `${p.calories} cal` : 'pure veg'}
                      </div>
                      <div className="da-card-foot">
                        <div className="da-card-price">
                          {money(effectivePrice(p))}
                          {off && <span className="da-strike">{money(p.price)}</span>}
                        </div>
                        {qty === 0 ? (
                          <button className="da-add" onClick={() => add(p.id)}>ADD +</button>
                        ) : (
                          <div className="da-stepper">
                            <button onClick={() => sub(p.id)}>−</button>
                            <span>{qty}</span>
                            <button onClick={() => add(p.id)}>+</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* ── RIGHT: CART RAIL ── */}
        <aside className="da-cart-rail">
          <div className="da-cart">
            <div className="da-cart-h">
              🛒 Your cart
              {count > 0 && <span className="da-cart-count">{count} item{count > 1 ? 's' : ''}</span>}
            </div>
            {cartLines.length === 0 ? (
              <div className="da-cart-empty">
                <div style={{ fontSize: 34 }}>🛒</div>
                <div>Your cart is empty</div>
                <div className="da-cart-empty-sub">Add something tasty to get started.</div>
              </div>
            ) : (
              <>
                <div className="da-cart-list">
                  {cartLines.map(({ p, qty }) => (
                    <div key={p.id} className="da-cart-item">
                      <div className="da-cart-img">
                        {p.image ? <img src={p.image} alt={p.name} /> : <span>🍛</span>}
                      </div>
                      <div className="da-cart-info">
                        <div className="da-cart-name">{p.name}</div>
                        <div className="da-cart-price">{money(effectivePrice(p))}</div>
                      </div>
                      <div className="da-stepper sm">
                        <button onClick={() => sub(p.id)}>−</button>
                        <span>{qty}</span>
                        <button onClick={() => add(p.id)}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="da-cart-foot">
                  <div className="da-cart-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
                  <div className="da-cart-row">
                    <span>Delivery</span>
                    <span>{deliveryCharge === 0 ? <b style={{ color: '#2e7d32' }}>FREE</b> : money(deliveryCharge)}</span>
                  </div>
                  {!deliveryFree && freeAbove > subtotal && (
                    <div className="da-cart-hint">Add {money(freeAbove - subtotal)} more for free delivery 🎉</div>
                  )}
                  <div className="da-cart-total"><span>Total</span><span>{money(total)}</span></div>
                  <button className="da-checkout" onClick={() => router.push('/cart')}>Checkout →</button>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      <style jsx>{`
        .da-root { min-height: 100vh; background: ${C.bg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .da-top { position: sticky; top: 0; z-index: 20; background: ${C.dark}; color: #fff; padding: 12px 24px; display: flex; align-items: center; gap: 16px; }
        .da-logo { width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, ${C.green}, ${C.orange}); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; }
        .da-brand { font-weight: 800; font-size: 17px; white-space: nowrap; }
        .da-brand span { font-size: 11px; color: #8fb3a3; font-weight: 500; }
        .da-search { flex: 1; max-width: 520px; background: #fff; border-radius: 12px; display: flex; align-items: center; padding: 0 12px; height: 42px; gap: 8px; }
        .da-search span { color: #9fb0a8; }
        .da-search input { flex: 1; border: none; outline: none; font-size: 14px; color: ${C.ink}; background: none; }
        .da-search-x { background: none; border: none; color: #9fb0a8; cursor: pointer; font-size: 13px; }
        .da-avatar { width: 38px; height: 38px; border-radius: 50%; border: none; background: linear-gradient(135deg, #a3c93a, ${C.orange}); color: #fff; font-weight: 800; font-size: 15px; cursor: pointer; margin-left: auto; }

        .da-body { display: grid; grid-template-columns: 220px minmax(0, 1fr) 320px; align-items: start; max-width: 1500px; margin: 0 auto; }
        @media (max-width: 1180px) { .da-body { grid-template-columns: 200px minmax(0, 1fr) 300px; } }

        .da-side { background: #fff; border-right: 1px solid ${C.line}; padding: 18px 12px; min-height: calc(100vh - 62px); position: sticky; top: 62px; }
        .da-side-h { font-size: 11px; font-weight: 800; color: #9aaba1; letter-spacing: .06em; padding: 0 8px 8px; }
        .da-cats { display: flex; flex-direction: column; gap: 2px; }
        .da-cat { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; color: ${C.dark}; font-size: 13px; font-weight: 600; background: none; border: none; cursor: pointer; text-align: left; transition: background .15s; }
        .da-cat:hover { background: #f2f6f3; }
        .da-cat.on { background: ${C.greenSoft}; color: ${C.greenDeep}; font-weight: 800; }
        .da-veg { margin-top: 16px; background: ${C.dark}; border-radius: 14px; padding: 14px; color: #fff; }
        .da-veg-top { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; }
        .da-veg-badge { background: ${C.orange}; border-radius: 6px; padding: 2px 6px; font-size: 10px; font-weight: 800; }
        .da-toggle { width: 40px; height: 22px; background: rgba(255,255,255,.2); border-radius: 20px; margin-top: 10px; position: relative; border: none; cursor: pointer; transition: background .2s; }
        .da-toggle.on { background: ${C.green}; }
        .da-knob { position: absolute; left: 2px; top: 2px; width: 18px; height: 18px; background: #fff; border-radius: 50%; transition: left .2s; }
        .da-toggle.on .da-knob { left: 20px; }

        .da-main { padding: 20px 22px; }
        .da-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
        .da-title { font-weight: 900; font-size: 19px; color: ${C.dark}; display: flex; align-items: center; gap: 10px; }
        .da-count-mini { font-size: 12px; font-weight: 700; color: #9aaba1; }
        .da-sorts { display: flex; gap: 8px; flex-wrap: wrap; }
        .da-sort { background: #fff; border: 1px solid ${C.line}; color: ${C.dark}; font-size: 12px; font-weight: 600; padding: 7px 14px; border-radius: 20px; cursor: pointer; }
        .da-sort.on { background: ${C.dark}; color: #fff; border-color: ${C.dark}; }

        .da-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; }
        .da-card { background: #fff; border: 1px solid ${C.line}; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; transition: transform .15s, box-shadow .15s; }
        .da-card:hover { transform: translateY(-3px); box-shadow: 0 12px 26px rgba(13,59,46,.1); }
        .da-card-img { height: 120px; background: linear-gradient(135deg, #fff3d6, #ffe0a3); display: flex; align-items: center; justify-content: center; font-size: 44px; position: relative; cursor: pointer; overflow: hidden; }
        .da-card-img img { width: 100%; height: 100%; object-fit: cover; }
        .da-card-off { position: absolute; left: 8px; bottom: 8px; background: ${C.dark}; color: #fff; font-size: 10px; font-weight: 800; padding: 3px 7px; border-radius: 6px; }
        .da-card-tag { position: absolute; left: 8px; top: 8px; background: ${C.orange}; color: #fff; font-size: 10px; font-weight: 800; padding: 3px 7px; border-radius: 6px; }
        .da-card-body { padding: 12px; display: flex; flex-direction: column; flex: 1; }
        .da-card-name { font-weight: 800; color: ${C.dark}; font-size: 14px; cursor: pointer; line-height: 1.3; }
        .da-card-meta { font-size: 11px; color: ${C.muted}; margin: 3px 0 10px; }
        .da-card-foot { display: flex; justify-content: space-between; align-items: center; margin-top: auto; }
        .da-card-price { font-weight: 900; color: ${C.dark}; font-size: 15px; }
        .da-strike { color: #9aaba1; text-decoration: line-through; font-size: 11px; font-weight: 600; margin-left: 5px; }
        .da-add { background: ${C.green}; color: #fff; border: none; padding: 8px 16px; border-radius: 9px; font-weight: 800; font-size: 12px; cursor: pointer; }
        .da-add:hover { background: ${C.greenDeep}; }
        .da-stepper { display: flex; align-items: center; gap: 10px; background: ${C.greenSoft}; border-radius: 9px; padding: 5px 10px; }
        .da-stepper button { background: none; border: none; color: ${C.greenDeep}; font-weight: 800; font-size: 15px; cursor: pointer; line-height: 1; }
        .da-stepper span { font-weight: 800; font-size: 13px; color: ${C.dark}; min-width: 12px; text-align: center; }
        .da-stepper.sm { padding: 3px 8px; gap: 8px; }

        .da-cart-rail { padding: 20px 18px 20px 0; }
        .da-cart { background: #fff; border: 1px solid ${C.line}; border-radius: 16px; overflow: hidden; position: sticky; top: 82px; display: flex; flex-direction: column; max-height: calc(100vh - 104px); }
        .da-cart-h { background: ${C.dark}; color: #fff; padding: 14px 16px; font-weight: 800; font-size: 15px; display: flex; align-items: center; gap: 8px; }
        .da-cart-count { background: ${C.orange}; font-size: 11px; padding: 2px 8px; border-radius: 10px; margin-left: auto; }
        .da-cart-empty { padding: 40px 20px; text-align: center; color: ${C.muted}; }
        .da-cart-empty > div:nth-child(2) { font-weight: 800; color: ${C.dark}; margin-top: 8px; }
        .da-cart-empty-sub { font-size: 12px; margin-top: 4px; }
        .da-cart-list { flex: 1; overflow-y: auto; padding: 6px 14px; }
        .da-cart-item { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f2f6f3; align-items: center; }
        .da-cart-item:last-child { border-bottom: none; }
        .da-cart-img { width: 40px; height: 40px; border-radius: 9px; background: linear-gradient(135deg, #fff3d6, #ffe0a3); display: flex; align-items: center; justify-content: center; font-size: 20px; overflow: hidden; flex-shrink: 0; }
        .da-cart-img img { width: 100%; height: 100%; object-fit: cover; }
        .da-cart-info { flex: 1; min-width: 0; }
        .da-cart-name { font-weight: 700; font-size: 13px; color: ${C.dark}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .da-cart-price { font-size: 11px; color: ${C.muted}; }
        .da-cart-foot { padding: 12px 16px; background: #f9fbfa; border-top: 1px solid #f2f6f3; }
        .da-cart-row { display: flex; justify-content: space-between; font-size: 12px; color: ${C.muted}; margin-bottom: 5px; }
        .da-cart-hint { font-size: 11px; color: ${C.orangeDeep}; background: ${C.orangeSoft}; border-radius: 8px; padding: 6px 10px; margin: 6px 0; text-align: center; font-weight: 600; }
        .da-cart-total { display: flex; justify-content: space-between; font-weight: 900; font-size: 16px; color: ${C.dark}; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #d6e0da; }
        .da-checkout { width: 100%; margin-top: 12px; background: linear-gradient(135deg, ${C.orange}, #f7a73a); color: #fff; border: none; padding: 13px; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; box-shadow: 0 8px 20px rgba(245,158,11,.35); }
        .da-empty { padding: 60px 20px; text-align: center; color: ${C.muted}; font-size: 14px; }
      `}</style>
    </div>
  );
}
