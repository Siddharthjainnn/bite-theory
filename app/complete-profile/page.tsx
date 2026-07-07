'use client';

// session is per-user, so never statically pre-render this page
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { C } from '../lib/bite';
import GlobalStyle from '../components/GlobalStyle';

function CompleteProfileInner() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('callbackUrl') || '/';
  const [mobile, setMobile] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const user = session?.user as any;

  // not logged in → go to login; already complete → continue on
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (status === 'authenticated' && user?.profileComplete) router.replace(next);
  }, [status, user, router, next]);

  async function save() {
    setError('');
    const digits = mobile.replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: digits }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Could not save');
      }
      await update(); // refresh session so profileComplete becomes true
      router.replace(next);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
      setSaving(false);
    }
  }

  return (
    <>
      <GlobalStyle />
      <div className="bt-stage">
        <main className="bt-app" style={{ background: C.bg }}>
          <header className="bt-head">
            <div className="bt-head-row">
              <div className="bt-brand">
                <span className="brandmark">B</span>
                <div>
                  <div className="bt-brand-name">Bite Theory</div>
                  <div className="bt-loc">📍 Indore</div>
                </div>
              </div>
            </div>
          </header>

          <div className="bt-scroll">
            <div style={{ padding: '28px 22px' }}>
              <div style={{ fontSize: 46, marginBottom: 6 }}>📱</div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: C.ink }}>
                One last step{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
              </h1>
              <p style={{ fontSize: 13.5, color: C.muted, margin: '0 0 22px', lineHeight: 1.5 }}>
                Add your mobile number so we (and Theory Bhaiya 🧪) can reach you
                about your orders & delivery.
              </p>

              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.ink,
                  display: 'block',
                  marginBottom: 7,
                }}
              >
                Mobile number
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#fff',
                  border: `1.5px solid ${error ? '#e57373' : C.line}`,
                  borderRadius: 13,
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    padding: '13px 12px',
                    background: C.greenSoft,
                    color: C.greenDeep,
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="98765 43210"
                  value={mobile}
                  onChange={(e) =>
                    setMobile(e.target.value.replace(/[^\d]/g, '').slice(0, 10))
                  }
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    padding: '13px 12px',
                    fontSize: 15,
                    color: C.ink,
                  }}
                />
              </div>
              {error && (
                <div style={{ color: '#c0392b', fontSize: 12, marginTop: 7 }}>
                  {error}
                </div>
              )}

              <button
                onClick={save}
                disabled={saving}
                style={{
                  width: '100%',
                  marginTop: 22,
                  background: `linear-gradient(135deg,${C.green},${C.greenDeep})`,
                  color: '#fff',
                  border: 'none',
                  fontSize: 15,
                  fontWeight: 800,
                  padding: 14,
                  borderRadius: 13,
                  cursor: 'pointer',
                  boxShadow: '0 6px 16px rgba(76,175,80,.35)',
                }}
              >
                {saving ? 'Saving…' : 'Continue →'}
              </button>

              <p style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: C.muted }}>
                We need your number to confirm and deliver your orders.
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={null}>
      <CompleteProfileInner />
    </Suspense>
  );
}
