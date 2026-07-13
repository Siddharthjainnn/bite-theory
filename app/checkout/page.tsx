'use client';

/**
 * /checkout — Swiggy-style checkout.
 * 1. Deliver-to: saved addresses (from API) or add-new via MapPicker.
 * 2. Coupon: validated server-side against subtotal.
 * 3. Wallet toggle (balance from session).
 * 4. Payment: COD now, online placeholder.
 * 5. Place order → POST /orders/checkout → /orders/[id] live tracking.
 */
import { useFlashDeal } from '../components/FlashDealBar';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppShell from '../components/AppShell';
import AppHeader from '../components/AppHeader';
import MapPicker, { PickedLocation } from '../components/MapPicker';
import { useCart } from '../providers/CartProvider';
import { useCatalog } from '../lib/useCatalog';
import {
  C, money, effectivePrice,
  SavedAddress, fetchAddresses, createAddress, validateCoupon, checkoutOrder, createPaymentOrder,
} from '../lib/bite';
import { openRazorpay } from '../lib/razorpay';
import { useStoreSettings } from '../lib/useStoreSettings';
import StoreClosedBanner from '../components/StoreClosedBanner';

export default function CheckoutPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { cart, thalis, removeThali, clear } = useCart();
  const { products, loading: catLoading } = useCatalog();

  const user = session?.user as any;
  const userId: number | undefined = user?.id ? Number(user.id) : undefined;
  const walletBalance: number = Number(user?.walletBalance || 0);

  /* ── cart lines ── */
  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => {
          const p = products.find((x) => x.id === Number(id));
          return p ? { p, qty } : null;
        })
        .filter(Boolean) as { p: (typeof products)[number]; qty: number }[],
    [cart, products],
  );
  const subtotal = lines.reduce((s, l) => s + effectivePrice(l.p) * l.qty, 0)
    + thalis.reduce((s, t) => s + t.total, 0);

  /* ── addresses ── */
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddr, setSelectedAddr] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [newAddr, setNewAddr] = useState({ label: 'Home', fullAddress: '', landmark: '' });
  const [savingAddr, setSavingAddr] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetchAddresses(userId)
      .then((rows) => {
        setAddresses(rows);
        const def = rows.find((a) => a.isDefault) || rows[0];
        if (def) setSelectedAddr(Number(def.id));
        else setAddingNew(true);
      })
      .catch(() => setAddingNew(true));
  }, [userId]);

  /* keep manual address text synced with map pick until user edits */
  useEffect(() => {
    if (picked) setNewAddr((f) => ({ ...f, fullAddress: picked.address }));
  }, [picked]);

  async function saveNewAddress() {
    if (!userId) return;
    if (!newAddr.fullAddress.trim()) { alert('Please enter your full address'); return; }
    /* C3: an address with no coordinates can't be checked against the delivery
       zone — the customer could pay for a place we don't serve. Require a map
       pin so lat/lng are always present. */
    if (picked?.lat == null || picked?.lng == null) {
      alert('Please drop a pin on the map so we can confirm we deliver to your location.');
      return;
    }
    setSavingAddr(true);
    try {
      const saved = await createAddress({
        userId,
        label: newAddr.label,
        fullAddress: newAddr.fullAddress.trim(),
        landmark: newAddr.landmark.trim() || undefined,
        pincode: picked?.pincode,
        city: picked?.city,
        state: picked?.state,
        latitude: picked?.lat,
        longitude: picked?.lng,
      });
      setAddresses((a) => [saved, ...a]);
      setSelectedAddr(Number(saved.id));
      setAddingNew(false);
    } catch (e: any) {
      alert(e.message || 'Could not save address');
    } finally {
      setSavingAddr(false);
    }
  }

  /* ── coupon ── */
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCheckingCoupon(true);
    try {
      const r = await validateCoupon(code, subtotal, userId);
      if (r.valid) {
        setCoupon({ code, discount: r.discount });
        setCouponMsg({ ok: true, text: r.message });
      } else {
        setCoupon(null);
        setCouponMsg({ ok: false, text: r.message });
      }
    } catch {
      setCouponMsg({ ok: false, text: 'Could not validate coupon' });
    } finally {
      setCheckingCoupon(false);
    }
  }

  /* ── extras: rider tip, delivery instructions, cooking note ── */
  const [tip, setTip] = useState(0);
  const [instructions, setInstructions] = useState('');
  const [cookingNote, setCookingNote] = useState('');

  /* ── bill math (display; server recomputes authoritatively) ── */
  const { settings, status: storeStatus } = useStoreSettings();
  const flashDeal = useFlashDeal();
  const flashOff = flashDeal ? Math.round(subtotal * Number(flashDeal.discountPct)) / 100 : 0;
  const discount = (coupon?.discount || 0) + flashOff;
  const delivery =
    subtotal - discount >= settings.freeDeliveryAbove || subtotal === 0
      ? 0 : settings.deliveryCharge;
  const belowMin = subtotal > 0 && subtotal < settings.minOrderAmount;
  const aboveMax = settings.maxOrderAmount > 0 && subtotal > settings.maxOrderAmount;
  const beforeWallet = Math.max(0, subtotal - discount + delivery);
  const [useWallet, setUseWallet] = useState(false);
  const walletUsed = useWallet ? Math.min(walletBalance, beforeWallet + tip) : 0;
  const payable = beforeWallet + tip - walletUsed;

  const [payMethod, setPayMethod] = useState<'cod' | 'online'>('cod');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [paidButStuck, setPaidButStuck] = useState(false); // paid ok, order create failed


  async function placeOrder() {
    // Don't bounce to Google while the session is still hydrating — this was
    // sending already-logged-in users back to the login screen.
    if (status === 'loading') return;
    if (!userId) { router.push('/login?callbackUrl=/checkout'); return; }
    if (!user?.mobile) { router.push('/complete-profile?callbackUrl=/checkout'); return; }
    if (!lines.length && !thalis.length) return;
    if (!selectedAddr && !(addingNew && newAddr.fullAddress.trim())) {
      setError('Please select or add a delivery address'); return;
    }
    setPlacing(true); setError('');

    const items = lines.map((l) => ({ productId: l.p.id, quantity: l.qty }));
    const thaliItems = thalis.map((t) => ({ templateId: t.templateId, selections: t.portions }));
    const destination = selectedAddr
      ? { addressId: selectedAddr }
      : {
          deliveryAddress: newAddr.fullAddress.trim(),
          deliveryLat: picked?.lat,
          deliveryLng: picked?.lng,
        };

    const extras = {
      tipAmount: tip || undefined,
      deliveryInstructions: instructions.trim() || undefined,
      cookingNote: cookingNote.trim() || undefined,
    };

    try {
      // ── ONLINE: open Razorpay, verify, then create the order ──
      if (payMethod === 'online') {
        /* Bug #58: if a coupon/wallet brought the payable to ₹0, there's
           nothing to charge — placing an online order would hit the backend's
           "no online payment needed" error. Just place it directly. */
        if (payable < 1) {
          const order = await checkoutOrder({
            userId, items, thaliItems, ...destination,
            couponCode: coupon?.code, useWallet, paymentMethod: 'cod', ...extras,
          });
          clear();
          router.push(`/orders/${order.id}?placed=1`);
          return;
        }
        const pay = await createPaymentOrder({
          userId,
          items,
          thaliItems,
          ...destination, // snapshot destination server-side for webhook recovery
          couponCode: coupon?.code,
          useWallet,
          ...extras,
        });

        const result = await openRazorpay({
          keyId: pay.keyId,
          amount: pay.amount,
          currency: pay.currency,
          orderId: pay.razorpayOrderId,
          name: 'Bites Theory',
          description: 'Order payment',
          prefill: {
            name: user?.name || undefined,
            email: user?.email || undefined,
            contact: user?.mobile || undefined,
          },
        });

        // Payment succeeded — now create the order. If this call fails
        // (flaky network etc.), retry twice; the backend is idempotent and
        // the Razorpay webhook will finish the order server-side anyway,
        // so the customer's money is never lost.
        let order: any = null;
        let lastErr: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            order = await checkoutOrder({
              userId,
              items,
              ...destination,
              couponCode: coupon?.code,
              useWallet,
              paymentMethod: 'online',
              ...extras,
              razorpayOrderId: result.razorpay_order_id,
              razorpayPaymentId: result.razorpay_payment_id,
              razorpaySignature: result.razorpay_signature,
            });
            break;
          } catch (err: any) {
            lastErr = err;
            await new Promise((r) => setTimeout(r, 1200));
          }
        }
        if (order) {
          clear();
          router.push(`/orders/${order.id}?placed=1`);
        } else {
          // Money is safe: the webhook will create the order automatically.
          clear();
          setPaidButStuck(true);
          setPlacing(false);
          console.error(lastErr);
        }
        return;
      }

      // ── COD: place the order directly ──
      const order = await checkoutOrder({
        userId,
        items,
        ...destination,
        couponCode: coupon?.code,
        useWallet,
        paymentMethod: 'cod',
        ...extras,
      });
      clear();
      router.push(`/orders/${order.id}?placed=1`);
    } catch (e: any) {
      // "Payment cancelled" isn't a real error — just let them retry
      const msg = e.message === 'Payment cancelled'
        ? ''
        : `${e.message || 'Could not place order'} — you were not charged. Tap Place Order to try again.`;
      setError(msg);
      setPlacing(false);
    }
  }

  /* ── guards ── */
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login?callbackUrl=/checkout');
  }, [status, router]);

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid rgba(13,59,46,.06)', borderRadius: 20,
    padding: 16, marginBottom: 14,
    boxShadow: '0 6px 18px rgba(13,59,46,.06)',
  };
  const h: React.CSSProperties = {
    fontWeight: 850, fontSize: 15, color: C.ink, marginBottom: 12, letterSpacing: '-0.2px',
  };
  const input: React.CSSProperties = {
    width: '100%', border: '1px solid rgba(13,59,46,.12)', borderRadius: 12,
    padding: '12px 14px', fontSize: 13.5, outline: 'none', background: '#fff',
    transition: 'border-color .18s, box-shadow .18s',
  };

  return (
    <AppShell
      header={<AppHeader variant="page" title="Checkout" />}
      footerExtra={
        lines.length + thalis.length > 0 ? (
          <div className="checkout-bar">
            <div className="checkout-total">
              <b>{money(payable)}</b>
              <span>{payMethod === 'cod' ? 'Pay on delivery' : 'Pay online'}</span>
            </div>
            <button
              className="checkout-btn"
              onClick={placeOrder}
              disabled={placing || !storeStatus.open || belowMin || aboveMax}
            >
              {!storeStatus.open
                ? 'Kitchen closed'
                : belowMin
                ? `Min order ${money(settings.minOrderAmount)}`
                : aboveMax
                ? `Max order ${money(settings.maxOrderAmount)}`
                : placing ? 'Placing…' : 'Place Order'}
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="bt-page-pad">
        {!storeStatus.open && <StoreClosedBanner status={storeStatus} />}
        {catLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Loading…</div>
        ) : !(lines.length + thalis.length) ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
            Your cart is empty. <a href="/menu" style={{ color: C.greenDeep, fontWeight: 700 }}>Browse the menu →</a>
          </div>
        ) : (
          <>
            {/* ── DELIVER TO ── */}
            <div style={card}>
              <div style={h}>📍 Deliver to</div>
              {addresses.map((a) => (
                <label
                  key={a.id}
                  style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 8px',
                    borderRadius: 10, cursor: 'pointer', marginBottom: 6,
                    background: selectedAddr === Number(a.id) && !addingNew ? C.greenSoft : 'transparent',
                    border: `1px solid ${selectedAddr === Number(a.id) && !addingNew ? C.green : 'transparent'}`,
                  }}
                >
                  <input
                    type="radio"
                    name="addr"
                    checked={selectedAddr === Number(a.id) && !addingNew}
                    onChange={() => { setSelectedAddr(Number(a.id)); setAddingNew(false); }}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {a.label || 'Address'}{a.isDefault ? ' · Default' : ''}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted }}>
                      {a.fullAddress}{a.landmark ? `, ${a.landmark}` : ''}
                    </div>
                  </div>
                </label>
              ))}

              {!addingNew ? (
                <button
                  onClick={() => setAddingNew(true)}
                  style={{
                    background: 'none', border: `1px dashed ${C.green}`, color: C.greenDeep,
                    borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700,
                    width: '100%', cursor: 'pointer', marginTop: 4,
                  }}
                >
                  ＋ Add new address (pick on map)
                </button>
              ) : (
                <div style={{ marginTop: 10 }}>
                  <MapPicker onPick={setPicked} />
                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['Home', 'Work', 'Other'] as const).map((l) => (
                        <button
                          key={l}
                          onClick={() => setNewAddr((f) => ({ ...f, label: l }))}
                          style={{
                            padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                            cursor: 'pointer',
                            border: `1px solid ${newAddr.label === l ? C.green : C.line}`,
                            background: newAddr.label === l ? C.greenSoft : '#fff',
                            color: newAddr.label === l ? C.greenDeep : C.muted,
                          }}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    <textarea
                      style={{ ...input, minHeight: 60, resize: 'vertical' }}
                      placeholder="Full address (house no, street, area)"
                      value={newAddr.fullAddress}
                      onChange={(e) => setNewAddr((f) => ({ ...f, fullAddress: e.target.value }))}
                    />
                    <input
                      style={input}
                      placeholder="Landmark (optional)"
                      value={newAddr.landmark}
                      onChange={(e) => setNewAddr((f) => ({ ...f, landmark: e.target.value }))}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={saveNewAddress}
                        disabled={savingAddr}
                        style={{
                          flex: 1, background: C.green, color: '#fff', border: 'none',
                          borderRadius: 10, padding: '11px', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                        }}
                      >
                        {savingAddr ? 'Saving…' : 'Save & deliver here'}
                      </button>
                      {addresses.length > 0 && (
                        <button
                          onClick={() => setAddingNew(false)}
                          style={{
                            background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10,
                            padding: '11px 16px', fontSize: 13, cursor: 'pointer', color: C.muted,
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── ITEMS ── */}
            <div style={card}>
              <div style={h}>🛒 Your items</div>
              {lines.map(({ p, qty }) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0' }}>
                  <span>{p.name} × {qty}</span>
                  <b>{money(effectivePrice(p) * qty)}</b>
                </div>
              ))}
              {thalis.map((t) => (
                <div key={t.key} style={{ padding: '6px 0', borderTop: `1px dashed ${C.line}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>🍛 {t.templateName} (Custom)</span>
                    <b>{money(t.total)}</b>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {Object.entries(t.selections)
                      .map(([sec, names]) => `${sec}: ${names.join(', ')}`)
                      .join(' · ')}
                  </div>
                  <button
                    onClick={() => removeThali(t.key)}
                    style={{ background: 'none', border: 'none', color: '#b3261e', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0, marginTop: 3 }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {/* ── COUPON ── */}
            <div style={card}>
              <div style={h}>🏷️ Apply coupon</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...input, textTransform: 'uppercase' }}
                  placeholder="Enter coupon code"
                  value={couponInput}
                  onChange={(e) => { setCouponInput(e.target.value); setCouponMsg(null); }}
                />
                <button
                  onClick={coupon ? () => { setCoupon(null); setCouponInput(''); setCouponMsg(null); } : applyCoupon}
                  disabled={checkingCoupon}
                  style={{
                    background: coupon ? '#fff' : C.orange, color: coupon ? C.orangeDeep : '#fff',
                    border: coupon ? `1px solid ${C.orange}` : 'none',
                    borderRadius: 10, padding: '0 18px', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {checkingCoupon ? '…' : coupon ? 'Remove' : 'Apply'}
                </button>
              </div>
              {couponMsg && (
                <div style={{ fontSize: 12, marginTop: 8, fontWeight: 600, color: couponMsg.ok ? C.greenDeep : '#c0392b' }}>
                  {couponMsg.text}
                </div>
              )}
            </div>

            {/* ── WALLET ── */}
            {walletBalance > 0 && (
              <div style={card}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>💰 Use wallet balance</div>
                    <div style={{ fontSize: 12, color: C.muted }}>
                      Available: {money(walletBalance)}{useWallet ? ` · Using ${money(walletUsed)}` : ''}
                    </div>
                  </div>
                </label>
              </div>
            )}

            {/* ── INSTRUCTIONS + TIP ── */}
            <div style={card}>
              <div style={h}>📝 Anything we should know?</div>
              <div style={{ display: 'grid', gap: 8 }}>
                <input
                  style={input}
                  placeholder="Delivery instructions (e.g. leave at door, call on arrival)"
                  value={instructions}
                  maxLength={300}
                  onChange={(e) => setInstructions(e.target.value)}
                />
                <input
                  style={input}
                  placeholder="Cooking note (e.g. less spicy, no onion)"
                  value={cookingNote}
                  maxLength={300}
                  onChange={(e) => setCookingNote(e.target.value)}
                />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 12, marginBottom: 6 }}>
                🛵 Tip your rider <span style={{ color: C.muted, fontWeight: 500 }}>(100% goes to them)</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[0, 10, 20, 30, 50].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTip(t)}
                    style={{
                      padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
                      cursor: 'pointer',
                      border: `1px solid ${tip === t ? C.green : C.line}`,
                      background: tip === t ? C.greenSoft : '#fff',
                      color: tip === t ? C.greenDeep : C.muted,
                    }}
                  >
                    {t === 0 ? 'No tip' : `₹${t}`}
                  </button>
                ))}
              </div>
            </div>

            {/* ── PAYMENT ── */}
            <div style={card}>
              <div style={h}>💳 Payment method</div>
              {([['cod', 'Cash on Delivery', 'Pay when your food arrives'],
                 ['online', 'Pay Online', 'UPI / Card / Netbanking via Razorpay']] as const).map(([val, label, sub]) => (
                <label
                  key={val}
                  style={{
                    display: 'flex', gap: 11, alignItems: 'center', padding: '12px 12px',
                    borderRadius: 13, cursor: 'pointer', marginBottom: 7,
                    background: payMethod === val ? C.greenSoft : '#fff',
                    border: `1.5px solid ${payMethod === val ? C.green : 'rgba(13,59,46,.08)'}`,
                    boxShadow: payMethod === val ? '0 3px 10px rgba(76,175,80,.15)' : 'none',
                    transition: 'all .18s',
                  }}
                >
                  <input
                    type="radio" name="pay" checked={payMethod === val}
                    onChange={() => setPayMethod(val)}
                  />
                  <div>
                    <div style={{ fontWeight: 750, fontSize: 13.5 }}>{label}</div>
                    <div style={{ fontSize: 11.5, color: C.muted }}>{sub}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* ── BILL ── */}
            <div style={card}>
              <div style={h}>🧾 Bill details</div>
              {[
                ['Item total', money(subtotal)],
                ...(discount > 0 ? [['Coupon discount', `− ${money(discount)}`]] : []),
                ['Delivery fee', delivery === 0 ? 'FREE' : money(delivery)],
                ...(tip > 0 ? [['Rider tip', money(tip)]] : []),
                ...(walletUsed > 0 ? [['Wallet used', `− ${money(walletUsed)}`]] : []),
              ].map(([k, v]) => (
                <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: C.muted }}>
                  <span>{k}</span><span style={{ color: (v as string).startsWith('−') || v === 'FREE' ? C.greenDeep : C.ink }}>{v}</span>
                </div>
              ))}
              <div style={{ borderTop: `1px dashed ${C.line}`, marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
                <span>To pay</span><span>{money(payable)}</span>
              </div>
              {delivery > 0 && (
                <div style={{ fontSize: 11.5, color: C.orangeDeep, marginTop: 6 }}>
                  Add {money(settings.freeDeliveryAbove - (subtotal - discount))} more for FREE delivery
                </div>
              )}
            </div>

            {paidButStuck && (
              <div style={{ background: C.greenSoft, border: `1px solid ${C.green}`, borderRadius: 12, padding: '12px 14px', fontSize: 13, marginBottom: 14 }}>
                <b style={{ color: C.greenDeep }}>✅ Payment received — your money is safe.</b>{' '}
                We hit a snag confirming the order in this tab, but our server will finish it
                automatically within a minute.{' '}
                <a href="/orders" style={{ color: C.greenDeep, fontWeight: 800 }}>Check your orders →</a>
              </div>
            )}
            {error && (
              <div style={{ background: '#fdecea', border: '1px solid #f5c6cb', color: '#c0392b', borderRadius: 12, padding: '10px 14px', fontSize: 13, marginBottom: 90 }}>
                {error}
              </div>
            )}
            <div style={{ height: 80 }} />
          </>
        )}
      </div>
    </AppShell>
  );
}
