'use client';

/**
 * MapPicker — Swiggy-style location picker.
 * Fixed center pin, pannable map, "Use my location" button,
 * reverse-geocodes to a human address on every settle.
 * Gracefully degrades to a manual note if no Maps API key.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { C } from '../lib/bite';
import { loadGoogleMaps, getCurrentPosition, reverseGeocode, MAPS_KEY } from '../lib/maps';

export interface PickedLocation {
  lat: number;
  lng: number;
  address: string;
  pincode?: string;
  city?: string;
  state?: string;
}

const FALLBACK_CENTER = { lat: 22.7196, lng: 75.8577 }; // Indore

export default function MapPicker({
  onPick,
  height = 240,
}: {
  onPick: (loc: PickedLocation) => void;
  height?: number;
}) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [ready, setReady] = useState(false);
  const [noMap, setNoMap] = useState(!MAPS_KEY);
  const [resolving, setResolving] = useState(false);
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const settle = useCallback(async (lat: number, lng: number) => {
    setResolving(true);
    try {
      const geo = await reverseGeocode(lat, lng);
      const loc: PickedLocation = { lat, lng, ...geo };
      setPicked(loc);
      onPickRef.current(loc);
    } catch {
      const loc: PickedLocation = { lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
      setPicked(loc);
      onPickRef.current(loc);
    } finally {
      setResolving(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const g = await loadGoogleMaps();
        if (cancelled || !mapDiv.current) return;
        // try user's location for initial center; fall back silently
        let center = FALLBACK_CENTER;
        try { center = await getCurrentPosition(); } catch { /* denied */ }
        if (cancelled) return;
        const map = new g.maps.Map(mapDiv.current, {
          center,
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
        });
        mapRef.current = map;
        map.addListener('idle', () => {
          const c = map.getCenter();
          if (c) settle(c.lat(), c.lng());
        });

        /* Places autocomplete: typing an address recenters the map, which
           triggers the same idle→settle flow used by dragging the pin. */
        if (searchRef.current && g.maps.places?.Autocomplete) {
          try {
            const ac = new g.maps.places.Autocomplete(searchRef.current, {
              fields: ['geometry', 'formatted_address'],
              componentRestrictions: { country: 'in' },
            });
            ac.bindTo('bounds', map);
            ac.addListener('place_changed', () => {
              const place = ac.getPlace();
              const loc = place.geometry?.location;
              if (!loc) return;
              map.setCenter(loc);
              map.setZoom(17);
              // idle listener will reverse-geocode + fire onPick
            });
            acRef.current = ac;
          } catch { /* places not enabled on this key — map still works */ }
        }

        setReady(true);
      } catch {
        if (!cancelled) setNoMap(true);
      }
    })();
    return () => { cancelled = true; };
  }, [settle]);

  async function useMyLocation() {
    try {
      const pos = await getCurrentPosition();
      if (mapRef.current) {
        mapRef.current.setCenter(pos);
        mapRef.current.setZoom(17);
      } else {
        settle(pos.lat, pos.lng);
      }
    } catch {
      alert('Location permission denied. Please allow location access or drag the map.');
    }
  }

  if (noMap) {
    /* Bug #67 — "the map doesn't display": with no Google key (or the script
       blocked) the picker collapsed into a text note, so users couldn't see a
       map at all. Show a free OpenStreetMap embed as a visual fallback plus a
       "use my location" shortcut. Pin-drag picking still needs the Google key
       (set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY on Vercel for the full picker). */
    const center = picked || FALLBACK_CENTER as any;
    const lat = Number((center as any).lat) || FALLBACK_CENTER.lat;
    const lng = Number((center as any).lng) || FALLBACK_CENTER.lng;
    const d = 0.008;
    return (
      <div>
        <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.line}` }}>
          <iframe
            title="Map"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`}
            style={{ width: '100%', height, border: 0, display: 'block' }}
            loading="lazy"
          />
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              const pos = await getCurrentPosition();
              settle(pos.lat, pos.lng);
            } catch {
              alert('Location permission denied. Please allow location access.');
            }
          }}
          style={{
            marginTop: 8, background: '#fff', border: `1px solid ${C.line}`,
            borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 700,
            color: C.greenDeep, cursor: 'pointer',
          }}
        >
          🎯 Use my current location
        </button>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>
          {picked?.address
            ? <>📍 {picked.address}</>
            : <>Interactive pin-drop needs the Google Maps key
                (<b>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</b>) — until then, use the
                button above or type the address below.</>}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Places autocomplete search box */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, pointerEvents: 'none' }}>🔍</span>
        <input
          ref={searchRef}
          type="text"
          placeholder="Search for area, street, landmark…"
          style={{
            width: '100%', padding: '11px 12px 11px 36px', fontSize: 13.5,
            border: `1px solid ${C.line}`, borderRadius: 12, outline: 'none',
            background: '#fff', color: C.ink,
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
        />
      </div>
    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.line}` }}>
      <div ref={mapDiv} style={{ width: '100%', height }} />
      {/* fixed center pin */}
      {ready && (
        <div
          style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%, -100%)', fontSize: 34,
            pointerEvents: 'none', filter: 'drop-shadow(0 3px 3px rgba(0,0,0,.3))',
          }}
        >
          📍
        </div>
      )}
      <button
        type="button"
        onClick={useMyLocation}
        style={{
          position: 'absolute', bottom: 12, right: 12,
          background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10,
          padding: '8px 12px', fontSize: 12, fontWeight: 700, color: C.greenDeep,
          boxShadow: '0 2px 8px rgba(0,0,0,.12)', cursor: 'pointer',
        }}
      >
        🎯 Use my location
      </button>
      <div
        style={{
          position: 'absolute', left: 12, bottom: 12, right: 130,
          background: 'rgba(255,255,255,.95)', borderRadius: 10, padding: '8px 10px',
          fontSize: 11.5, color: C.ink, boxShadow: '0 2px 8px rgba(0,0,0,.12)',
          maxHeight: 56, overflow: 'hidden',
        }}
      >
        {resolving ? 'Locating…' : picked?.address || 'Drag the map to set your location'}
      </div>
    </div>
    </div>
  );
}
