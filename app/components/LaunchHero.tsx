'use client';

/**
 * LaunchHero — "Our first outlet is opening in Bhawarkua". Every word, the
 * opening time and the on/off switch come from Admin → Home page.
 *
 * Before opening: live countdown + "Notify me on opening day". A signed-in
 * customer with a mobile on their profile is added in one tap; anyone else
 * types their number. From the opening time on it turns into "Now open".
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { subscribeLaunch } from '../lib/bite';
import { openingDay, timeLeft, useStorefront } from '../lib/storefront';

type Step = 'idle' | 'phone' | 'saving' | 'done';

export default function LaunchHero({ desktop = false }: { desktop?: boolean }) {
  const { storefront, loaded } = useStorefront();
  const l = storefront.launch;
  const { status: auth } = useSession();
  const [now, setNow] = useState<number | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [doneText, setDoneText] = useState('');

  /* tick once a second while counting down; `now` starts null so the server
     render and the first client render match */
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  /* remember on this device that they already signed up */
  useEffect(() => {
    try {
      if (localStorage.getItem(`bt_launch_${l.opensAt}`)) {
        Promise.resolve().then(() => setStep('done'));
      }
    } catch {}
  }, [l.opensAt]);

  if (!loaded || !l.enabled || !l.area) return null;
  const left = now === null ? null : timeLeft(l.opensAt, now);
  const isOpen = now !== null && left === null;
  const day = openingDay(l.opensAt);

  async function join(withPhone?: string) {
    setErr('');
    setStep('saving');
    try {
      const r = await subscribeLaunch(withPhone);
      setDoneText(r.already ? "You're already on the list. See you there!" : "You're on the list. See you there!");
      setStep('done');
      try {
        localStorage.setItem(`bt_launch_${l.opensAt}`, '1');
      } catch {}
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      /* signed in but no mobile on the profile → ask for it */
      if (!withPhone) {
        setStep('phone');
        return;
      }
      setErr(msg || 'Could not save that. Please try again.');
      setStep('phone');
    }
  }

  const onNotify = () => (auth === 'authenticated' ? join() : setStep('phone'));

  const pin = (
    <>
      <svg className="sf-hero-map" viewBox="0 0 358 380" preserveAspectRatio="xMaxYMid slice" fill="none" aria-hidden="true">
        <path d="M-10 92 C 80 80, 160 120, 370 70" stroke="rgba(255,255,255,0.07)" strokeWidth="14" strokeLinecap="round" />
        <path d="M250 -10 C 262 90, 240 200, 300 390" stroke="rgba(255,255,255,0.07)" strokeWidth="12" strokeLinecap="round" />
        <path d="M-10 210 L 370 150" stroke="rgba(255,255,255,0.05)" strokeWidth="6" strokeLinecap="round" />
        <path d="M150 -10 L 210 390" stroke="rgba(255,255,255,0.045)" strokeWidth="5" strokeLinecap="round" />
        <path d="M-10 330 C 120 300, 220 340, 370 290" stroke="rgba(255,255,255,0.05)" strokeWidth="8" strokeLinecap="round" />
        <path d="M60 -10 L 30 390" stroke="rgba(255,255,255,0.035)" strokeWidth="4" strokeLinecap="round" />
        <circle cx="300" cy="88" r="46" fill="rgba(245,158,11,0.10)" />
        <circle cx="300" cy="88" r="26" fill="rgba(245,158,11,0.16)" />
      </svg>
      <span className="sf-hero-ring" aria-hidden="true" />
      <svg className="sf-hero-pin" viewBox="0 0 34 44" aria-hidden="true">
        <path d="M17 1C8.2 1 1 8 1 16.6 1 28.4 17 43 17 43s16-14.6 16-26.4C33 8 25.8 1 17 1z" fill="#F59E0B" />
        <circle cx="17" cy="16.5" r="6.5" fill="#0D3B2E" />
      </svg>
    </>
  );

  const heading = (
    <div>
      <div className="sf-lead">{isOpen ? l.openLead : l.lead}</div>
      <h2 className="sf-area">
        {l.area}
        {desktop && l.city ? `, ${l.city}` : ''}
      </h2>
      <div className="sf-when">
        {isOpen
          ? desktop ? 'Come and say hello' : `${l.city} · Come and say hello`
          : [desktop ? '' : l.city, day ? `Opening ${day}` : ''].filter(Boolean).join(' · ')}
      </div>
    </div>
  );

  const countdown =
    !isOpen && l.showCountdown && left ? (
      <div className="sf-count" role="timer" aria-label={`Opens in ${Number(left.days)} days ${Number(left.hrs)} hours`}>
        <div><b>{left.days}</b><span>DAYS</span></div>
        <div><b>{left.hrs}</b><span>HRS</span></div>
        <div><b>{left.min}</b><span>MIN</span></div>
        <div><b>{left.sec}</b><span>SEC</span></div>
      </div>
    ) : null;

  const bell = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );

  const action = isOpen ? (
    l.mapsUrl ? (
      <a className="sf-cta" href={l.mapsUrl} target="_blank" rel="noopener noreferrer">
        Get directions
      </a>
    ) : null
  ) : step === 'done' ? (
    <div className="sf-done" role="status">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FBD38D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12l5 5 9-10" />
      </svg>
      {doneText || "You're on the list. See you there!"}
    </div>
  ) : step === 'phone' || (step === 'saving' && phone) ? (
    <form
      className="sf-phone"
      onSubmit={(e) => {
        e.preventDefault();
        join(phone);
      }}
    >
      <label>
        <span aria-hidden="true">+91</span>
        <span className="sf-sr">Your mobile number</span>
        <input
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={14}
          placeholder="Mobile number"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ''))}
          autoFocus
        />
      </label>
      <button className="sf-cta" type="submit" disabled={step === 'saving' || phone.replace(/\D/g, '').length < 10}>
        {step === 'saving' ? 'Saving…' : 'Notify me'}
      </button>
    </form>
  ) : (
    <button className="sf-cta" type="button" onClick={onNotify} disabled={step === 'saving'}>
      {bell}
      {step === 'saving' ? 'Saving…' : l.buttonText || 'Notify me on opening day'}
    </button>
  );

  const small = !isOpen && l.smallPrint ? <div className="sf-small">{l.smallPrint}</div> : null;
  const error = err ? <div className="sf-err" role="alert">{err}</div> : null;

  return (
    <section className="sf-hero-wrap" aria-label={`${l.badge}: ${l.area}`}>
      <div className="sf-hero">
        {pin}
        {desktop ? (
          <div className="sf-hero-in">
            <div className="sf-hero-left">
              <span className="sf-badge"><i />{isOpen ? l.openBadge : l.badge}</span>
              {heading}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                {action}
                {error}
                {small}
              </div>
            </div>
            {countdown && (
              <div className="sf-hero-right">
                <span className="sf-lead" style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '.08em' }}>OPENS IN</span>
                {countdown}
              </div>
            )}
          </div>
        ) : (
          <div className="sf-hero-in">
            <span className="sf-badge"><i />{isOpen ? l.openBadge : l.badge}</span>
            {heading}
            {countdown}
            {(action || small) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {action}
                {error}
                {small}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
