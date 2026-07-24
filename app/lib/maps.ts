'use client';

/**
 * Google Maps JS API loader — injects the script once, resolves `google.maps`.
 * Needs NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env. If missing, callers should
 * render their no-map fallback (everything still works without maps).
 */
export const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

let loader: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (!MAPS_KEY) return Promise.reject(new Error('NO_KEY'));
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=marker,places,geometry&loading=async`;
    s.async = true;
    s.onload = () => resolve((window as any).google);
    s.onerror = () => { loader = null; reject(new Error('LOAD_FAILED')); };
    document.head.appendChild(s);
  });
  return loader;
}

/** Browser geolocation as a promise.
 *  Bug #38 — "map shows a different address every time": the browser was free
 *  to hand back a CACHED or coarse (wifi/IP) fix, which jumps around by
 *  hundreds of metres between opens. Two changes:
 *   1) maximumAge: 0 — never accept a stale cached position.
 *   2) watchPosition sampling — GPS warms up over a few seconds; we keep the
 *      most accurate fix seen and stop early once it's within ~30 m.        */
export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation unsupported'));

    let best: GeolocationPosition | null = null;
    let settled = false;
    const finish = (err?: any) => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      if (best) {
        resolve({ lat: best.coords.latitude, lng: best.coords.longitude });
      } else {
        reject(err || new Error('Could not get an accurate location'));
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
        // good enough — a ~30 m fix pins the right building
        if (pos.coords.accuracy <= 30) finish();
      },
      (err) => finish(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
    // hard stop after 8s: return the best fix collected so far
    const timer = setTimeout(() => finish(new Error('Location timed out')), 8000);
  });
}

/** Reverse-geocode lat/lng → human address (needs maps loaded). */
export async function reverseGeocode(lat: number, lng: number): Promise<{
  address: string; pincode?: string; city?: string; state?: string;
}> {
  const g = await loadGoogleMaps();
  const geocoder = new g.maps.Geocoder();
  const { results } = await geocoder.geocode({ location: { lat, lng } });
  const best = results?.[0];
  if (!best) return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  const get = (type: string) =>
    best.address_components.find((c: any) => c.types.includes(type))?.long_name;
  return {
    address: best.formatted_address,
    pincode: get('postal_code'),
    city: get('locality') || get('administrative_area_level_2'),
    state: get('administrative_area_level_1'),
  };
}
