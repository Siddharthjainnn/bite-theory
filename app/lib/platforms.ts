/**
 * Third-party ordering platforms shown on the storefront.
 *
 * Direct orders are worth the most (no marketplace commission), so the home
 * page always leads with the direct menu. These tiles exist because a customer
 * who already has Toing or Swiggy installed will otherwise order from a
 * competitor rather than install anything new — better to capture that order
 * on a platform than lose it entirely.
 *
 * ⚠️ VERIFY THE SWIGGY LINK. It and the Toing link carry the SAME menu id
 * (1429311) on the same /menu/<id> path. That is unlikely to be a coincidence,
 * and one of the two is probably wrong. Open both before advertising them —
 * a dead link on the home page is worse than no tile at all.
 */

export type Platform = {
  key: string;
  name: string;
  url: string;
  /** Shown as the tile's headline benefit. Null when there's no live offer. */
  offer: string | null;
  blurb: string;
  art: string;
  /** Official logo in /public (e.g. '/logos/toing.png'). Falls back to a
      brand-coloured wordmark when absent — see the note at the bottom. */
  logo?: string;
  /** Tile gradient, brand-matched. */
  gradient: string;
  shadow: string;
  enabled: boolean;
};

export const FREE_DELIVERY_ABOVE = 129;

export const PLATFORMS: Platform[] = [
  {
    key: 'toing',
    name: 'Toing',
    url: 'https://www.toingit.com/menu/1429311?source=sharing',
    offer: `FREE delivery above ₹${FREE_DELIVERY_ABOVE}`,
    blurb: 'Everyday lowest prices',
    art: '🛵',
    logo: '/logos/toing.png',
    gradient: 'linear-gradient(150deg,#F5317F 0%,#c9166a 55%,#0D3B2E 100%)',
    shadow: '0 8px 22px rgba(245,49,127,.34)',
    enabled: true,
  },
  {
    key: 'swiggy',
    name: 'Swiggy',
    url: 'https://www.swiggy.com/menu/1429311?source=sharing',
    offer: null,
    blurb: 'Same kitchen, same menu',
    art: '🍽️',
    logo: '/logos/swiggy.png',
    gradient: 'linear-gradient(150deg,#FC8019 0%,#e06a05 55%,#0D3B2E 100%)',
    shadow: '0 8px 22px rgba(252,128,25,.32)',
    /* Flip to false to hide the tile without deleting the config. */
    enabled: true,
  },
];

export const LIVE_PLATFORMS = PLATFORMS.filter((p) => p.enabled);

/* LOGOS — drop the real files in and they appear automatically.
   Save as public/logos/toing.png and public/logos/swiggy.png (white or
   light logo on transparent; these sit on dark brand gradients). Until the
   files exist the tile renders a styled wordmark instead, so a missing image
   never leaves a blank tile.

   Get the official files from the partner portals rather than a web image
   search — marketplaces publish brand kits for restaurants precisely for
   this, and using an off-spec or stretched logo tends to breach the brand
   terms in your partner agreement. */
