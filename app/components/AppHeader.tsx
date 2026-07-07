'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import NotificationBell from './NotificationBell';

/**
 * Shared header used across pages.
 * - `variant="home"` shows the brand + location + a WORKING search box.
 * - `variant="page"` shows a back button + title.
 *
 * Search: typing + Enter (or the search icon) navigates to /menu?q=<term>.
 * Hamburger (☰) now sits on the LEFT, avatar on the right.
 */
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

  function runSearch() {
    const term = q.trim();
    router.push(term ? `/menu?q=${encodeURIComponent(term)}` : '/menu');
  }

  if (variant === 'home') {
    return (
      <header className="bt-head">
        <div className="bt-head-row">
          {/* LEFT: hamburger + brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="bt-icon-btn"
              aria-label="Open menu"
              onClick={onMenu}
            >
              ☰
            </button>
            <div className="bt-brand">
              <span className="brandmark">B</span>
              <div>
                <div className="bt-brand-name">Bite Theory</div>
                <div className="bt-loc">📍 Indore</div>
              </div>
            </div>
          </div>

          {/* RIGHT: Ask Bhaiya + avatar */}
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
            <button
              className="bt-avatar-btn"
              aria-label="Open profile"
              onClick={onMenu}
            >
              S
            </button>
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
          onClick={onMenu}
        >
          ☰
        </button>
      </div>
    </header>
  );
}
