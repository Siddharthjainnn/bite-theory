import './globals.css';
import { ReactNode } from 'react';
import { CartProvider } from './providers/CartProvider';
import AuthProvider from './providers/AuthProvider';
import MenuProvider from './components/MenuProvider';

/* ── Local SEO ──────────────────────────────────────────────────────────
   IMPORTANT: change SITE_CITY and the address/areaServed below to your REAL
   delivery city. Your Instagram shows Sagar (M.P); if you actually deliver in
   Indore, set everything to Indore consistently — Google ranks you for what
   these fields say, and mismatches hurt you. Keep it truthful. */
const SITE_URL = 'https://www.bitestheory.com';
const SITE_CITY = 'Indore';
const SITE_STATE = 'Madhya Pradesh';
// Neighbourhoods you actually deliver to — used as areaServed for local reach.
const AREAS_SERVED = ['Vijay Nagar', 'Sukhliya', 'Rajwada', 'Palasia', 'Bhawarkuan', 'Dewas Naka'];

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  /* Bug #94 — the app could be pinch-zoomed, breaking the fixed nav and the
     phone-frame layout. maximumScale + userScalable lock it to a native-app
     feel. NOTE: iOS Safari deliberately IGNORES this (an accessibility
     decision by Apple — users must always be able to zoom). What actually
     stopped the iOS auto-zoom is the 16px input rule in GlobalStyle; this
     covers Android/desktop. */
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0D3B2E',
};

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Bites Theory — Healthy Meals & Protein Thali Delivery in Indore',
    template: '%s | Bites Theory',
  },
  description:
    `Healthy thalis and high-protein meals delivered fresh in ${SITE_CITY}, under ₹99. ` +
    `Serving ${AREAS_SERVED.slice(0, 4).join(', ')} and nearby areas. Balanced nutrition, fresh ingredients, on time.`,
  keywords: [
    `healthy food delivery ${SITE_CITY}`,
    `protein meals ${SITE_CITY}`,
    `thali delivery ${SITE_CITY}`,
    ...AREAS_SERVED.map((a) => `food delivery ${a} ${SITE_CITY}`),
    'diet food near me', 'healthy meals under 99',
  ],
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Bites Theory',
    title: 'Bites Theory — Healthy Meals & Protein Thali Delivery in Indore',
    description: `Healthy thalis and protein meals delivered fresh in ${SITE_CITY}, under ₹99.`,
    images: [{ url: '/logo.jpeg', width: 512, height: 512, alt: 'Bites Theory' }],
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bites Theory — Healthy Meals in Indore',
    description: `Healthy thalis and protein meals delivered fresh in ${SITE_CITY}, under ₹99.`,
    images: ['/logo.jpeg'],
  },
  robots: { index: true, follow: true },
};

/* LocalBusiness structured data — this is what tells Google you're a real
   food business in Indore serving these neighbourhoods. Powers the rich
   result (logo, rating, area) and helps local ranking. */
const localBusinessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  '@id': `${SITE_URL}/#restaurant`,
  name: 'Bites Theory',
  image: `${SITE_URL}/logo.jpeg`,
  url: SITE_URL,
  servesCuisine: ['Healthy', 'North Indian', 'South Indian', 'Thali'],
  priceRange: '₹',
  address: {
    '@type': 'PostalAddress',
    addressLocality: SITE_CITY,
    addressRegion: SITE_STATE,
    addressCountry: 'IN',
  },
  areaServed: AREAS_SERVED.map((a) => ({ '@type': 'City', name: `${a}, ${SITE_CITY}` })),
  aggregateRating: { '@type': 'AggregateRating', ratingValue: '5.0', reviewCount: '20' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
        />
      </head>
      <body style={{ margin: 0 }}>
        <AuthProvider>
          <CartProvider>
            <MenuProvider>{children}</MenuProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
