'use client';

/**
 * /account/wallet — Wallet & Transactions.
 * Live balance + lifetime credited/debited from the API, and the full
 * ledger (credits = referrals/refunds/cashback, debits = used on orders).
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppShell from '../../components/AppShell';
import AppHeader from '../../components/AppHeader';
import {
  C, money, WalletTxn, WalletSummary,
  fetchWalletTransactions, fetchWalletSummary,
  LoyaltySummary, PointsEntry, fetchLoyaltySummary, fetchPointsHistory,
} from '../../lib/bite';

const TIER_EMOJI: Record<string, string> = {
  bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎',
};

function fmtDate(s?: string | null) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export default function WalletPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = (session?.user as any)?.id ? Number((session?.user as any).id) : undefined;

  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltySummary | null>(null);
  const [points, setPoints] = useState<PointsEntry[]>([]);
  const [tab, setTab] = useState<'wallet' | 'points'>('wallet');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login?callbackUrl=/account/wallet');
  }, [status, router]);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      fetchWalletSummary(userId),
      fetchWalletTransactions(userId),
      fetchLoyaltySummary(userId).catch(() => null),
      fetchPointsHistory(userId).catch(() => []),
    ])
      .then(([s, t, l, p]) => { setSummary(s); setTxns(t); setLoyalty(l); setPoints(p as PointsEntry[]); })
      .catch(() => setError('Could not load wallet'))
      .finally(() => setLoading(false));
  }, [userId]);

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid rgba(13,59,46,.06)', borderRadius: 18, padding: 15,
    boxShadow: '0 5px 16px rgba(13,59,46,.06)',
  };

  return (
    <AppShell header={<AppHeader variant="page" title="Wallet & Transactions" />}>
      <div style={{ padding: '14px 14px 28px' }}>
        {/* balance card */}
        <div style={{
          background: `linear-gradient(150deg, #124a37, ${C.dark})`,
          borderRadius: 22, padding: '22px 18px', color: '#fff', marginBottom: 14,
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 10px 28px rgba(13,59,46,.25)',
        }}>
          <div style={{
            position: 'absolute', top: -40, right: -30, width: 150, height: 150,
            borderRadius: '50%', pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(76,175,80,.35), transparent 70%)',
          }} />
          <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 700, letterSpacing: 0.4 }}>WALLET BALANCE</div>
          <div style={{ fontSize: 34, fontWeight: 800, margin: '6px 0 14px' }}>
            {loading ? '…' : money(summary?.balance || 0)}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.1)', borderRadius: 12, padding: '9px 12px' }}>
              <div style={{ fontSize: 10.5, opacity: 0.7 }}>Total added</div>
              <b style={{ fontSize: 15, color: '#a3e3b2' }}>{loading ? '…' : `+ ${money(summary?.totalCredited || 0)}`}</b>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.1)', borderRadius: 12, padding: '9px 12px' }}>
              <div style={{ fontSize: 10.5, opacity: 0.7 }}>Total spent</div>
              <b style={{ fontSize: 15, color: '#ffcf9e' }}>{loading ? '…' : `− ${money(summary?.totalDebited || 0)}`}</b>
            </div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.65, marginTop: 12 }}>
            Wallet money is applied at checkout — turn on “Use wallet” when placing an order.
          </div>
        </div>

        {/* loyalty / tier card */}
        <div style={{
          background: '#fff', border: `1.5px solid ${C.line}`, borderRadius: 16,
          padding: '15px 16px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>LOYALTY POINTS</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.orangeDeep }}>
                {loading ? '…' : (loyalty?.points ?? 0)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22 }}>{TIER_EMOJI[(loyalty?.tier || 'bronze')] || '🥉'}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.ink }}>
                {(loyalty?.tier || 'bronze').toUpperCase()}
              </div>
            </div>
          </div>
          {loyalty?.nextTier ? (
            <>
              <div style={{ height: 8, background: C.bg, borderRadius: 999, overflow: 'hidden', marginTop: 12 }}>
                <div style={{
                  width: `${Math.min(100, Math.round(((loyalty.points) / (loyalty.points + loyalty.pointsToNext || 1)) * 100))}%`,
                  height: '100%', background: `linear-gradient(90deg,${C.green},${C.orange})`, borderRadius: 999,
                }} />
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 7 }}>
                {loyalty.pointsToNext} more points to reach {loyalty.nextTier.toUpperCase()} {TIER_EMOJI[loyalty.nextTier]}
              </div>
            </>
          ) : !loading && (
            <div style={{ fontSize: 12, fontWeight: 700, color: C.greenDeep, marginTop: 10 }}>
              💎 Top tier — you're a legend!
            </div>
          )}
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
            Earn +50 on signup and +1 point per ₹100 spent.
          </div>
        </div>

        {error && (
          <div style={{ ...card, borderColor: '#f3c1c1', background: '#fdf0f0', color: '#c0392b', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['wallet', 'points'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                flex: 1, background: tab === t ? C.dark : '#fff', color: tab === t ? '#fff' : C.muted,
                border: `1.5px solid ${tab === t ? C.dark : C.line}`, borderRadius: 999,
                padding: '9px 0', fontSize: 13, fontWeight: 800, cursor: 'pointer',
              }}>
              {t === 'wallet' ? '💳 Wallet' : '⭐ Points'}
            </button>
          ))}
        </div>

        {tab === 'points' ? (
          loading ? (
            <div style={{ ...card, color: C.muted, fontSize: 13 }}>Loading points…</div>
          ) : points.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: 30 }}>
              <div style={{ fontSize: 34 }}>⭐</div>
              <div style={{ fontWeight: 800, color: C.ink, marginTop: 6 }}>No points yet</div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>Order something tasty to start earning.</div>
            </div>
          ) : (
            <div style={{ ...card, padding: '4px 14px' }}>
              {points.map((p) => {
                const earn = (p.type || 'earn').toLowerCase() === 'earn';
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: `1px solid ${C.line}` }}>
                    <span style={{ fontSize: 18 }}>{earn ? '⭐' : '🎁'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{p.reason || (earn ? 'Points earned' : 'Points redeemed')}</div>
                      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{fmtDate(p.createdAt)}</div>
                    </div>
                    <b style={{ fontSize: 14.5, color: earn ? C.orangeDeep : '#c0392b', whiteSpace: 'nowrap' }}>
                      {earn ? '+' : '−'}{Math.abs(Number(p.points) || 0)} pts
                    </b>
                  </div>
                );
              })}
            </div>
          )
        ) : (
        <>
        <div style={{ fontWeight: 800, fontSize: 14, color: C.ink, margin: '4px 2px 10px' }}>Transaction History</div>

        {loading ? (
          <div style={{ ...card, color: C.muted, fontSize: 13 }}>Loading transactions…</div>
        ) : txns.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: 30 }}>
            <div style={{ fontSize: 34 }}>💳</div>
            <div style={{ fontWeight: 800, color: C.ink, marginTop: 6 }}>No transactions yet</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>
              Refunds, referral rewards and cashback will show up here.
            </div>
          </div>
        ) : (
          <div style={{ ...card, padding: '4px 14px' }}>
            {txns.map((t) => {
              const credit = (t.type || '').toLowerCase() === 'credit';
              return (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 0', borderBottom: `1px solid ${C.line}`,
                }}>
                  <span style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    background: credit ? C.greenSoft : C.orangeSoft,
                  }}>
                    {credit ? '↓' : '↑'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>
                      {t.reason || (credit ? 'Wallet credit' : 'Wallet debit')}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{fmtDate(t.createdAt)}</div>
                  </div>
                  <b style={{ fontSize: 14.5, color: credit ? C.greenDeep : C.orangeDeep, whiteSpace: 'nowrap' }}>
                    {credit ? '+' : '−'} {money(Number(t.amount) || 0)}
                  </b>
                </div>
              );
            })}
          </div>
        )}
        </>
        )}
      </div>
    </AppShell>
  );
}
