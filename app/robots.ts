import type { MetadataRoute } from 'next';

const SITE_URL = 'https://www.bitestheory.com';

/* Let Google crawl public pages; keep private/transactional ones out of the
   index (they have no SEO value and can leak into results). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/rider', '/account', '/checkout', '/cart', '/complete-profile', '/orders'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
