'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import AppShell from '../components/AppShell';
import AppHeader from '../components/AppHeader';
import { API_BASE, C, money, fetchMyGiftedCoupons } from '../lib/bite';

interface CouponRow {
  id: number;
  code: string;
  description?: string;
  discountType?: string; discount_type?: string;
  discountValue?: number; discount_value?: number;
  minOrder?: number; min_order?: number;
  maxDiscount?: number; max_discount?: number;
  validUntil?: string; valid_until?: string;
  isActive?: boolean; is_active?: boolean;
}

function normalize(c: CouponRow) {
  const type = (c.discountType ?? c.discount_type ?? 'percentage').toLowerCase();
  const value = Number(c.discountValue ?? c.discount_value ?? 0);
  const minOrder = Number(c.minOrder ?? c.min_order ?? 0);
  const maxDiscount = Number(c.maxDiscount ?? c.max_discount ?? 0);
  const until = c.validUntil ?? c.valid_until ?? null;
  const active = c.isActive ?? c.is_active ?? true;
  return { id: c.id, code: c.code, description: c.description || '', type, value, minOrder, maxDiscount, until, active };
}

export default function CouponsPage() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id ? Number((session?.user as any).id) : undefined;
  const [rows, setRows] = useState<ReturnType<typeof normalize>[]>([]);
  const [gifted, setGifted] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) { setGifted([]); return; }
    fetchMyGiftedCoupons(userId).then(setGifted).catch(() => setGifted([]));
  }, [userId]);

  useEffect(() => {
    fetch(`${API_BASE}/coupons`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: CouponRow[]) => {
        const now = Date.now();
        setRows(
          (data || [])
            .map(normalize)
            .filter((c) => c.active !== false && (!c.until || new Date(c.until).getTime() > now)),
        );
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // clipboard blocked — select-fallback
    }
    setCopied(code);
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 1600);
  }

  function label(c: ReturnType<typeof normalize>) {
    const off = c.type === 'flat' || c.type === 'fixed' ? money(c.value) : `${c.value}%`;
    return `${off} OFF`;
  }

  return (
    <AppShell header={<AppHeader variant="page" title="My Coupons" />}>
      <div style={{ padding: '14px 14px 24px' }}>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
          Tap a coupon to copy the code, then paste it at checkout.
        </div>

        {gifted.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: C.ink, marginBottom: 10 }}>🎁 Just for you</div>
            {gifted.map((g) => (
              <div
                key={g.id}
                style={{
                  position: 'relative', background: `linear-gradient(135deg, ${C.greenSoft}, #fff)`,
                  border: `1.5px solid ${C.green}`, borderRadius: 16, padding: '14px 16px', marginBottom: 12,
                }}
              >
                <div style={{ display: 'inline-block', background: C.green, color: '#fff', fontWeight: 800, fontSize: 11, padding: '3px 10px', borderRadius: 999, marginBottom: 8 }}>
                  GIFTED
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{g.description || 'A coupon just for you'}</div>
                {g.note && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{g.note}</div>}
                <button
                  onClick={() => copy(g.code)}
                  style={{
                    marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
                  }}
                >
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 15, letterSpacing: 1, color: C.ink }}>{g.code}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: copied === g.code ? C.green : C.orangeDeep }}>
                    {copied === g.code ? '✓ COPIED' : 'COPY'}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skel" style={{ height: 96, borderRadius: 16, marginBottom: 12 }} />
          ))
        ) : rows.length === 0 ? (
          <div className="bt-empty">No active coupons right now. Check back soon! 🎟️</div>
        ) : (
          rows.map((c) => (
            <div
              key={c.id}
              style={{
                position: 'relative', background: '#fff', border: `1.5px dashed ${C.green}`,
                borderRadius: 16, padding: '14px 16px', marginBottom: 12,
                boxShadow: '0 2px 12px rgba(13,59,46,.06)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'inline-block', background: C.greenSoft, color: C.greenDeep, fontWeight: 800, fontSize: 12, padding: '3px 10px', borderRadius: 999, marginBottom: 8 }}>
                    {label(c)}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{c.description || 'Special discount'}</div>
                  {c.minOrder > 0 && (
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                      Min order {money(c.minOrder)}{c.maxDiscount > 0 ? ` · up to ${money(c.maxDiscount)} off` : ''}
                    </div>
                  )}
                  {c.until && (
                    <div style={{ fontSize: 11, color: C.orangeDeep, marginTop: 4 }}>
                      Valid till {new Date(c.until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => copy(c.code)}
                style={{
                  marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
                }}
              >
                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 15, letterSpacing: 1, color: C.ink }}>
                  {c.code}
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, color: copied === c.code ? C.green : C.orangeDeep }}>
                  {copied === c.code ? '✓ COPIED' : 'COPY'}
                </span>
              </button>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
