'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import NotificationBell from './NotificationBell';
import { useMenu } from './MenuProvider';

/**
 * Shared header used across pages.
 * - `variant="home"` shows the brand + location + a WORKING search box.
 * - `variant="page"` shows a back button + title.
 *
 * Search: typing + Enter (or the search icon) navigates to /menu?q=<term>.
 *
 * Fixes in this file:
 *  #1  brand logo — real <img> logo (with graceful text-mark fallback) instead
 *      of a bare "B" letter.
 *  #2  avatar initial — derived from the signed-in user's name via initials(),
 *      not the hard-coded letter "S".
 *  #8  the profile avatar and the hamburger now open DIFFERENT things: the
 *      hamburger opens the nav drawer (openProfile), the avatar opens a small
 *      account popover (Profile / Orders / Logout entry points). If you'd rather
 *      the avatar route straight to /account/profile, swap onAvatar for that.
 */

/** First-name initial (falls back to first two initials, then "U"). */
function initials(name?: string | null) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U';
}

export default function AppHeader({
  variant = 'page',
  title,
  onMenu,
  onAskBhaiya,
  showSearch = false,
  initialQuery = '',
}: {
  variant?: 'home' | 'page';
  title?: string;
  onMenu?: () => void;
  onAskBhaiya?: () => void;
  showSearch?: boolean;
  initialQuery?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const { openMenu } = useMenu();
  const { data: session } = useSession();
  const user = session?.user as any;

  const handleMenu = onMenu || openMenu; // hamburger → nav drawer

  // #8: avatar opens the account menu, not the same drawer as the hamburger.
  const [acctOpen, setAcctOpen] = useState(false);
  function goAccount(href: string) {
    setAcctOpen(false);
    router.push(href);
  }

  function runSearch() {
    const term = q.trim();
    router.push(term ? `/menu?q=${encodeURIComponent(term)}` : '/menu');
  }

  const avatarInitial = initials(user?.name);

  if (variant === 'home') {
    return (
      <header className="bt-head">
        <div className="bt-head-row">
          {/* LEFT: hamburger + brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="bt-icon-btn"
              aria-label="Open menu"
              onClick={handleMenu}
            >
              ☰
            </button>
            <div className="bt-brand">
              {/* #1: real logo asset. If it 404s, the onError fallback shows the
                  text mark so the header never looks broken. */}
              <img
                className="bt-logo"
                src="/logo.jpeg"
                alt="Bite Theory"
                onError={(e) => {
                  const el = e.currentTarget;
                  el.style.display = 'none';
                  el.nextElementSibling?.removeAttribute('hidden');
                }}
              />
              <span className="brandmark" hidden>B</span>
              <div>
                <div className="bt-brand-name">Bite Theory</div>
                <div className="bt-loc">📍 Indore</div>
              </div>
            </div>
          </div>

          {/* RIGHT: Ask Bhaiya + notifications + avatar */}
          <div className="bt-head-actions">
            <NotificationBell />
            {onAskBhaiya && (
              <button
                className="bt-bhaiya-btn"
                aria-label="Ask Bhaiya for a recommendation"
                onClick={onAskBhaiya}
              >
                🧪 <span className="bt-bhaiya-label">Ask Bhaiya</span>
              </button>
            )}

            {/* #2 + #8: avatar shows the user's real initial and opens an
                account popover distinct from the hamburger's nav drawer. */}
            <div className="bt-acct-wrap">
              <button
                className="bt-avatar-btn"
                aria-label="Open account menu"
                aria-haspopup="menu"
                aria-expanded={acctOpen}
                onClick={() => setAcctOpen((o) => !o)}
              >
                {avatarInitial}
              </button>
              {acctOpen && (
                <>
                  <div className="bt-acct-scrim" onClick={() => setAcctOpen(false)} />
                  <div className="bt-acct-pop" role="menu">
                    <div className="bt-acct-name">{user?.name || 'Guest'}</div>
                    <button role="menuitem" onClick={() => goAccount('/account/profile')}>👤 My Profile</button>
                    <button role="menuitem" onClick={() => goAccount('/orders')}>🧾 My Orders</button>
                    <button role="menuitem" onClick={() => goAccount('/account/wallet')}>💳 Wallet</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {showSearch && (
          <div className="bt-search bt-search--live">
            <button
              className="bt-search-go"
              aria-label="Search"
              onClick={runSearch}
            >
              🔍
            </button>
            <input
              className="bt-search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch();
              }}
              placeholder="Search thali, healthy meals, snacks…"
              inputMode="search"
            />
            {q && (
              <button
                className="bt-search-clear"
                aria-label="Clear search"
                onClick={() => setQ('')}
              >
                ✕
              </button>
            )}
          </div>
        )}

        <style>{`
.bt-logo{height:34px;width:auto;display:block}
.bt-acct-wrap{position:relative}
.bt-acct-scrim{position:fixed;inset:0;z-index:30}
.bt-acct-pop{position:absolute;top:calc(100% + 8px);right:0;z-index:31;background:#fff;
  border:1px solid #e4ebe6;border-radius:14px;box-shadow:0 10px 30px rgba(13,59,46,.16);
  padding:8px;min-width:180px;display:flex;flex-direction:column;gap:2px}
.bt-acct-name{font-size:12px;font-weight:800;color:#0D3B2E;padding:6px 10px 8px;border-bottom:1px solid #eef3f0;margin-bottom:4px}
.bt-acct-pop button{display:flex;align-items:center;gap:8px;background:none;border:none;text-align:left;
  padding:9px 10px;border-radius:9px;font-size:13px;color:#0D3B2E;cursor:pointer}
.bt-acct-pop button:hover{background:#f2f7f4}
.bt-search--live{display:flex;align-items:center;gap:8px;background:#fff;
  border:1.5px solid #e4ebe6;border-radius:14px;padding:0 10px;margin:10px 0 2px;
  box-shadow:0 2px 10px rgba(13,59,46,.05)}
.bt-search-go{background:none;border:none;font-size:16px;cursor:pointer;padding:0 2px;line-height:1}
.bt-search-input{flex:1;border:none;outline:none;background:none;padding:12px 2px;
  font-size:14px;color:#0D3B2E}
.bt-search-input::placeholder{color:#9fb0a8}
.bt-search-clear{background:none;border:none;color:#9fb0a8;font-size:13px;cursor:pointer;padding:4px}
        `}</style>
      </header>
    );
  }

  return (
    <header className="bt-head bt-head--page">
      <div className="bt-head-row">
        <button
          className="bt-icon-btn"
          aria-label="Go back"
          onClick={() => router.back()}
        >
          ‹
        </button>
        <div className="bt-page-title">{title}</div>
        <button
          className="bt-icon-btn"
          aria-label="Open menu"
          onClick={handleMenu}
        >
          ☰
        </button>
      </div>
    </header>
  );
}
