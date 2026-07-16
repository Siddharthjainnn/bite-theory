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
  C, SupportTicket, createSupportTicket, fetchMySupportTickets, fetchStoreSettings } from '../../lib/bite';

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

/** Self-help content. Ordered by how often a customer actually hits each one. */
const FAQS: { icon: string; q: string; a: string }[] = [
  {
    icon: '📍',
    q: 'Where is my order?',
    a: 'Open Orders and tap your live order — you will see the current status, a live map once the rider picks it up, and an ETA. If it has been stuck on one status for more than 20 minutes, call us.',
  },
  {
    icon: '🔢',
    q: 'The rider is asking for an OTP — where is it?',
    a: 'It is on your order tracking screen: open Orders → tap the live order. Share the 4-digit code with the rider only when you have received your food.',
  },
  {
    icon: '💸',
    q: 'I paid but the order did not go through',
    a: 'If money left your account and no order appeared, it is almost always auto-reversed by your bank in 5–7 working days. Check Orders first — if the order IS there, you are fine. If not, raise a ticket with the amount and time and we will trace it.',
  },
  {
    icon: '↩️',
    q: 'When will my refund arrive?',
    a: 'Cancelled or refunded orders are sent back to your original payment method the same day. Banks usually take 5–7 working days to show it. Wallet refunds are instant.',
  },
  {
    icon: '🎟️',
    q: 'My coupon is not applying',
    a: 'Check three things: the order meets the minimum value, the coupon has not expired, and you have not already used it. The cart shows the exact reason under the coupon box when it is rejected.',
  },
  {
    icon: '🍱',
    q: 'Something was missing or wrong in my order',
    a: 'Raise a ticket below with your order number and what was wrong — a photo helps. We review these fast and refund where it is our mistake.',
  },
  {
    icon: '🚪',
    q: 'The kitchen is closed / I cannot place an order',
    a: 'We cook to order, so ordering is only open during kitchen hours — the home screen shows the next opening time. You may also be outside our delivery radius; the app tells you at checkout.',
  },
  {
    icon: '💳',
    q: 'How do I use my wallet balance?',
    a: 'At checkout, turn on "Use wallet balance". It applies automatically to that order. Wallet money comes from refunds, referrals and rewards.',
  },
];

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
  /* Support contact + FAQ. The page previously said "Call / WhatsApp us — see
     the Help section", but no Help section existed and no number was shown, so
     a stuck customer had no way through. Number comes from Store Settings so
     the kitchen can change it without a deploy. */
  const [phone, setPhone] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  useEffect(() => {
    fetchStoreSettings()
      .then((st) => setPhone(st?.invoiceConfig?.phone || ''))
      .catch(() => setPhone(''));
  }, []);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login?callbackUrl=/account/support');
  }, [status, router]);

  function load() {
    if (!userId) return;
    fetchMySupportTickets(userId)
      .then(setRows)
      .catch(() => setError('Could not load your tickets'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [userId]);

  async function submit() {
    if (!userId) return;
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
            Most issues are answered below — a ticket is for anything they don&apos;t cover.
          </div>
        </div>

        {/* ── Self-help: solve it now, before raising a ticket ── */}
        <div style={{ fontWeight: 800, fontSize: 14, color: C.ink, margin: '4px 4px 10px' }}>
          Common questions
        </div>
        <div style={{ ...card, padding: 4, marginBottom: 14 }}>
          {FAQS.map((f, i) => (
            <div key={i} style={{ borderBottom: i < FAQS.length - 1 ? `1px solid ${C.line}` : 'none' }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  background: 'none', border: 'none', padding: '13px 12px',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 15 }}>{f.icon}</span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: C.ink }}>{f.q}</span>
                <span style={{ color: C.muted, fontSize: 12, transform: openFaq === i ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 12px 14px 40px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
                  {f.a}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Still stuck? Call / WhatsApp ── */}
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
              <a
                href={`tel:${phone.replace(/\s/g, '')}`}
                style={{
                  flex: 1, maxWidth: 160, textDecoration: 'none', background: C.green,
                  color: '#fff', borderRadius: 10, padding: '11px 14px',
                  fontWeight: 800, fontSize: 13.5,
                }}
              >
                Call us
              </a>
              <a
                href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1, maxWidth: 160, textDecoration: 'none', background: '#25D366',
                  color: '#fff', borderRadius: 10, padding: '11px 14px',
                  fontWeight: 800, fontSize: 13.5,
                }}
              >
                WhatsApp
              </a>
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 10 }}>{phone}</div>
          </div>
        )}

        {/* my tickets */}
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
      </div>
    </AppShell>
  );
}
