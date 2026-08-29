'use client';

/**
 * AddressAutocomplete — Google Places lookup + a full-address box.
 *
 * TWO FIELDS ON PURPOSE
 * The search input is bound to Places; the textarea below holds the address
 * that actually gets submitted. Google can find "BRK Business Park" but it has
 * never heard of "3rd floor, desk by the window", and in India that second half
 * is what decides whether the tiffin arrives. So: search to place the building,
 * then finish the line by hand.
 *
 * (An earlier version bound Places straight to the textarea. google.maps.places
 * .Autocomplete only attaches to an <input>; on a <textarea> it binds without
 * error and simply never fires, which is why nothing appeared to happen.)
 *
 * GRACEFUL FALLBACK
 * With no NEXT_PUBLIC_GOOGLE_MAPS_KEY — or if the script fails, or the quota is
 * spent — the search box is hidden and the textarea alone remains, exactly as
 * the form behaved before. A third-party script must never be able to take down
 * the page the ad spend lands on.
 */

import { useEffect, useRef, useState } from 'react';
import { C } from '../lib/bite';

/* Minimal shapes for the bits of the Places API we touch — enough to stay
   typed without pulling in @types/google.maps for one widget. */
type GPlace = {
  formatted_address?: string;
  name?: string;
  place_id?: string;
  geometry?: { location?: { lat: () => number; lng: () => number } };
};
type GAutocomplete = {
  getPlace(): GPlace | undefined;
  addListener(ev: string, cb: () => void): { remove?: () => void } | undefined;
};
type GMaps = {
  places?: {
    Autocomplete?: new (el: HTMLInputElement, opts: Record<string, unknown>) => GAutocomplete;
  };
  LatLng: new (lat: number, lng: number) => unknown;
  LatLngBounds: new (sw: unknown, ne: unknown) => unknown;
};
const gmaps = (): GMaps | undefined =>
  (window as unknown as { google?: { maps?: GMaps } }).google?.maps;

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';
/* Bias suggestions to Indore — without this you get Vijay Nagar in Delhi. */
const INDORE = { lat: 22.7196, lng: 75.8577 };

type PlacePick = { address: string; lat?: number; lng?: number; placeId?: string };

let scriptPromise: Promise<void> | null = null;

/** Load the Places script once per page, shared across every instance. */
function loadPlaces(): Promise<void> {
  if (!KEY) return Promise.reject(new Error('no-key'));
  if (typeof window === 'undefined') return Promise.reject(new Error('ssr'));
  if (gmaps()?.places) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=places&loading=async`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('script-failed'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string, place?: PlacePick) => void;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [ready, setReady] = useState(false);
  const [picked, setPicked] = useState('');

  // Keep the latest onChange without re-running the attach effect on every
  // parent render, which would rebuild the widget mid-typing.
  const cb = useRef(onChange);
  useEffect(() => { cb.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!KEY) return;
    let dead = false;
    loadPlaces()
      .then(() => { if (!dead) setReady(true); })
      .catch(() => { /* stay on the textarea-only fallback */ });
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    if (!ready || !inputRef.current) return;
    const g = gmaps();
    const Ctor = g?.places?.Autocomplete;
    if (!g || !Ctor) return;

    const ac = new Ctor(inputRef.current, {
      componentRestrictions: { country: 'in' },
      fields: ['formatted_address', 'geometry', 'place_id', 'name'],
      bounds: new g.LatLngBounds(
        new g.LatLng(INDORE.lat - 0.25, INDORE.lng - 0.25),
        new g.LatLng(INDORE.lat + 0.25, INDORE.lng + 0.25),
      ),
    });

    const listener = ac.addListener('place_changed', () => {
      const p = ac.getPlace();
      if (!p) return;
      /* Prefer name + formatted_address: Places drops the building name from
         formatted_address for many Indian POIs, and that name is often the
         only part a rider can actually navigate by. */
      const formatted = p.formatted_address || '';
      const nm = p.name && !formatted.startsWith(p.name) ? `${p.name}, ` : '';
      const full = `${nm}${formatted}`.trim();
      setPicked(full);
      cb.current(full, {
        address: full,
        lat: p.geometry?.location?.lat?.(),
        lng: p.geometry?.location?.lng?.(),
        placeId: p.place_id,
      });
      /* Move focus to the detail box — the customer still has to add a flat
         or floor, and landing them there makes that the obvious next step. */
      requestAnimationFrame(() => {
        const ta = inputRef.current?.parentElement?.querySelector('textarea');
        (ta as HTMLTextAreaElement | null)?.focus();
      });
    });

    return () => { listener?.remove?.(); };
  }, [ready]);

  const box: React.CSSProperties = {
    width: '100%', padding: '11px 13px', borderRadius: 12,
    border: `1px solid ${C.line}`, fontSize: 14, color: C.ink,
    background: '#fff', outline: 'none', fontFamily: 'inherit',
  };

  return (
    <div>
      {ready && (
        <>
          <input
            ref={inputRef}
            type="text"
            placeholder="🔍 Search your building, office or area"
            /* Places writes the chosen value into this input itself; it is a
               finder, not part of the submitted data. */
            style={{ ...box, marginBottom: 8 }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          />
          {picked && (
            <p style={{ fontSize: 11, color: C.greenDeep, margin: '-4px 0 7px', fontWeight: 700 }}>
              ✓ Location pinned — now add your flat / floor below
            </p>
          )}
        </>
      )}

      <textarea
        value={value}
        onChange={(e) => cb.current(e.target.value)}
        placeholder={placeholder || 'Flat / office no., building, street, area, pincode'}
        style={{ ...box, minHeight: 66, resize: 'vertical' }}
      />
    </div>
  );
}
