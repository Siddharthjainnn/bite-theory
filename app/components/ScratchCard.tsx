'use client';

/**
 * ScratchCard — canvas foil the user rubs off after a delivered order.
 * Reward is decided (and hidden) server-side; ~55% erased → auto-reveal,
 * POST /scratch-cards/:id/scratch pays out exactly once.
 */

import { useEffect, useRef, useState } from 'react';
import { API_BASE, C } from '../lib/bite';

type Card = { id: number; scratched: boolean; rewardType: string | null; rewardValue: number | null };

export default function ScratchCard({ orderId, userId }: { orderId: number; userId: number }) {
  const [card, setCard] = useState<Card | null>(null);
  const [revealed, setRevealed] = useState<Card | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!orderId || !userId) return;
    fetch(`${API_BASE}/scratch-cards/order/${orderId}?userId=${userId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((c: Card | null) => {
        if (!c) return;
        setCard(c);
        if (c.scratched) setRevealed(c);
      })
      .catch(() => {});
  }, [orderId, userId]);

  useEffect(() => {
    if (!card || card.scratched || revealed) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext('2d')!;
    // silver foil
    const grad = g.createLinearGradient(0, 0, cv.width, cv.height);
    grad.addColorStop(0, '#b8c0b8'); grad.addColorStop(0.5, '#e4e9e4'); grad.addColorStop(1, '#a9b2a9');
    g.fillStyle = grad; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#6d786d'; g.font = '700 15px system-ui'; g.textAlign = 'center';
    g.fillText('Yahan ragdo 👆', cv.width / 2, cv.height / 2 + 5);

    let down = false;
    const scratchAt = (x: number, y: number) => {
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.arc(x, y, 20, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'source-over';
    };
    const pos = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * cv.width, y: ((e.clientY - r.top) / r.height) * cv.height };
    };
    const checkDone = () => {
      if (doneRef.current) return;
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      let clear = 0;
      for (let i = 3; i < d.length; i += 16) if (d[i] === 0) clear++;
      if (clear / (d.length / 16) > 0.55) {
        doneRef.current = true;
        try { navigator.vibrate?.([40, 60, 40]); } catch {}
        fetch(`${API_BASE}/scratch-cards/${card.id}/scratch`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })
          .then((r) => r.json())
          .then((res: Card) => setRevealed(res))
          .catch(() => setRevealed({ ...card, scratched: true }));
      }
    };
    const onDown = (e: PointerEvent) => { down = true; const p = pos(e); scratchAt(p.x, p.y); };
    const onMove = (e: PointerEvent) => { if (!down) return; const p = pos(e); scratchAt(p.x, p.y); };
    const onUp = () => { down = false; checkDone(); };
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [card, revealed, userId]);

  if (!card) return null;

  const won = revealed && revealed.rewardType === 'cashback' && Number(revealed.rewardValue) > 0;

  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.dark}, #135a41)`, borderRadius: 16,
      padding: 16, margin: '12px 0', textAlign: 'center',
    }}>
      <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, marginBottom: 10 }}>
        {revealed ? (won ? '🎉 Jeet gaye!' : '🍀 Agli baar pakka!') : '🎁 Scratch karo — kuch mila hai!'}
      </div>
      <div style={{ position: 'relative', width: 240, height: 120, margin: '0 auto', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: won ? '#fff7e6' : '#f4f7f4',
        }}>
          {revealed ? (
            won ? (
              <>
                <div style={{ fontSize: 26, fontWeight: 800, color: C.orangeDeep }}>₹{Number(revealed.rewardValue)}</div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: C.greenDeep }}>wallet mein aa gaya ✓</div>
              </>
            ) : (
              <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, padding: '0 12px' }}>
                Better luck next order 😄
              </div>
            )
          ) : (
            <div style={{ fontSize: 24 }}>🎁</div>
          )}
        </div>
        {!revealed && (
          <canvas
            ref={canvasRef}
            width={240}
            height={120}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: 'pointer' }}
          />
        )}
      </div>
    </div>
  );
}
