'use client';

/**
 * /account/profile — the profile SCREEN.
 *
 * Fix: "My Profile" pointed at /account/profile which only had a route.ts
 * (API) and no page.tsx — so it showed raw JSON / broke. The API now lives at
 * /account/profile/api; this is the real page and reads/writes to it.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import AppShell from '../../components/AppShell';
import AppHeader from '../../components/AppHeader';
import { C, money } from '../../lib/bite';

interface ProfileUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  profile_image?: string | null;
  wallet_balance?: number;
  loyalty_points?: number;
  loyalty_level?: string;
  referral_code?: string;
}

const TIER_EMOJI: Record<string, string> = {
  bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎',
};

export default function ProfilePage() {
  const router = useRouter();
  const { status } = useSession();

  const [user, setUser] = useState<ProfileUser | null>(null);
  const [stats, setStats] = useState<{ orders: number; favorites: number }>({ orders: 0, favorites: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login?callbackUrl=/account/profile');
  }, [status, router]);

  useEffect(() => {
    fetch('/account/profile/api', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setUser(d.user);
        setStats(d.stats || { orders: 0, favorites: 0 });
        setFirstName(d.user?.first_name || '');
        setLastName(d.user?.last_name || '');
        setMobile(d.user?.mobile || '');
      })
      .catch(() => setError('Could not load your profile'))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaveErr(''); setSaving(true);
    try {
      const res = await fetch('/account/profile/api', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, mobile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setUser((u) => (u ? { ...u, first_name: firstName, last_name: lastName, mobile } : u));
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (e: any) {
      setSaveErr(e.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  const fullName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '';
  const initial = (user?.first_name || user?.email || 'U').charAt(0).toUpperCase();
  const tier = (user?.loyalty_level || 'bronze').toLowerCase();

  const input: React.CSSProperties = {
    width: '100%', border: '1px solid rgba(13,59,46,.12)', borderRadius: 12,
    padding: '12px 14px', fontSize: 14, outline: 'none', background: '#fff',
  };
  const menu = [
    { href: '/orders', icon: '🧾', label: 'My Orders' },
    { href: '/account/wallet', icon: '💳', label: 'Wallet & Points' },
    { href: '/account/addresses', icon: '📍', label: 'Saved Addresses' },
    { href: '/account/favorites', icon: '❤️', label: 'Favourites' },
    { href: '/account/reviews', icon: '⭐', label: 'My Reviews' },
    { href: '/help', icon: '💬', label: 'Help & Support' },
  ];

  return (
    <AppShell header={<AppHeader variant="page" title="My Profile" />}>
      <div className="bt-page-pad pf-wrap">
        {loading ? (
          <div className="pf-card skel" style={{ height: 120 }} />
        ) : error ? (
          <div className="bt-empty">{error}</div>
        ) : user ? (
          <>
            <div className="pf-id">
              <div className="pf-avatar">
                {user.profile_image
                  ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={user.profile_image} alt={fullName} />
                  : initial}
              </div>
              <div className="pf-id-info">
                <div className="pf-name">{fullName || 'Your name'}</div>
                <div className="pf-email">{user.email}</div>
                <div className="pf-mobile">{user.mobile ? `📱 ${user.mobile}` : 'No mobile added'}</div>
              </div>
              <span className={`pf-tier pf-tier--${tier}`}>
                {TIER_EMOJI[tier] || '🥉'} {tier}
              </span>
            </div>

            {saved && <div className="pf-saved">✓ Profile updated</div>}

            <div className="pf-stats">
              <div className="pf-stat"><b>{stats.orders}</b><span>Orders</span></div>
              <div className="pf-stat"><b>{money(user.wallet_balance || 0)}</b><span>Wallet</span></div>
              <div className="pf-stat"><b>{user.loyalty_points || 0}</b><span>Points</span></div>
              <div className="pf-stat"><b>{stats.favorites}</b><span>Favourites</span></div>
            </div>

            <div className="pf-card">
              <div className="pf-card-head">
                <span>Personal details</span>
                {!editing && <button className="pf-edit" onClick={() => setEditing(true)}>Edit</button>}
              </div>

              {!editing ? (
                <div className="pf-rows">
                  <div className="pf-row"><span>Name</span><b>{fullName || '—'}</b></div>
                  <div className="pf-row"><span>Mobile</span><b>{user.mobile || '—'}</b></div>
                  <div className="pf-row"><span>Email</span><b>{user.email}</b></div>
                  {user.referral_code && (
                    <div className="pf-row"><span>Referral code</span><b>{user.referral_code}</b></div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input style={input} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    <input style={input} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                  <input style={input} placeholder="Mobile number" inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value)} />
                  {saveErr && <div className="pf-err">{saveErr}</div>}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="pf-save" onClick={save} disabled={saving}>
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                    <button className="pf-cancel" onClick={() => { setEditing(false); setSaveErr(''); setFirstName(user.first_name || ''); setLastName(user.last_name || ''); setMobile(user.mobile || ''); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="pf-menu">
              {menu.map((m) => (
                <button key={m.href} className="pf-menu-i" onClick={() => router.push(m.href)}>
                  <span className="pf-menu-ic">{m.icon}</span>
                  <span className="pf-menu-lbl">{m.label}</span>
                  <span className="pf-menu-arrow">›</span>
                </button>
              ))}
            </div>

            <button className="pf-logout" onClick={() => signOut({ callbackUrl: '/' })}>
              Log out
            </button>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
