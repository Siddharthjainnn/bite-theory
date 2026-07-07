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
} from '../../lib/bite';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login?callbackUrl=/account/wallet');
  }, [status, router]);

  useEffect(() => {
    if (!userId) return;
    Promise.all([fetchWalletSummary(userId), fetchWalletTransactions(userId)])
      .then(([s, t]) => { setSummary(s); setTxns(t); })
      .catch(() => setError('Could not load wallet'))
      .finally(() => setLoading(false));
  }, [userId]);

  const card: React.CSSProperties = {
    background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 14,
  };

  return (
    <AppShell header={<AppHeader variant="page" title="Wallet & Transactions" />}>
      <div style={{ padding: '14px 14px 28px' }}>
        {/* balance card */}
        <div style={{
          background: `linear-gradient(135deg, ${C.dark}, ${C.darkSoft})`,
          borderRadius: 18, padding: '20px 18px', color: '#fff', marginBottom: 14,
        }}>
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

        {error && (
          <div style={{ ...card, borderColor: '#f3c1c1', background: '#fdf0f0', color: '#c0392b', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

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
      </div>
    </AppShell>
  );
}
