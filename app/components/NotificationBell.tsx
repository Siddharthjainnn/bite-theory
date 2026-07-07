'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { fetchNotifications, type AppNotification } from '../lib/bite';

const SEEN_KEY = 'bt_notif_seen_at';

/** Header bell: unread badge + slide-down panel, polls every 30s.
 *  "Unread" = created after the last time the panel was opened
 *  (tracked client-side, no schema change needed). */
export default function NotificationBell() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.dbId || (session?.user as any)?.id;

  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  function computeUnread(list: AppNotification[]) {
    const seen = Number(localStorage.getItem(SEEN_KEY) || 0);
    return list.filter((n) => n.createdAt && new Date(n.createdAt).getTime() > seen).length;
  }

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const load = () =>
      fetchNotifications(Number(userId))
        .then((list) => { if (alive) { setItems(list); setUnread(computeUnread(list)); } })
        .catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [userId]);

  /* close on outside click */
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      localStorage.setItem(SEEN_KEY, String(Date.now()));
      setUnread(0);
    }
  }

  if (!userId) return null;

  return (
    <div className="nb-wrap" ref={wrapRef}>
      <button className="bt-icon-btn nb-btn" aria-label="Notifications" onClick={toggle}>
        🔔
        {unread > 0 && <span className="nb-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="nb-panel">
          <div className="nb-title">Notifications</div>
          {items.length === 0 ? (
            <div className="nb-empty">🍽️ Nothing yet — order something tasty!</div>
          ) : (
            <div className="nb-list">
              {items.map((n) => (
                <div key={n.id} className="nb-item">
                  <div className="nb-item-title">{n.title}</div>
                  {n.body && <div className="nb-item-body">{n.body}</div>}
                  {n.createdAt && (
                    <div className="nb-item-time">
                      {new Date(n.createdAt).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .nb-wrap { position: relative; }
        .nb-btn { position: relative; }
        .nb-badge {
          position: absolute; top: -4px; right: -4px;
          background: #e53935; color: #fff; font-size: 10px; font-weight: 800;
          min-width: 16px; height: 16px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          padding: 0 4px; border: 2px solid #fff;
          animation: nbPulse 1.6s ease-in-out infinite;
        }
        @keyframes nbPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        .nb-panel {
          position: absolute; right: 0; top: calc(100% + 8px);
          width: min(320px, 86vw); max-height: 380px; overflow-y: auto;
          background: #fff; border: 1px solid #e4ebe6; border-radius: 14px;
          box-shadow: 0 12px 32px rgba(13, 59, 46, 0.18);
          z-index: 200; animation: nbDrop 0.22s ease;
        }
        @keyframes nbDrop {
          0% { opacity: 0; transform: translateY(-8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .nb-title {
          padding: 12px 14px 8px; font-weight: 800; font-size: 14px; color: #0d3b2e;
          border-bottom: 1px solid #eef3ef; position: sticky; top: 0; background: #fff;
        }
        .nb-empty { padding: 26px 14px; text-align: center; color: #6b7d74; font-size: 13px; }
        .nb-item { padding: 10px 14px; border-bottom: 1px solid #f2f6f3; }
        .nb-item:last-child { border-bottom: none; }
        .nb-item-title { font-weight: 700; font-size: 13px; color: #0d3b2e; }
        .nb-item-body { font-size: 12px; color: #4a5b52; margin-top: 2px; line-height: 1.4; }
        .nb-item-time { font-size: 10px; color: #9aaba1; margin-top: 4px; }
      `}</style>
    </div>
  );
}
