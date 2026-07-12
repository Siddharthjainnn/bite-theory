'use client';

/** FlashDealBar — live countdown banner when an admin flash deal is running. */

import { useEffect, useState } from 'react';
import { API_BASE, C } from '../lib/bite';

export type FlashDeal = { id: number; title: string; discountPct: number; endsAt: string };

export function useFlashDeal(): FlashDeal | null {
  const [deal, setDeal] = useState<FlashDeal | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`${API_BASE}/flash-deals/current`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive) setDeal(d && d.id ? d : null); })
        .catch(() => {});
    load();
    const t = setInterval(load, 60000); // re-check every minute
    return () => { alive = false; clearInterval(t); };
  }, []);
  return deal;
}

export default function FlashDealBar() {
  const deal = useFlashDeal();
  const [left, setLeft] = useState('');

  useEffect(() => {
    if (!deal) return;
    const tick = () => {
      const ms = new Date(deal.endsAt).getTime() - Date.now();
      if (ms <= 0) { setLeft(''); return; }
      const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
      setLeft(`${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deal]);

  if (!deal || !left) return null;
  return (
    <div style={{
      background: `linear-gradient(90deg, ${C.orange}, #f7a73a)`, borderRadius: 12,
      padding: '10px 14px', margin: '10px 0', display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 6px 18px rgba(245,158,11,.35)',
    }}>
      <span style={{ fontSize: 20 }}>⚡</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 13.5 }}>
          {deal.title} — {Number(deal.discountPct)}% OFF sab pe!
        </div>
        <div style={{ color: 'rgba(255,255,255,.9)', fontSize: 11, fontWeight: 700 }}>
          Auto-applied at checkout · khatam hone mein {left}
        </div>
      </div>
    </div>
  );
}
