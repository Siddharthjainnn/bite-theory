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
  C, SupportTicket, createSupportTicket, fetchMySupportTickets,
} from '../../lib/bite';

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
    background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginBottom: 14,
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
            Prefer to talk? Call / WhatsApp us any time — see the Help section.
          </div>
        </div>

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
