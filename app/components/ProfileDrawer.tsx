'use client';

import { useSession, signOut, signIn } from 'next-auth/react';
import { C, money } from '../lib/bite';

const ITEMS = [
  { ic: '🧾', label: 'Order History' },
  { ic: '📍', label: 'Saved Addresses' },
  { ic: '💳', label: 'Wallet & Transactions' },
  { ic: '🎟️', label: 'My Coupons' },
  { ic: '🎁', label: 'Refer & Earn' },
  { ic: '❤️', label: 'Favorites' },
  { ic: '⭐', label: 'My Reviews' },
  { ic: '🛟', label: 'Help & Support' },
  { ic: 'ℹ️', label: 'About Bite Theory' },
  { ic: '📄', label: 'Terms & Privacy' },
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
  const user = session?.user as any;
  const loggedIn = status === 'authenticated';

  const tier = (user?.loyaltyLevel || 'bronze').toString().toUpperCase();

  return (
    <>
      <div
        className={`drawer-scrim ${open ? 'on' : ''}`}
        onClick={onClose}
        aria-hidden
      />
      <aside className={`drawer ${open ? 'on' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <button className="drawer-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
          <div className="drawer-head-title">My Profile</div>
          {loggedIn ? (
            <div className="drawer-user">
              {user?.image ? (
                <img
                  className="drawer-ava"
                  src={user.image}
                  alt={user.name || 'You'}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="drawer-ava">{initials(user?.name)}</span>
              )}
              <div>
                <div className="drawer-name">{user?.name || 'Bite Theory User'}</div>
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
                <button
                  onClick={() => signIn('google')}
                  className="drawer-login-btn"
                >
                  Login / Sign up →
                </button>
              </div>
            </div>
          )}
        </div>

        {loggedIn && (
          <div className="drawer-stats">
            <div className="dstat">
              <b>{user?.ordersCount ?? '—'}</b>
              <span>Orders</span>
            </div>
            <div className="dstat">
              <b style={{ color: C.green }}>
                {money(user?.walletBalance || 0)}
              </b>
              <span>Wallet</span>
            </div>
            <div className="dstat">
              <b style={{ color: C.orange }}>{user?.loyaltyPoints || 0}</b>
              <span>Points</span>
            </div>
          </div>
        )}

        <div className="drawer-menu">
          {ITEMS.map((it) => (
            <button key={it.label} className="drawer-item">
              <span className="di-ic">{it.ic}</span>
              <span className="di-label">{it.label}</span>
              <span className="di-arrow">›</span>
            </button>
          ))}
          {loggedIn && (
            <button
              className="drawer-item logout"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <span className="di-ic">↩️</span>
              <span className="di-label">Logout</span>
              <span className="di-arrow">›</span>
            </button>
          )}
        </div>
      </aside>

      <style>{`
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
  .drawer{top:18px;bottom:18px;height:calc(100vh - 36px);right:50%;margin-right:-240px;max-width:300px;border-radius:0 30px 30px 0}
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
.drawer-item:last-child{border-radius:0 0 14px 14px;border-bottom:none}
.di-ic{font-size:18px;width:24px;text-align:center}
.di-label{flex:1;font-size:14px;font-weight:600;color:${C.ink}}
.drawer-item.logout{margin-top:14px;border-radius:14px}
.drawer-item.logout .di-label{color:#d64545}
.di-arrow{color:#c2cfc8;font-size:18px;font-weight:700}
      `}</style>
    </>
  );
}
