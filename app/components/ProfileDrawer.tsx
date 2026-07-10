'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut, signIn } from 'next-auth/react';
import { C, money, fetchMyReferrals, claimReferral, type ReferralRow } from '../lib/bite';

/**
 * Left/side profile drawer. Every row now DOES something:
 *  - `href`  → navigates to a real page and closes the drawer.
 *  - `refer` → expands to show the user's referral code (copyable).
 *  - `soon`  → shows a small "coming soon" note instead of a dead click.
 */
type Item =
  | { ic: string; label: string; href: string }
  | { ic: string; label: string; refer: true }
  | { ic: string; label: string; soon: true };

const ITEMS: Item[] = [
  { ic: '🧾', label: 'Order History', href: '/orders' },
  { ic: '🎟️', label: 'My Coupons', href: '/coupons' },
  { ic: '🎁', label: 'Refer & Earn', refer: true },
  { ic: 'ℹ️', label: 'About Bites Theory', href: '/info?tab=about' },
  { ic: '🛟', label: 'Help & Support', href: '/account/support' },
  { ic: '📄', label: 'Terms & Privacy', href: '/info?tab=terms' },
  { ic: '📍', label: 'Saved Addresses', href: '/account/addresses' },
  { ic: '💳', label: 'Wallet & Transactions', href: '/account/wallet' },
  { ic: '❤️', label: 'Favorites', href: '/account/favorites' },
  { ic: '⭐', label: 'My Reviews', href: '/account/reviews' },
];

function initials(name?: string | null) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U';
}

