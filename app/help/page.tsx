'use client';

/**
 * /help — the PUBLIC help centre.
 *
 * Why this exists separately from /account/support:
 *   the support page is login-gated (it shows *your* tickets), which meant a
 *   confused visitor who wasn't signed in could not read a single FAQ. Help is
 *   the one thing you should never have to log in for — someone who can't
 *   place an order is exactly the person who needs answers, and they may not
 *   even have an account yet.
 *
 * Same admin-managed content as the support page; no auth anywhere.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../components/AppShell';
import AppHeader from '../components/AppHeader';
import {
  C, FaqCategory, fetchFaq, trackFaqView, sendFaqFeedback, fetchStoreSettings,
} from '../lib/bite';

const voteBtn: React.CSSProperties = {
  background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16,
  padding: '5px 11px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', color: C.ink,
};

export default function HelpPage() {
  const router = useRouter();
  const [faq, setFaq] = useState<FaqCategory[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [voted, setVoted] = useState<Record<number, boolean>>({});
  const [phone, setPhone] = useState('');

  useEffect(() => {
    fetchFaq().then(setFaq).finally(() => setLoading(false));
    fetchStoreSettings()
      .then((st) => setPhone(st?.invoiceConfig?.phone || ''))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { fetchFaq(q).then(setFaq); }, 250);
    return () => clearTimeout(t);
  }, [q]);

  function toggle(id: number) {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next) trackFaqView(id);
  }
  function vote(id: number, helpful: boolean) {
    setVoted((v) => ({ ...v, [id]: helpful }));
    sendFaqFeedback(id, helpful);
  }

  const card: React.CSSProperties = {
    background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: 14,
  };

  return (
    <AppShell header={<AppHeader variant="page" title="Help" />}>
      <div className="bt-page-pad">
        <div style={{ margin: '2px 4px 12px' }}>
          <div style={{ fontSize: 19, fontWeight: 850, color: C.ink, letterSpacing: '-0.3px' }}>
            How can we help?
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>
            Search below — most questions are answered here in seconds.
          </div>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search help — e.g. refund, OTP, coupon"
          style={{
            width: '100%', border: `1px solid ${C.line}`, borderRadius: 12,
            padding: '12px 14px', fontSize: 14, marginBottom: 14, outline: 'none',
          }}
        />

        {loading ? (
          <div style={{ ...card, textAlign: 'center', color: C.muted, fontSize: 13 }}>
            Loading help…
          </div>
        ) : faq.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', color: C.muted, fontSize: 13 }}>
            {q ? `Nothing matches “${q}”.` : 'Help articles are on their way.'}
          </div>
        ) : faq.map((cat) => (
          <div key={cat.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '0 4px 7px' }}>
              <span style={{ fontSize: 15 }}>{cat.icon}</span>
              <span style={{ fontWeight: 800, fontSize: 13, color: C.ink }}>{cat.name}</span>
              <span style={{ fontSize: 11, color: C.muted }}>({cat.articles.length})</span>
            </div>
            <div style={{ ...card, padding: 4 }}>
              {cat.articles.map((a, i) => (
                <div key={a.id} style={{ borderBottom: i < cat.articles.length - 1 ? `1px solid ${C.line}` : 'none' }}>
                  <button
                    onClick={() => toggle(a.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      background: 'none', border: 'none', padding: '13px 12px',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 650, color: C.ink }}>
                      {a.question}
                    </span>
                    <span style={{
                      color: C.muted, fontSize: 13,
                      transform: openId === a.id ? 'rotate(90deg)' : 'none',
                      transition: 'transform .2s',
                    }}>›</span>
                  </button>

                  {openId === a.id && (
                    <div style={{ padding: '0 12px 13px' }}>
                      <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>{a.answer}</div>

                      {a.actionUrl && a.actionLabel && (
                        <button
                          onClick={() => router.push(a.actionUrl as string)}
                          style={{
                            marginTop: 10, background: C.greenSoft, color: C.greenDeep,
                            border: 'none', borderRadius: 9, padding: '8px 14px',
                            fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
                          }}
                        >
                          {a.actionLabel} →
                        </button>
                      )}

                      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {voted[a.id] === undefined ? (
                          <>
                            <span style={{ fontSize: 11.5, color: C.muted }}>Did this help?</span>
                            <button onClick={() => vote(a.id, true)} style={voteBtn}>👍 Yes</button>
                            <button onClick={() => vote(a.id, false)} style={voteBtn}>👎 No</button>
                          </>
                        ) : (
                          <span style={{ fontSize: 11.5, color: C.green, fontWeight: 700 }}>
                            {voted[a.id] ? 'Thanks for the feedback!' : 'Thanks — we&apos;ll improve this answer.'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* still stuck — call/WhatsApp works signed-out too */}
        {phone && (
          <div style={{
            ...card, marginBottom: 14, background: C.greenSoft,
            border: `1px solid ${C.green}`, textAlign: 'center', padding: 16,
          }}>
            <div style={{ fontSize: 22 }}>📞</div>
            <div style={{ fontWeight: 800, fontSize: 14, color: C.ink, marginTop: 4 }}>
              Still stuck? Talk to us
            </div>
            <div style={{ fontSize: 12.5, color: C.muted, margin: '4px 0 12px' }}>
              Urgent problem with a live order? Calling is fastest.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <a href={`tel:${phone.replace(/\s/g, '')}`} style={{
                flex: 1, maxWidth: 160, textDecoration: 'none', background: C.green,
                color: '#fff', borderRadius: 10, padding: '11px 14px', fontWeight: 800, fontSize: 13.5,
              }}>Call us</a>
              <a href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" style={{
                flex: 1, maxWidth: 160, textDecoration: 'none', background: '#25D366',
                color: '#fff', borderRadius: 10, padding: '11px 14px', fontWeight: 800, fontSize: 13.5,
              }}>WhatsApp</a>
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 10 }}>{phone}</div>
          </div>
        )}

        {/* raise a ticket — the only part that needs an account */}
        <div style={{ ...card, textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>
            Didn&apos;t find your answer? Raise a ticket and we&apos;ll get back to you.
          </div>
          <button
            onClick={() => router.push('/account/support')}
            style={{
              background: C.dark, color: '#fff', border: 'none', borderRadius: 10,
              padding: '11px 20px', fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
            }}
          >
            Contact support →
          </button>
        </div>
      </div>
    </AppShell>
  );
}
