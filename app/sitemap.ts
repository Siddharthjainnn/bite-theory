import type { MetadataRoute } from 'next';

const SITE_URL = 'https://www.bitestheory.com';

/* Public, indexable pages only. Private routes (admin, rider, account,
   checkout, orders) are intentionally excluded — they're in robots disallow.
   NOTE: product/menu detail pages are dynamic; if you want each dish indexed,
   fetch the product IDs here and map them into entries. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = ['', '/menu', '/coupons', '/info', '/login'];
  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === '' || path === '/menu' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : path === '/menu' ? 0.9 : 0.6,
  }));
}
