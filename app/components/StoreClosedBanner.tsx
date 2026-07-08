'use client';

/**
 * StoreClosedBanner — the "kitchen shutter". Shown on home (and anywhere
 * else you mount it) whenever the store is closed. Uses the brand's deep
 * green + amber tokens. The pulsing dot signals "live status", the message
 * comes straight from the backend (holiday note, next opening time, or the
 * admin's custom force-close message).
 *
 * Usage:
 *   const { status } = useStoreSettings();
 *   {!status.open && <StoreClosedBanner status={status} />}
 */

import type { StoreStatus } from '../lib/useStoreSettings';

export default function StoreClosedBanner({ status }: { status: StoreStatus }) {
  if (status.open) return null;
  return (
    <div className="bt-closed">
      <div className="bt-closed-shutter" aria-hidden="true" />
      <div className="bt-closed-row">
        <span className="bt-closed-dot" aria-hidden="true" />
        <div>
          <div className="bt-closed-title">Kitchen closed right now</div>
          <div className="bt-closed-msg">{status.message || 'We are not taking orders at the moment.'}</div>
        </div>
      </div>
      <style>{`
.bt-closed{position:relative;overflow:hidden;margin:10px 0 4px;border-radius:16px;
  background:#0D3B2E;color:#fff;padding:14px 16px 14px 14px;
  box-shadow:0 8px 24px rgba(13,59,46,.25)}
.bt-closed-shutter{position:absolute;inset:0;opacity:.14;pointer-events:none;
  background:repeating-linear-gradient(180deg,#fff 0 3px,transparent 3px 12px)}
.bt-closed-row{position:relative;display:flex;align-items:flex-start;gap:12px}
.bt-closed-dot{flex:none;width:10px;height:10px;margin-top:5px;border-radius:50%;
  background:#F59E0B;box-shadow:0 0 0 0 rgba(245,158,11,.5);animation:btPulse 1.8s infinite}
.bt-closed-title{font-weight:800;font-size:14px;letter-spacing:.2px}
.bt-closed-msg{font-size:13px;color:#cfe3da;margin-top:3px;line-height:1.45}
@keyframes btPulse{0%{box-shadow:0 0 0 0 rgba(245,158,11,.45)}
  70%{box-shadow:0 0 0 9px rgba(245,158,11,0)}100%{box-shadow:0 0 0 0 rgba(245,158,11,0)}}
@media (prefers-reduced-motion: reduce){.bt-closed-dot{animation:none}}
      `}</style>
    </div>
  );
}
