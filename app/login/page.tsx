'use client';

// session is per-user, so never statically pre-render this page
export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { C } from '../lib/bite';
import GlobalStyle from '../components/GlobalStyle';

function LoginInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') || '/';

  // already logged in → leave the login page
  useEffect(() => {
    if (status === 'authenticated') {
      const complete = (session?.user as any)?.profileComplete;
      router.replace(complete ? callbackUrl : '/complete-profile');
    }
  }, [status, session, router, callbackUrl]);

  return (
    <>
      <GlobalStyle />
      <div className="bt-stage">
        <main
          className="bt-app"
          style={{
            background: `linear-gradient(165deg,${C.dark} 0%,${C.darkSoft} 60%,#1a6349 100%)`,
            justifyContent: 'space-between',
          }}
        >
          {/* top: brand + floating food */}
          <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
            <div className="login-amb" aria-hidden>
              {['🍛', '🥗', '🫓', '🧃', '🍮', '🍕'].map((e, i) => (
                <span key={i} className={`lamb la${i}`}>
                  {e}
                </span>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '24px 22px 0',
                color: '#fff',
                fontWeight: 800,
                fontSize: 18,
                position: 'relative',
              }}
            >
              <span className="brandmark" style={{ width: 40, height: 40, fontSize: 22 }}>
                B
              </span>
              Bite Theory
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: 'calc(100% - 70px)',
                padding: '0 28px',
                textAlign: 'center',
                position: 'relative',
              }}
            >
              <div style={{ fontSize: 84, marginBottom: 8 }}>🧑‍🍳</div>
              <h1
                style={{
                  color: '#fff',
                  fontSize: 30,
                  fontWeight: 800,
                  lineHeight: 1.15,
                  margin: '6px 0 10px',
                }}
              >
                Smart Food.
                <br />
                Better Living.
              </h1>
              <p style={{ color: '#cfeede', fontSize: 14, margin: 0, maxWidth: 300 }}>
                100% pure veg, delivered hot in Indore. Login to order your
                favourites & earn rewards.
              </p>
            </div>
          </div>

          {/* bottom: auth card */}
          <div
            style={{
              background: '#fff',
              borderRadius: '26px 26px 0 0',
              padding: '24px 22px 30px',
              boxShadow: '0 -10px 40px rgba(0,0,0,.25)',
            }}
          >
            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: C.ink,
                marginBottom: 4,
              }}
            >
              Welcome! 👋
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>
              Login or sign up in one tap to continue
            </div>

            <button
              onClick={() => signIn('google', { callbackUrl })}
              disabled={status === 'loading'}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                background: '#fff',
                color: '#1f1f1f',
                border: `1.5px solid ${C.line}`,
                borderRadius: 14,
                padding: '14px',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,.06)',
              }}
            >
              <GoogleG />
              {status === 'loading' ? 'Please wait…' : 'Continue with Google'}
            </button>

            <p
              style={{
                fontSize: 11,
                color: C.muted,
                textAlign: 'center',
                marginTop: 16,
                lineHeight: 1.5,
              }}
            >
              By continuing you agree to Bite Theory&apos;s
              <br />
              Terms of Service & Privacy Policy.
            </p>
          </div>
        </main>
      </div>

      <style>{`
.login-amb{position:absolute;inset:0;pointer-events:none}
.lamb{position:absolute;opacity:.13;font-size:30px}
.la0{top:8%;left:12%;animation:lf1 5s ease-in-out infinite}
.la1{top:16%;right:14%;animation:lf2 6s ease-in-out infinite}
.la2{top:46%;left:8%;animation:lf1 7s ease-in-out infinite}
.la3{top:40%;right:9%;animation:lf2 6.5s ease-in-out infinite}
.la4{top:64%;left:16%;animation:lf1 5.5s ease-in-out infinite}
.la5{top:70%;right:18%;animation:lf2 6.2s ease-in-out infinite}
@keyframes lf1{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
@keyframes lf2{0%,100%{transform:translateY(0)}50%{transform:translateY(12px)}}
      `}</style>
    </>
  );
}

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 5.1 29.5 3 24 3 16 3 9.1 7.6 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 45c5.2 0 9.9-2 13.5-5.2l-6.2-5.3C29.2 35.7 26.7 36.5 24 36.5c-5.3 0-9.7-3.6-11.3-8.5l-6.5 5C9.2 40.3 16 45 24 45z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.2 5.3C39.9 39.6 44 33 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
