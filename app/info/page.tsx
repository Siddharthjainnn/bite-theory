'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '../components/AppShell';
import AppHeader from '../components/AppHeader';
import { C } from '../lib/bite';

const TABS: Record<string, { title: string; body: React.ReactNode }> = {
  about: {
    title: 'About Bite Theory',
    body: (
      <>
        <p>Bite Theory is a 100% pure-veg cloud kitchen in Indore serving smart, nutrition-first meals — thalis, high-protein bowls, healthy snacks and more — at honest prices.</p>
        <p>Our mission: <b>Smart Food. Better Living.</b> Every dish lists its calories and macros so you always know what you’re eating.</p>
      </>
    ),
  },
  help: {
    title: 'Help & Support',
    body: (
      <>
        <p>Need a hand with an order? We’re here.</p>
        <p>📞 <b>Call / WhatsApp:</b> +91 90000 00000</p>
        <p>✉️ <b>Email:</b> support@bitestheory.com</p>
        <p>⏰ <b>Hours:</b> 10:00 AM – 11:00 PM, all days.</p>
        <p>For issues with a specific order, open <b>Order History</b> and tap the order to see its live status.</p>
      </>
    ),
  },
  terms: {
    title: 'Terms & Privacy',
    body: (
      <>
        <p><b>Terms of Service.</b> By using Bite Theory you agree to order for lawful personal use. Prices, offers and coupons may change without notice. Orders can’t be cancelled once the kitchen starts preparing them.</p>
        <p><b>Privacy.</b> We collect your name, email and mobile number only to process and deliver your orders and to send order updates. We never sell your data. You can request deletion of your account by contacting support.</p>
      </>
    ),
  },
};

function InfoInner() {
  const params = useSearchParams();
  const tab = (params.get('tab') || 'about').toLowerCase();
  const content = TABS[tab] || TABS.about;

  return (
    <AppShell header={<AppHeader variant="page" title={content.title} />}>
      <div style={{ padding: '18px 18px 30px', color: C.ink, fontSize: 14, lineHeight: 1.65 }}>
        <div className="info-body">{content.body}</div>
      </div>
      <style>{`.info-body p{margin:0 0 14px}`}</style>
    </AppShell>
  );
}

export default function InfoPage() {
  return (
    <Suspense fallback={null}>
      <InfoInner />
    </Suspense>
  );
}