export default function ProfileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const user = session?.user as any;
  const loggedIn = status === 'authenticated';
  const tier = (user?.loyaltyLevel || 'bronze').toString().toUpperCase();

  const [showRefer, setShowRefer] = useState(false);
  const [soonMsg, setSoonMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const referralCode = user?.referralCode || user?.referral_code || '';
  const userId = Number(user?.dbId || 0);

  /* real referral earnings */
  const [refs, setRefs] = useState<ReferralRow[]>([]);
  const [friendCode, setFriendCode] = useState('');
  const [claimMsg, setClaimMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!showRefer || !userId) return;
    fetchMyReferrals(userId).then(setRefs).catch(() => {});
  }, [showRefer, userId]);

  const earned = refs.filter((r) => r.rewarded).reduce((s, r) => s + Number(r.rewardAmount || 0), 0);
  const pendingRefs = refs.filter((r) => !r.isConverted).length;

  async function submitFriendCode() {
    if (!friendCode.trim() || !userId) return;
    setClaiming(true); setClaimMsg(null);
    try {
      const r = await claimReferral(userId, friendCode.trim());
      setClaimMsg({ ok: true, text: r.message || 'Code applied! 🎉' });
      setFriendCode('');
    } catch (e: any) {
      setClaimMsg({ ok: false, text: e?.message || 'Could not apply that code' });
    } finally { setClaiming(false); }
  }

  function go(href: string) {
    onClose();
    router.push(href);
  }

  async function copyReferral() {
    if (!referralCode) return;
    try { await navigator.clipboard.writeText(referralCode); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handle(it: Item) {
    if ('href' in it) return go(it.href);
    if ('refer' in it) { setShowRefer((s) => !s); return; }
    // soon
    setSoonMsg(it.label);
    setTimeout(() => setSoonMsg((m) => (m === it.label ? null : m)), 1800);
  }

  return (
    <>
      <div className={`drawer-scrim ${open ? 'on' : ''}`} onClick={onClose} aria-hidden />
      <aside className={`drawer ${open ? 'on' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <button className="drawer-x" onClick={onClose} aria-label="Close">✕</button>
          <div className="drawer-head-title">My Profile</div>
          {loggedIn ? (
            <div className="drawer-user">
              {user?.image ? (
                <img className="drawer-ava" src={user.image} alt={user.name || 'You'} referrerPolicy="no-referrer" />
              ) : (
                <span className="drawer-ava">{initials(user?.name)}</span>
              )}
              <div>
                <div className="drawer-name">{user?.name || 'Bites Theory User'}</div>
                <div className="drawer-mail">{user?.email}</div>
                <span className="drawer-tier">🏅 {tier} MEMBER</span>
              </div>
            </div>
          ) : (
            <div className="drawer-user">
              <span className="drawer-ava">👋</span>
              <div>
                <div className="drawer-name">Guest</div>
                <div className="drawer-mail">Login to order & earn rewards</div>
                <button onClick={() => signIn('google')} className="drawer-login-btn">
                  Login / Sign up →
                </button>
              </div>
            </div>
          )}
        </div>

        {loggedIn && (
          <div className="drawer-stats">
            <div className="dstat"><b>{user?.ordersCount ?? '—'}</b><span>Orders</span></div>
            <div className="dstat"><b style={{ color: C.green }}>{money(user?.walletBalance || 0)}</b><span>Wallet</span></div>
            <div className="dstat"><b style={{ color: C.orange }}>{user?.loyaltyPoints || 0}</b><span>Points</span></div>
          </div>
        )}

        <div className="drawer-menu">
          {ITEMS.map((it) => (
            <div key={it.label}>
              <button className="drawer-item" onClick={() => handle(it)}>
                <span className="di-ic">{it.ic}</span>
                <span className="di-label">{it.label}</span>
                <span className="di-arrow">›</span>
              </button>

              {'refer' in it && showRefer && (
                <div className="refer-box">
                  {loggedIn && referralCode ? (
                    <>
                      <div className="refer-hint">Share this code — you both earn rewards on their first order.</div>
                      <button className="refer-code" onClick={copyReferral}>
                        <span>{referralCode}</span>
                        <span className="refer-copy">{copied ? '✓ COPIED' : 'COPY'}</span>
                      </button>

                      <div className="refer-earn-row">
                        <div className="refer-earn">
                          <b style={{ color: C.green }}>{money(earned)}</b>
                          <span>Earned</span>
                        </div>
                        <div className="refer-earn">
                          <b style={{ color: C.orange }}>{refs.filter((r) => r.isConverted).length}</b>
                          <span>Friends joined</span>
                        </div>
                        <div className="refer-earn">
                          <b>{pendingRefs}</b>
                          <span>Pending</span>
                        </div>
                      </div>

                      <div className="refer-claim">
                        <input
                          className="refer-claim-input"
                          value={friendCode}
                          onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
                          placeholder="Have a friend's code?"
                          maxLength={12}
                        />
                        <button className="refer-claim-btn" disabled={claiming || !friendCode.trim()} onClick={submitFriendCode}>
                          {claiming ? '…' : 'Apply'}
                        </button>
                      </div>
                      {claimMsg && (
                        <div className="refer-claim-msg" style={{ color: claimMsg.ok ? C.greenDeep : '#c62828' }}>
                          {claimMsg.text}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="refer-hint">Login to get your referral code.</div>
                  )}
                </div>
              )}

              {'soon' in it && soonMsg === it.label && (
                <div className="soon-box">Coming soon 🚧</div>
              )}
            </div>
          ))}

          {loggedIn && (
            <button className="drawer-item logout" onClick={() => signOut({ callbackUrl: '/login' })}>
              <span className="di-ic">↩️</span>
              <span className="di-label">Logout</span>
              <span className="di-arrow">›</span>
            </button>
          )}
        </div>
      </aside>

      <style>{`
.refer-earn-row{display:flex;gap:8px;margin-top:10px}
.refer-earn{flex:1;background:#fff;border:1px solid ${C.line};border-radius:10px;padding:8px 6px;text-align:center}
.refer-earn b{display:block;font-size:14px}
.refer-earn span{font-size:10px;color:${C.muted}}
.refer-claim{display:flex;gap:6px;margin-top:10px}
.refer-claim-input{flex:1;border:1px solid ${C.line};border-radius:9px;padding:8px 10px;font-size:12.5px;
  text-transform:uppercase;letter-spacing:1px;outline:none;background:#fff}
.refer-claim-btn{border:none;border-radius:9px;padding:8px 14px;font-weight:800;font-size:12px;
  background:${C.green};color:#fff;cursor:pointer}
.refer-claim-btn:disabled{opacity:.5;cursor:default}
.refer-claim-msg{font-size:11.5px;font-weight:600;margin-top:6px}
.drawer-scrim{position:fixed;top:0;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:480px;background:rgba(13,59,46,.45);
  opacity:0;pointer-events:none;transition:opacity .3s;z-index:40}
.drawer-scrim.on{opacity:1;pointer-events:auto}
.drawer{position:fixed;top:0;bottom:0;right:0;left:auto;width:86%;max-width:330px;
  background:${C.bg};z-index:41;transform:translateX(105%);
  transition:transform .34s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;
  box-shadow:-12px 0 40px rgba(0,0,0,.3);overflow-y:auto}
.drawer.on{transform:translateX(0)}
@media(min-width:520px){
  .drawer-scrim{top:18px;bottom:18px;height:calc(100vh - 36px);border-radius:30px}
  /* Desktop: dock the drawer to the RIGHT edge of the centered phone frame.
     Closed = slid fully off to the right; open = flush against the frame. */
  .drawer{top:18px;bottom:18px;height:calc(100vh - 36px);
    right:50%;margin-right:-240px;max-width:300px;border-radius:0 30px 30px 0;
    transform:translateX(340px)}
  .drawer.on{transform:translateX(0)}
}
@media(min-width:1024px){
  /* Full-width desktop: frame is edge-to-edge, so dock to the true right edge. */
  .drawer-scrim{left:0;transform:none;max-width:100%;top:0;bottom:0;height:100vh;border-radius:0}
  .drawer{right:0;margin-right:0;top:0;bottom:0;height:100vh;border-radius:0;max-width:340px;
    transform:translateX(360px)}
  .drawer.on{transform:translateX(0)}
}
.drawer-head{background:linear-gradient(135deg,${C.dark},${C.darkSoft});padding:16px 18px 20px;position:relative;border-radius:0 0 22px 22px}
.drawer-x{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.14);border:none;color:#fff;
  width:30px;height:30px;border-radius:50%;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.drawer-head-title{color:#fff;font-size:15px;font-weight:700;margin-bottom:16px}
.drawer-user{display:flex;align-items:center;gap:14px}
.drawer-ava{width:64px;height:64px;border-radius:50%;flex-shrink:0;object-fit:cover;
  background:linear-gradient(135deg,#a3c93a,${C.orange});display:flex;align-items:center;justify-content:center;
  color:#fff;font-size:26px;font-weight:800}
.drawer-login-btn{margin-top:8px;background:${C.orange};color:#fff;border:none;font-size:12px;font-weight:800;
  padding:7px 14px;border-radius:20px;cursor:pointer}
.drawer-name{color:#fff;font-size:19px;font-weight:800;line-height:1.1}
.drawer-mail{color:#a9cdbf;font-size:12px;margin-top:3px}
.drawer-tier{display:inline-block;margin-top:7px;background:${C.orange};color:#fff;font-size:10px;font-weight:800;
  padding:3px 11px;border-radius:20px;letter-spacing:.4px}
.drawer-stats{display:flex;gap:10px;padding:14px 16px 4px}
.dstat{flex:1;background:#fff;border-radius:14px;padding:12px 6px;text-align:center;box-shadow:0 2px 10px rgba(13,59,46,.06)}
.dstat b{display:block;font-size:19px;font-weight:800;color:${C.ink}}
.dstat span{font-size:10px;color:${C.muted}}
.drawer-menu{padding:12px 16px 26px;display:flex;flex-direction:column;gap:0}
.drawer-item{display:flex;align-items:center;gap:13px;background:#fff;border:none;
  border-bottom:1px solid ${C.line};padding:15px 14px;cursor:pointer;text-align:left;width:100%}
.drawer-item:first-child{border-radius:14px 14px 0 0}
.di-ic{font-size:18px;width:24px;text-align:center}
.di-label{flex:1;font-size:14px;font-weight:600;color:${C.ink}}
.drawer-item.logout{margin-top:14px;border-radius:14px;border-bottom:none}
.drawer-item.logout .di-label{color:#d64545}
.di-arrow{color:#c2cfc8;font-size:18px;font-weight:700}
.refer-box{background:#fff;border-bottom:1px solid ${C.line};padding:2px 14px 14px}
.refer-hint{font-size:12px;color:${C.muted};margin-bottom:8px}
.refer-code{display:flex;width:100%;justify-content:space-between;align-items:center;
  background:${C.greenSoft};border:1px dashed ${C.green};border-radius:10px;padding:10px 12px;cursor:pointer}
.refer-code span:first-child{font-family:monospace;font-weight:800;letter-spacing:1px;color:${C.ink}}
.refer-copy{font-size:11px;font-weight:800;color:${C.greenDeep}}
.soon-box{background:#fff;border-bottom:1px solid ${C.line};padding:0 14px 14px;font-size:12px;color:${C.orangeDeep}}
      `}</style>
    </>
  );
}
