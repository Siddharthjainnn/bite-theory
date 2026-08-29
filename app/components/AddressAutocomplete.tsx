'use client';

/**
 * AddressAutocomplete — Google Places address box with a graceful fallback.
 *
 * WHY THE FALLBACK MATTERS
 * If NEXT_PUBLIC_GOOGLE_MAPS_KEY isn't set (or the script fails to load, or
 * the daily quota is spent), this renders as an ordinary textarea and the form
 * still submits. An address field that dies with the third-party script would
 * take the whole enrolment funnel down with it, and this form is where the ad
 * money lands.
 *
 * The typed text is always the source of truth. Picking a suggestion fills in
 * the formatted address and captures lat/lng for the rider, but the customer
 * can still edit freely afterwards — Indian addresses routinely need a flat
 * number or a gate instruction that Places has never heard of.
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
    Autocomplete?: new (el: HTMLElement, opts: Record<string, unknown>) => GAutocomplete;
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
  const boxRef = useRef<HTMLTextAreaElement | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(!KEY);
  // Keep the latest onChange without re-running the attach effect on
  // every parent render, which would rebuild the widget mid-typing.
  const cb = useRef(onChange);
  useEffect(() => { cb.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!KEY) return;
    let dead = false;
    loadPlaces()
      .then(() => { if (!dead) setReady(true); })
      .catch(() => { if (!dead) setFailed(true); });
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    if (!ready || !boxRef.current) return;
    const g = gmaps();
    const Ctor = g?.places?.Autocomplete;
    /* No setState here: the plain textarea is already what's rendered, so
       bailing out silently leaves the working fallback in place. */
    if (!g || !Ctor) return;

    const ac = new Ctor(boxRef.current, {
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
         formatted_address for a lot of Indian POIs, and that name is often the
         only part a rider can actually navigate by. */
      const formatted = p.formatted_address || '';
      const nm = p.name && !formatted.startsWith(p.name) ? `${p.name}, ` : '';
      cb.current(`${nm}${formatted}`, {
        address: `${nm}${formatted}`,
        lat: p.geometry?.location?.lat?.(),
        lng: p.geometry?.location?.lng?.(),
        placeId: p.place_id,
      });
    });

    return () => { listener?.remove?.(); };
  }, [ready]);

  return (
    <>
      <textarea
        ref={boxRef}
        value={value}
        onChange={(e) => cb.current(e.target.value)}
        placeholder={placeholder || 'Flat / office no., building, street, area, pincode'}
        style={{
          width: '100%', minHeight: 66, padding: '11px 13px', borderRadius: 12,
          border: `1px solid ${C.line}`, fontSize: 14, color: C.ink, background: '#fff',
          outline: 'none', fontFamily: 'inherit', resize: 'vertical',
        }}
      />
      {ready && !failed && (
        <p style={{ fontSize: 11, color: C.muted, margin: '4px 0 0' }}>
          Start typing and pick your building from the list, then add your flat number.
        </p>
      )}
    </>
  );
}
