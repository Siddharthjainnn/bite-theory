'use client';

/**
 * /account/support — raise a support ticket and see your past ones.
 * Fixes #53 (user could not create a ticket) and, by feeding the same
 * backend, #27 (admin now receives user-raised tickets via GET /support-tickets).
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppShell from '../../components/AppShell';
import AppHeader from '../../components/AppHeader';
import {
  C, SupportTicket, createSupportTicket, fetchMySupportTickets, fetchStoreSettings, fetchFaq, trackFaqView, sendFaqFeedback, FaqCategory } from '../../lib/bite';

function fmtDate(s?: string | null) {
  if (!s) return '';
  return new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function statusColor(s?: string) {
  const st = (s || 'open').toLowerCase();
  if (st === 'resolved' || st === 'closed') return C.green;
  if (st === 'in_progress' || st === 'in progress') return C.orange;
  return '#6b7280';
}

const voteBtn: React.CSSProperties = {
  background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16,
  padding: '5px 11px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', color: C.ink,
};

export default function SupportPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = (session?.user as any)?.id ? Number((session?.user as any).id) : undefined;

  const [rows, setRows] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  /* Help centre — now loaded from the API and managed in Admin → Help Centre.
     It used to be a hard-coded array in this file, so every wording tweak
     needed a developer + a deploy, and nobody could see which answers were
     failing customers. */
  const [faq, setFaq] = useState<FaqCategory[]>([]);
  const [faqQ, setFaqQ] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [voted, setVoted] = useState<Record<number, boolean>>({});
  const [phone, setPhone] = useState('');
  useEffect(() => { fetchFaq().then(setFaq); }, []);
  useEffect(() => {
    fetchStoreSettings().then((st) => setPhone(st?.invoiceConfig?.phone || '')).catch(() => {});
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { fetchFaq(faqQ).then(setFaq); }, 250);
    return () => clearTimeout(t);
  }, [faqQ]);

  function toggleArticle(id: number) {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next) trackFaqView(id);
  }
  function vote(id: number, helpful: boolean) {
    setVoted((v) => ({ ...v, [id]: helpful }));
    sendFaqFeedback(id, helpful);
  }
  const [sent, setSent] = useState(false);

  /* Previously this bounced signed-out visitors straight to /login, so nobody
     could read a single FAQ without an account — the person who can't order is
     exactly the person who needs help. Reading is public now; only raising a
     ticket needs sign-in (handled in submit()). */

  function load() {
    if (!userId) return;
    fetchMySupportTickets(userId)
      .then(setRows)
      .catch(() => setError('Could not load your tickets'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [userId]);

  async function submit() {
    /* Signed-out visitors can now READ the FAQ on this page, so the ticket
       button is reachable without an account. Silently returning would look
       broken — send them to log in and bring them right back. */
    if (!userId) {
      router.push('/login?callbackUrl=/account/support');
      return;
    }
    if (!subject.trim()) { setError('Please add a short subject'); return; }
    if (!message.trim()) { setError('Please describe your issue'); return; }
    setError(''); setSending(true);
    try {
      await createSupportTicket({ userId, subject: subject.trim(), message: message.trim() });
      setSubject(''); setMessage(''); setSent(true);
      setTimeout(() => setSent(false), 3000);
      load();
    } catch (e: any) {
      setError(e.message || 'Could not send your ticket. Please try again.');
    } finally {
      setSending(false);
    }
  }

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid rgba(13,59,46,.06)', borderRadius: 18, padding: 16, marginBottom: 14,
    boxShadow: '0 5px 16px rgba(13,59,46,.06)',
  };
  const input: React.CSSProperties = {
    width: '100%', border: `1px solid ${C.line}`, borderRadius: 10,
    padding: '11px 12px', fontSize: 13, outline: 'none', background: '#fff', marginBottom: 10,
  };

  return (
    <AppShell header={<AppHeader variant="page" title="Help & Support" />}>
      <div style={{ padding: 14 }}>
        {/* raise a ticket */}
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.ink, marginBottom: 4 }}>Raise a ticket</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12 }}>
            Tell us what went wrong and our team will get back to you.
          </div>
          <input
            style={input}
            placeholder="Subject (e.g. Order not delivered)"
            value={subject}
            maxLength={100}
            onChange={(e) => setSubject(e.target.value)}
          />
          <textarea
            style={{ ...input, minHeight: 100, resize: 'vertical' }}
            placeholder="Describe your issue in detail…"
            value={message}
            maxLength={1000}
            onChange={(e) => setMessage(e.target.value)}
          />
          {error && <div style={{ color: '#dc2626', fontSize: 12.5, marginBottom: 8 }}>{error}</div>}
          {sent && <div style={{ color: C.green, fontSize: 12.5, marginBottom: 8 }}>✅ Ticket raised! We&apos;ll be in touch.</div>}
          <button
            onClick={submit}
            disabled={sending}
            style={{
              width: '100%', background: sending ? C.line : C.green, color: '#fff',
              border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 800,
              cursor: sending ? 'default' : 'pointer',
            }}
          >
            {sending ? 'Sending…' : 'Submit ticket'}
          </button>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 10, textAlign: 'center' }}>
            Most issues are answered below — raise a ticket for anything they don&apos;t cover.
          </div>
        </div>

        {/* ── Help centre (admin-managed) ── */}
        <div style={{ fontWeight: 800, fontSize: 14, color: C.ink, margin: '4px 4px 10px' }}>
          Help centre
        </div>
        <input
          value={faqQ}
          onChange={(e) => setFaqQ(e.target.value)}
          placeholder="Search help — e.g. refund, OTP, coupon"
          style={{
            width: '100%', border: `1px solid ${C.line}`, borderRadius: 10,
            padding: '11px 12px', fontSize: 14, marginBottom: 12, outline: 'none',
          }}
        />

        {faq.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', color: C.muted, fontSize: 13 }}>
            {faqQ ? `No help articles match “${faqQ}”. Raise a ticket above and we'll help.` : 'Loading help…'}
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
                    onClick={() => toggleArticle(a.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      background: 'none', border: 'none', padding: '13px 12px',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 650, color: C.ink }}>{a.question}</span>
                    <span style={{
                      color: C.muted, fontSize: 13,
                      transform: openId === a.id ? 'rotate(90deg)' : 'none', transition: 'transform .2s',
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

                      {/* was this helpful — drives the admin's "worst answers" report */}
                      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {voted[a.id] === undefined ? (
                          <>
                            <span style={{ fontSize: 11.5, color: C.muted }}>Did this help?</span>
                            <button onClick={() => vote(a.id, true)} style={voteBtn}>👍 Yes</button>
                            <button onClick={() => vote(a.id, false)} style={voteBtn}>👎 No</button>
                          </>
                        ) : (
                          <span style={{ fontSize: 11.5, color: C.green, fontWeight: 700 }}>
                            {voted[a.id] ? 'Thanks for the feedback!' : 'Thanks — we\'ll improve this answer.'}
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

        {/* ── Still stuck? ── */}
        {phone && (
          <div style={{
            ...card, marginBottom: 14, background: C.greenSoft,
            border: `1px solid ${C.green}`, textAlign: 'center', padding: 16,
          }}>
            <div style={{ fontSize: 22 }}>📞</div>
            <div style={{ fontWeight: 800, fontSize: 14, color: C.ink, marginTop: 4 }}>Still stuck? Talk to us</div>
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

        {/* my tickets — only meaningful once signed in */}
        {userId && (
        <>
        <div style={{ fontWeight: 800, fontSize: 14, color: C.ink, margin: '4px 4px 10px' }}>My tickets</div>
        {loading ? (
          <div style={{ fontSize: 13, color: C.muted, padding: 8 }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', color: C.muted, fontSize: 13 }}>
            No tickets yet. Raise one above if you need help.
          </div>
        ) : (
          rows.map((t) => (
            <div key={t.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: C.ink }}>{t.subject || 'Support ticket'}</div>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: '#fff', background: statusColor(t.status),
                  padding: '2px 9px', borderRadius: 20, textTransform: 'capitalize',
                }}>{(t.status || 'open').replace('_', ' ')}</span>
              </div>
              {t.message && <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 6 }}>{t.message}</div>}
              <div style={{ fontSize: 11, color: '#9aa5a0' }}>{fmtDate(t.createdAt)}</div>
            </div>
          ))
        )}
        </>
        )}
      </div>
    </AppShell>
  );
}
