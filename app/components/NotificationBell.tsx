'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { fetchNotifications, type AppNotification } from '../lib/bite';

const SEEN_KEY = 'bt_notif_seen_at';

/**
 * Header bell + notification centre.
 *
 * Design goals (fixes the clipped/overflowing mobile panel):
 *  - The panel is rendered as a FIXED overlay, so the phone-frame's
 *    `overflow:hidden` and the header's z-index can never clip it.
 *  - Mobile  → a bottom sheet with a dim backdrop (thumb-friendly).
 *  - Desktop → a floating card anchored under the bell.
 *  - Each notification gets a contextual icon + status colour derived
 *    from its title, so the list reads at a glance.
 *  - "Unread" = created after the last time the panel was opened
 *    (tracked client-side, no schema change needed).
 */
export default function NotificationBell() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.dbId || (session?.user as any)?.id;

  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  function computeUnread(list: AppNotification[]) {
    const seen = Number(localStorage.getItem(SEEN_KEY) || 0);
    return list.filter(
      (n) => n.createdAt && new Date(n.createdAt).getTime() > seen,
    ).length;
  }

  /* poll every 30s */
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const load = () =>
      fetchNotifications(Number(userId))
        .then((list) => {
          if (alive) {
            setItems(list);
            setUnread(computeUnread(list));
          }
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [userId]);

  /* close on Escape + lock background scroll while open */
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      localStorage.setItem(SEEN_KEY, String(Date.now()));
      setUnread(0);
    }
  }

  const lastSeen = useMemo(
    () => (typeof window !== 'undefined' ? Number(localStorage.getItem(SEEN_KEY) || 0) : 0),
    [open], // recomputed each open
  );

  if (!userId) return null;

  return (
    <div className="nb-wrap">
      <button
        className="bt-icon-btn nb-btn"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={toggle}
      >
        <BellIcon />
        {unread > 0 && (
          <span className="nb-badge">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <>
          <div
            className="nb-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="nb-panel"
            role="dialog"
            aria-label="Notifications"
          >
            <div className="nb-head">
              <div className="nb-grip" />
              <div className="nb-head-row">
                <div className="nb-title">
                  Notifications
                  {items.length > 0 && (
                    <span className="nb-count">{items.length}</span>
                  )}
                </div>
                <button
                  className="nb-close"
                  aria-label="Close notifications"
                  onClick={() => setOpen(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="nb-empty">
                <div className="nb-empty-emoji">🍽️</div>
                <div className="nb-empty-title">No notifications yet</div>
                <div className="nb-empty-sub">
                  Order something tasty and we&apos;ll keep you posted here.
                </div>
              </div>
            ) : (
              <div className="nb-list">
                {items.map((n) => {
                  const meta = statusMeta(n.title || '');
                  const isNew =
                    !!n.createdAt &&
                    new Date(n.createdAt).getTime() > lastSeen;
                  return (
                    <div
                      key={n.id}
                      className={`nb-item${isNew ? ' nb-item--new' : ''}`}
                    >
                      <div
                        className="nb-ic"
                        style={{ background: meta.tint, color: meta.color }}
                      >
                        {meta.icon}
                      </div>
                      <div className="nb-body">
                        <div className="nb-item-title">
                          {n.title}
                          {isNew && <span className="nb-dot" />}
                        </div>
                        {n.body && (
                          <div className="nb-item-body">{n.body}</div>
                        )}
                        {n.createdAt && (
                          <div className="nb-item-time">
                            {timeAgo(n.createdAt)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <style jsx>{`
        .nb-wrap {
          position: relative;
          display: flex;
        }
        .nb-btn {
          position: relative;
        }
        .nb-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          background: #ef4444;
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          min-width: 17px;
          height: 17px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          border: 2px solid #0d3b2e;
          box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.4);
          animation: nbPulse 1.8s ease-in-out infinite;
        }
        @keyframes nbPulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.18);
          }
        }

        /* dim backdrop — covers the whole viewport, sits under the panel */
        .nb-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(9, 30, 24, 0.42);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          z-index: 900;
          animation: nbFade 0.18s ease;
        }
        @keyframes nbFade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* ── MOBILE: bottom sheet ── */
        .nb-panel {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 901;
          background: #fff;
          border-radius: 22px 22px 0 0;
          box-shadow: 0 -14px 44px rgba(9, 30, 24, 0.28);
          max-height: 78vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding-bottom: env(safe-area-inset-bottom, 0px);
          animation: nbSheet 0.26s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes nbSheet {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .nb-head {
          flex: 0 0 auto;
          background: #fff;
          border-bottom: 1px solid #eef3ef;
        }
        .nb-grip {
          width: 40px;
          height: 4px;
          border-radius: 3px;
          background: #d6e0da;
          margin: 8px auto 2px;
        }
        .nb-head-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 16px 12px;
        }
        .nb-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 800;
          font-size: 16px;
          color: #0d3b2e;
          letter-spacing: -0.01em;
        }
        .nb-count {
          font-size: 11px;
          font-weight: 800;
          color: #2f8f5b;
          background: #e8f6ee;
          border-radius: 10px;
          padding: 2px 8px;
          line-height: 1.4;
        }
        .nb-close {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          border: none;
          background: #f2f6f3;
          color: #5b6d64;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }
        .nb-close:hover {
          background: #e6ede8;
        }

        .nb-list {
          flex: 1 1 auto;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: 6px 0 10px;
        }
        .nb-item {
          display: flex;
          gap: 12px;
          padding: 12px 16px;
          border-bottom: 1px solid #f4f7f5;
          align-items: flex-start;
        }
        .nb-item:last-child {
          border-bottom: none;
        }
        .nb-item--new {
          background: linear-gradient(
            90deg,
            #f1fbf5 0%,
            rgba(241, 251, 245, 0) 90%
          );
        }
        .nb-ic {
          flex: 0 0 auto;
          width: 38px;
          height: 38px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }
        .nb-body {
          min-width: 0;
          flex: 1 1 auto;
        }
        .nb-item-title {
          display: flex;
          align-items: center;
          gap: 7px;
          font-weight: 700;
          font-size: 13.5px;
          color: #0d3b2e;
          line-height: 1.3;
        }
        .nb-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #2f8f5b;
          flex: 0 0 auto;
        }
        .nb-item-body {
          font-size: 12.5px;
          color: #55665d;
          margin-top: 3px;
          line-height: 1.45;
          /* wrap cleanly — never clip long order strings */
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .nb-item-time {
          font-size: 11px;
          color: #9aaba1;
          margin-top: 5px;
          font-weight: 600;
        }

        .nb-empty {
          padding: 40px 24px 46px;
          text-align: center;
        }
        .nb-empty-emoji {
          font-size: 40px;
        }
        .nb-empty-title {
          margin-top: 12px;
          font-weight: 800;
          font-size: 15px;
          color: #0d3b2e;
        }
        .nb-empty-sub {
          margin-top: 6px;
          font-size: 13px;
          color: #7a8b82;
          line-height: 1.5;
        }

        /* ── DESKTOP / TABLET: floating card under the bell ── */
        @media (min-width: 520px) {
          .nb-backdrop {
            background: rgba(9, 30, 24, 0.18);
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
          }
          .nb-panel {
            position: absolute;
            left: auto;
            right: 0;
            bottom: auto;
            top: calc(100% + 10px);
            width: 360px;
            max-height: 460px;
            border-radius: 16px;
            box-shadow: 0 18px 46px rgba(9, 30, 24, 0.22);
            animation: nbDrop 0.2s ease;
          }
          @keyframes nbDrop {
            from {
              opacity: 0;
              transform: translateY(-8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .nb-grip {
            display: none;
          }
          .nb-head-row {
            padding: 14px 16px 12px;
          }
        }
      `}</style>
    </div>
  );
}

/* ── inline bell icon (crisp on all DPRs, inherits header colour) ── */
function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

/* Map a notification title to an icon + colour so the list reads at a glance.
   Falls back to a neutral bell for anything unrecognised. */
function statusMeta(title: string): {
  icon: string;
  color: string;
  tint: string;
} {
  const t = title.toLowerCase();
  if (t.includes('deliver') && t.includes('enjoy'))
    return { icon: '🎉', color: '#137a43', tint: '#e7f7ee' }; // delivered
  if (t.includes('out for delivery'))
    return { icon: '🛵', color: '#0e7490', tint: '#e2f5f9' };
  if (t.includes('arriving'))
    return { icon: '📍', color: '#b45309', tint: '#fdf0dc' };
  if (t.includes('rider'))
    return { icon: '🛵', color: '#0e7490', tint: '#e2f5f9' };
  if (t.includes('ready'))
    return { icon: '🍱', color: '#7c5e10', tint: '#fbf4dd' };
  if (t.includes('cooking') || t.includes('preparing'))
    return { icon: '👨‍🍳', color: '#a15a17', tint: '#fbeede' };
  if (t.includes('confirm'))
    return { icon: '✅', color: '#137a43', tint: '#e7f7ee' };
  if (t.includes('cancel'))
    return { icon: '❌', color: '#b42318', tint: '#fdecea' };
  if (t.includes('refund'))
    return { icon: '💸', color: '#5b21b6', tint: '#f0eafb' };
  return { icon: '🔔', color: '#0d3b2e', tint: '#eef3ef' };
}

/* Relative "time ago" for freshness, with an absolute fallback for older ones. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(0, Math.floor((now - then) / 1000));
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
