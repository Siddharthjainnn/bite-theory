'use client';

/**
 * StreakCard — "🔥 N healthy days" with one-tap WhatsApp/Insta share.
 * Streak comes from GET /orders/streak/:userId (server counts consecutive
 * IST days whose delivered orders hit the protein threshold). The share
 * image is drawn on a client-side canvas — zero servers, zero cost.
 */

import { useEffect, useState } from 'react';
import { C, fetchStreak } from '../lib/bite';

export default function StreakCard({ userId, userName }: { userId: number; userName?: string }) {
  const [streak, setStreak] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetchStreak(userId)
      .then((d) => setStreak(Number(d.streak) || 0))
      .catch(() => setStreak(0));
  }, [userId]);

  async function share() {
    if (!streak) return;
    setSharing(true);
    try {
      const cv = document.createElement('canvas');
      cv.width = 1080; cv.height = 1350;
      const g = cv.getContext('2d')!;
      // brand gradient bg
      const grad = g.createLinearGradient(0, 0, 0, 1350);
      grad.addColorStop(0, '#0D3B2E'); grad.addColorStop(0.6, '#0f4633'); grad.addColorStop(1, '#135a41');
      g.fillStyle = grad; g.fillRect(0, 0, 1080, 1350);
      // glow
      const rg = g.createRadialGradient(540, 430, 60, 540, 430, 420);
      rg.addColorStop(0, 'rgba(126,231,135,.28)'); rg.addColorStop(1, 'rgba(126,231,135,0)');
      g.fillStyle = rg; g.fillRect(0, 0, 1080, 1350);
      g.textAlign = 'center';
      g.font = '200px serif'; g.fillText('🔥', 540, 400);
      g.fillStyle = '#fff'; g.font = '800 220px system-ui, sans-serif';
      g.fillText(String(streak), 540, 640);
      g.font = '800 64px system-ui, sans-serif';
      g.fillText(streak === 1 ? 'HEALTHY DAY' : 'HEALTHY DAYS', 540, 730);
      g.fillStyle = '#cfe6da'; g.font = '600 40px system-ui, sans-serif';
      if (userName) g.fillText(`${userName} is on a roll!`, 540, 810);
      g.fillStyle = '#7ee787'; g.font = '800 44px system-ui, sans-serif';
      g.fillText('Bites Theory', 540, 1180);
      g.fillStyle = '#cfe6da'; g.font = '600 30px system-ui, sans-serif';
      g.fillText('Smart Food. Better Living.', 540, 1230);
      const blob: Blob = await new Promise((res, rej) =>
        cv.toBlob((b) => (b ? res(b) : rej(new Error('render failed'))), 'image/png'));
      const file = new File([blob], 'bites-theory-streak.png', { type: 'image/png' });
      if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: `🔥 ${streak} healthy days on Bites Theory! Smart Food. Better Living.`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'bites-theory-streak.png'; a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* user cancelled share — fine */ }
    setSharing(false);
  }

  if (streak === null) return null;

  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.dark}, #135a41)`, borderRadius: 14,
      padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0',
    }}>
      <span style={{ fontSize: 26 }}>🔥</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>
          {streak > 0 ? `${streak} healthy day${streak === 1 ? '' : 's'} streak!` : 'Healthy streak shuru karo!'}
        </div>
        <div style={{ color: '#cfe6da', fontSize: 11 }}>
          {streak > 0
            ? 'Aaj bhi 25g+ protein order karke streak badhao 💪'
            : '25g+ protein wale din streak banate hain 💪'}
        </div>
      </div>
      {streak > 0 && (
        <button
          onClick={share}
          disabled={sharing}
          style={{
            background: '#7ee787', color: C.dark, border: 'none', borderRadius: 10,
            padding: '9px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0,
          }}
        >
          {sharing ? '…' : 'Share 📤'}
        </button>
      )}
    </div>
  );
}
