'use client';

import { useRouter } from 'next/navigation';

/**
 * Shared header used across pages.
 * - `variant="home"` shows the brand + location + search.
 * - `variant="page"` shows a back button + title.
 */
export default function AppHeader({
  variant = 'page',
  title,
  onMenu,
  onAskBhaiya,
  showSearch = false,
}: {
  variant?: 'home' | 'page';
  title?: string;
  onMenu?: () => void;
  onAskBhaiya?: () => void;
  showSearch?: boolean;
}) {
  const router = useRouter();

  if (variant === 'home') {
    return (
      <header className="bt-head">
        <div className="bt-head-row">
          <div className="bt-brand">
            <span className="brandmark">B</span>
            <div>
              <div className="bt-brand-name">Bite Theory</div>
              <div className="bt-loc">📍 Indore</div>
            </div>
          </div>
          <div className="bt-head-actions">
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
              className="bt-icon-btn"
              aria-label="Open menu"
              onClick={onMenu}
            >
              ☰
            </button>
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
          <button className="bt-search">
            <span>🔍</span>
            <span className="bt-search-ph">
              Search thali, healthy meals, snacks…
            </span>
          </button>
        )}
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
