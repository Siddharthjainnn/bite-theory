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
    return (
      <div
        style={{
          border: `1px dashed ${C.line}`, borderRadius: 14, padding: 16,
          background: C.bg, fontSize: 13, color: C.muted,
        }}
      >
        📍 Map unavailable (missing <b>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</b>).
        Enter your full address manually below — everything else works.
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
