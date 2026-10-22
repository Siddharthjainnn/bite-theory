'use client';

/**
 * DispatchSheet — book a Porter two-wheeler for an order, by hand, fast.
 *
 * The round trip it supports:
 *   1. "Copy all & open Porter" — puts pickup + drop on the clipboard and opens
 *      porter.in in a new tab. Every field also has its own Copy button,
 *      because Porter's form wants them one at a time.
 *   2. Admin books on Porter, then comes back and taps "Mark Porter booked".
 *      CRN / driver / tracking link are optional — they can be added later by
 *      reopening this sheet, once Porter has assigned someone.
 *
 * Book while cooking: a Porter driver takes 8–15 min to reach the kitchen, so
 * this is offered from Preparing onwards, not only at Ready.
 */

import { useCallback, useEffect, useState } from 'react';
import { C, money } from '../lib/bite';
import {
  PORTER_BOOKING_URL, copyText, announceOrdersChanged,
  type DispatchApi, type DispatchSheetData,
} from '../lib/dispatch';

const LIVE_BOOKING_CANCELLABLE = ['order_confirmed', 'preparing_food', 'food_ready', 'assigned_to_delivery'];

export default function DispatchSheet({
  orderId, api, onClose, showToast,
}: {
  orderId: number;
  api: DispatchApi;
  onClose: () => void;
  showToast: (m: string) => void;
}) {
  const [sheet, setSheet] = useState<DispatchSheetData | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [ref, setRef] = useState('');
  const [riderName, setRiderName] = useState('');
  const [riderPhone, setRiderPhone] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [fee, setFee] = useState('');
  const [codAck, setCodAck] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api.dispatchSheet(orderId);
      setSheet(s);
      setRef(s.booking?.externalRef || '');
      setRiderName(s.booking?.riderName || '');
      setRiderPhone(s.booking?.riderPhone || '');
      setTrackingUrl(s.booking?.trackingUrl || '');
      setFee(s.booking?.fee != null ? String(s.booking.fee) : '');
      setErr('');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Could not load the order details.');
    }
  }, [api, orderId]);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) return load(); });
    return () => { alive = false; };
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = (key: string, text: string) => {
    if (!text) return;
    void copyText(text).then((ok) => {
      if (!ok) { showToast('Copy blocked by the browser — long-press to copy instead'); return; }
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
    });
  };

  /* Clipboard first, then the new tab: the write must start while this page
     still has focus, and window.open must stay inside the click gesture. */
  const copyAllAndOpen = () => {
    if (!sheet) return;
    copy('all', sheet.copyAll);
    window.open(PORTER_BOOKING_URL, '_blank', 'noopener,noreferrer');
  };

  const booked = !!sheet && sheet.provider !== 'in_house';
  const canCancel = booked && LIVE_BOOKING_CANCELLABLE.includes(sheet!.status);

  const save = async () => {
    if (!sheet) return;
    if (sheet.cod.isCod && !booked && !codAck) {
      showToast('Tick the cash box first — Porter will not collect cash');
      return;
    }
    const feeNum = fee.trim() ? Number(fee) : undefined;
    if (feeNum != null && (!Number.isFinite(feeNum) || feeNum < 0)) {
      showToast('Porter fee must be a number'); return;
    }
    setBusy(true);
    try {
      await api.bookCourier(orderId, {
        provider: 'porter',
        externalRef: ref.trim(),
        riderName: riderName.trim(),
        riderPhone: riderPhone.trim(),
        ...(trackingUrl.trim() ? { trackingUrl: trackingUrl.trim() } : {}),
        ...(feeNum != null ? { fee: feeNum } : {}),
        ...(sheet.cod.isCod ? { codAcknowledged: codAck || booked } : {}),
      });
      showToast(booked ? `${sheet.orderNumber}: Porter details saved` : `${sheet.orderNumber}: Porter booked`);
      announceOrdersChanged();
      onClose();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not save the booking');
    } finally { setBusy(false); }
  };

  const cancelBooking = async () => {
    if (!sheet) return;
    if (!confirm(`Cancel the Porter booking for ${sheet.orderNumber}? Also cancel it in the Porter app.`)) return;
    setBusy(true);
    try {
      await api.cancelCourier(orderId);
      showToast(`${sheet.orderNumber}: Porter booking removed`);
      announceOrdersChanged();
      onClose();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not cancel the booking');
    } finally { setBusy(false); }
  };

  return (
    <div className="ds-overlay" onClick={onClose} role="presentation">
      <style>{CSS}</style>
      <div
        className="ds-panel" role="dialog" aria-modal="true" aria-label="Book a Porter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ds-head">
          <div>
            <div className="ds-eyebrow">{booked ? 'Porter booked' : 'Book a Porter'}</div>
            <div className="ds-title">{sheet?.orderNumber || `Order #${orderId}`}</div>
          </div>
          <button className="ds-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="ds-body">
          {err && <div className="ds-alert ds-alert-red">{err}</div>}
          {!sheet && !err && <div className="ds-skel" aria-label="Loading" />}

          {sheet && (
            <>
              {sheet.warnings.map((w) => (
                <div key={w} className={`ds-alert ${/cash/i.test(w) ? 'ds-alert-red' : 'ds-alert-amber'}`}>
                  {/cash/i.test(w) ? '💵' : '⚠️'} {w}
                </div>
              ))}

              <button className="ds-primary" onClick={copyAllAndOpen}>
                {copied === 'all' ? 'Copied ✓ — opening Porter…' : 'Copy all & open Porter ↗'}
              </button>
              <p className="ds-hint">
                Paste into Porter&apos;s pickup and drop fields, or copy one line at a time below.
              </p>

              <Section title="Pickup · Kitchen" tone="green">
                <Row k="Name" v={sheet.pickup.name} id="p-name" copied={copied} onCopy={copy} />
                <Row k="Phone" v={sheet.pickup.phone} id="p-phone" copied={copied} onCopy={copy} />
                <Row k="Address" v={sheet.pickup.address} id="p-addr" copied={copied} onCopy={copy} />
                <Row k="Lat, Lng" v={sheet.pickup.latLng} id="p-ll" copied={copied} onCopy={copy}
                  mono link={sheet.pickup.mapsUrl} />
              </Section>

              <Section title="Drop · Customer" tone="orange">
                <Row k="Name" v={sheet.drop.name} id="d-name" copied={copied} onCopy={copy} />
                <Row k="Mobile" v={sheet.drop.mobile} id="d-mob" copied={copied} onCopy={copy} tel />
                <Row k="Address" v={sheet.drop.address} id="d-addr" copied={copied} onCopy={copy} />
                <Row k="Landmark" v={sheet.drop.landmark} id="d-lm" copied={copied} onCopy={copy} />
                <Row k="Pincode" v={sheet.drop.pincode} id="d-pin" copied={copied} onCopy={copy} />
                <Row k="Lat, Lng" v={sheet.drop.latLng} id="d-ll" copied={copied} onCopy={copy}
                  mono link={sheet.drop.mapsUrl} />
                <Row k="Note" v={sheet.drop.instructions} id="d-note" copied={copied} onCopy={copy} />
              </Section>

              <div className="ds-paybox" data-cod={sheet.cod.isCod ? '1' : '0'}>
                {sheet.cod.isCod
                  ? <>Cash order · <b>{money(sheet.cod.amountToCollect)}</b> unpaid</>
                  : <>Prepaid · the driver collects nothing</>}
              </div>

              <div className="ds-step">
                <div className="ds-step-title">
                  {booked ? 'Booking details' : 'After you book on Porter'}
                </div>
                <p className="ds-hint" style={{ marginTop: 2 }}>
                  All optional. Mark it booked now and add the driver when Porter assigns one.
                </p>
                <div className="ds-grid">
                  <Field label="Porter CRN / order ID" value={ref} onChange={setRef} placeholder="CRN12345678" />
                  <Field label="Porter fee (₹)" value={fee} onChange={setFee} placeholder="62" inputMode="decimal" />
                  <Field label="Driver name" value={riderName} onChange={setRiderName} placeholder="Amit" />
                  <Field label="Driver phone" value={riderPhone} onChange={setRiderPhone} placeholder="98xxxxxxxx" inputMode="tel" />
                </div>
                <Field label="Porter tracking link (customer sees this)" value={trackingUrl}
                  onChange={setTrackingUrl} placeholder="https://porter.in/…" inputMode="url" />

                {sheet.cod.isCod && !booked && (
                  <label className="ds-ack">
                    <input type="checkbox" checked={codAck} onChange={(e) => setCodAck(e.target.checked)} />
                    <span>
                      I&apos;ve arranged the {money(sheet.cod.amountToCollect)} — the customer paid by UPI,
                      or someone else is collecting it. Porter will not.
                    </span>
                  </label>
                )}
              </div>
            </>
          )}
        </div>

        {sheet && (
          <div className="ds-foot">
            {canCancel && (
              <button className="ds-ghost-red" onClick={cancelBooking} disabled={busy}>
                Remove booking
              </button>
            )}
            <button className="ds-save" onClick={save}
              disabled={busy || (sheet.cod.isCod && !booked && !codAck)}>
              {busy ? 'Saving…' : booked ? 'Save details' : 'Mark Porter booked ✓'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, tone, children }: { title: string; tone: 'green' | 'orange'; children: React.ReactNode }) {
  return (
    <div className="ds-card" data-tone={tone}>
      <div className="ds-card-title">{title}</div>
      {children}
    </div>
  );
}

function Row({
  k, v, id, copied, onCopy, mono, link, tel,
}: {
  k: string; v: string; id: string; copied: string | null;
  onCopy: (id: string, v: string) => void; mono?: boolean; link?: string | null; tel?: boolean;
}) {
  if (!v) return null;
  return (
    <div className="ds-row">
      <span className="ds-k">{k}</span>
      <span className={`ds-v${mono ? ' ds-mono' : ''}`}>
        {tel ? <a href={`tel:${v}`}>{v}</a> : v}
        {link && <> · <a href={link} target="_blank" rel="noopener noreferrer">Map ↗</a></>}
      </span>
      <button className="ds-copy" data-on={copied === id ? '1' : '0'} onClick={() => onCopy(id, v)}
        aria-label={`Copy ${k}`}>
        {copied === id ? '✓' : 'Copy'}
      </button>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, inputMode,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  inputMode?: 'text' | 'tel' | 'url' | 'decimal';
}) {
  return (
    <label className="ds-field">
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        inputMode={inputMode} />
    </label>
  );
}

const CSS = `
.ds-overlay{position:fixed;inset:0;z-index:200;background:rgba(13,59,46,.42);backdrop-filter:blur(3px);
  display:flex;align-items:center;justify-content:center;padding:16px;animation:dsFade .18s ease-out}
.ds-panel{width:100%;max-width:580px;max-height:calc(100vh - 32px);background:#fff;border-radius:18px;
  display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(13,59,46,.28);overflow:hidden;
  animation:dsRise .26s cubic-bezier(.2,.9,.3,1.1)}
.ds-head{display:flex;justify-content:space-between;align-items:flex-start;padding:16px 18px 12px;
  border-bottom:1px solid ${C.line}}
.ds-eyebrow{font-size:11px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:${C.orangeDeep}}
.ds-title{font-size:18px;font-weight:900;color:${C.ink};margin-top:2px}
.ds-x{width:34px;height:34px;border-radius:10px;border:1px solid ${C.line};background:#fff;cursor:pointer;
  font-size:14px;color:${C.muted}}
.ds-body{padding:14px 18px;overflow-y:auto;flex:1}
.ds-skel{height:280px;border-radius:14px;background:linear-gradient(90deg,#eef2ef 25%,#f7f9f7 50%,#eef2ef 75%);
  background-size:200% 100%;animation:dsShim 1.2s infinite}
.ds-alert{padding:10px 12px;border-radius:11px;font-size:12.5px;font-weight:700;line-height:1.45;margin-bottom:10px}
.ds-alert-red{background:#fdecea;color:#a93226;border:1px solid #f3c6c0}
.ds-alert-amber{background:#fff4e0;color:#8a6100;border:1px solid #f0d9a8}
.ds-primary{width:100%;padding:14px 16px;border:none;border-radius:13px;background:${C.orange};color:#1f1300;
  font-size:15px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 6px 16px rgba(245,158,11,.35);
  transition:transform .12s ease}
.ds-primary:active{transform:scale(.98)}
.ds-hint{font-size:11.5px;color:${C.muted};margin:7px 2px 12px;line-height:1.45}
.ds-card{border:1px solid ${C.line};border-radius:14px;padding:10px 12px 6px;margin-bottom:10px;
  border-left:4px solid ${C.green}}
.ds-card[data-tone="orange"]{border-left-color:${C.orange}}
.ds-card-title{font-size:11px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;color:${C.muted};
  margin-bottom:4px}
.ds-row{display:grid;grid-template-columns:72px 1fr auto;gap:8px;align-items:center;padding:6px 0;
  border-top:1px dashed ${C.line}}
.ds-row:first-of-type{border-top:none}
.ds-k{font-size:11.5px;color:${C.muted};font-weight:800}
.ds-v{font-size:13px;color:${C.ink};font-weight:700;line-height:1.4;word-break:break-word}
.ds-v a{color:${C.greenDeep};font-weight:800;text-decoration:none}
.ds-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
.ds-copy{min-width:58px;padding:7px 10px;border-radius:9px;border:1px solid ${C.line};background:#fff;
  font-size:12px;font-weight:800;color:${C.ink};cursor:pointer;font-family:inherit;transition:all .15s}
.ds-copy[data-on="1"]{background:${C.greenSoft};border-color:${C.green};color:${C.greenDeep}}
.ds-paybox{padding:10px 12px;border-radius:11px;font-size:13px;font-weight:800;margin-bottom:12px;
  background:${C.greenSoft};color:${C.greenDeep}}
.ds-paybox[data-cod="1"]{background:#fdecea;color:#a93226}
.ds-step{background:${C.bg};border-radius:14px;padding:12px}
.ds-step-title{font-size:13.5px;font-weight:900;color:${C.ink}}
.ds-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ds-field{display:flex;flex-direction:column;gap:4px;margin-top:8px}
.ds-field span{font-size:11px;font-weight:800;color:${C.muted}}
.ds-field input{padding:10px 11px;border-radius:10px;border:1px solid ${C.line};font-size:13.5px;
  font-family:inherit;color:${C.ink};background:#fff;outline:none;min-width:0}
.ds-field input:focus{border-color:${C.green};box-shadow:0 0 0 3px rgba(76,175,80,.15)}
.ds-ack{display:flex;gap:9px;align-items:flex-start;margin-top:12px;font-size:12.5px;color:#a93226;
  font-weight:700;line-height:1.45;cursor:pointer}
.ds-ack input{margin-top:3px;width:17px;height:17px;accent-color:#c0392b}
.ds-foot{display:flex;gap:10px;justify-content:flex-end;align-items:center;padding:12px 18px;
  border-top:1px solid ${C.line};background:#fff}
.ds-save{padding:12px 20px;border:none;border-radius:12px;background:${C.dark};color:#fff;font-size:14px;
  font-weight:900;cursor:pointer;font-family:inherit}
.ds-save:disabled{background:${C.muted};cursor:default}
.ds-ghost-red{margin-right:auto;padding:10px 12px;border:none;background:none;color:#c0392b;font-size:12.5px;
  font-weight:800;cursor:pointer;font-family:inherit}
@media (max-width:640px){
  .ds-overlay{align-items:flex-end;padding:0}
  .ds-panel{max-width:none;border-radius:20px 20px 0 0;max-height:92vh}
  .ds-grid{grid-template-columns:1fr}
}
@keyframes dsFade{from{opacity:0}to{opacity:1}}
@keyframes dsRise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes dsShim{from{background-position:200% 0}to{background-position:-200% 0}}
@media (prefers-reduced-motion:reduce){.ds-overlay,.ds-panel,.ds-skel{animation:none}}
`;
