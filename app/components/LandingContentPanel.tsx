'use client';

/**
 * LandingContentPanel — admin editor for the desktop marketing landing.
 * Loads GET /settings, edits the `landingContent` blob, saves via
 * PATCH /settings with the x-admin-key header (same as StoreSettingsPanel).
 *
 * Mount this in your admin page wherever you show settings sub-panels, e.g.:
 *   <LandingContentPanel adminHeaders={() => ({ 'x-admin-key': getAdminKey() })} />
 */

import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/bite';

const G = '#0D3B2E', AMBER = '#b76e00', LINE = '#e4ebe6';

interface Feature { icon: string; title: string; subtitle: string }
interface LandingContent {
  logoUrl: string; brandName: string; city: string;
  tagline1: string; tagline2: string; heroSubtitle: string; heroBadge: string;
  stat1Value: string; stat1Label: string;
  stat2Value: string; stat2Label: string;
  stat3Value: string; stat3Label: string;
  features: Feature[];
  phone: string; hoursLine: string; mapEmbedUrl: string;
  ctaHeading: string; ctaSubtitle: string;
}

const BLANK: LandingContent = {
  logoUrl: '', brandName: 'Bites Theory', city: 'Indore',
  tagline1: 'Smart Food.', tagline2: 'Better Living.',
  heroSubtitle: '', heroBadge: '100% PURE VEG · INDORE KA APNA',
  stat1Value: '4.8★', stat1Label: '1,200+ ratings',
  stat2Value: '25 min', stat2Label: 'avg delivery',
  stat3Value: '100%', stat3Label: 'pure veg',
  features: [
    { icon: '🏆', title: '#1 in Indore', subtitle: 'most-loved veg kitchen' },
    { icon: '🛵', title: 'Free Delivery', subtitle: 'within 5 km, over ₹199' },
    { icon: '🌱', title: 'Farm Fresh', subtitle: 'sourced daily, Malwa region' },
    { icon: '💚', title: '50k+ Orders', subtitle: 'served with love' },
  ],
  phone: '', hoursLine: '', mapEmbedUrl: '',
  ctaHeading: 'Bhookh lagi? Order kar do 😋', ctaSubtitle: '',
};

export default function LandingContentPanel({
  adminHeaders,
}: {
  adminHeaders: () => Record<string, string>;
}) {
  const [lc, setLc] = useState<LandingContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const r = await fetch(`${API_BASE}/settings`, { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      setLc({ ...BLANK, ...(d.landingContent || {}) });
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!lc) return;
    setSaving(true); setMsg('');
    try {
      const r = await fetch(`${API_BASE}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ landingContent: lc }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.message || 'Save failed');
      setMsg('✓ Saved — live on the desktop site immediately');
      await load();
    } catch (e: any) {
      setMsg('✗ ' + (e.message || 'Could not save'));
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 3500);
    }
  }

  if (!lc) return <div style={{ padding: 24, color: '#888' }}>Loading landing content…</div>;

  const input: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: `1px solid ${LINE}`, fontSize: 13, color: G, marginTop: 4,
  };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: G, display: 'block', marginTop: 14 };
  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, marginBottom: 16 };
  const h: React.CSSProperties = { fontWeight: 800, color: G, fontSize: 15, marginBottom: 4 };
  const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
  const set = (k: keyof LandingContent, v: any) => setLc({ ...lc, [k]: v });
  const setFeat = (i: number, k: keyof Feature, v: string) => {
    const features = lc.features.map((f, idx) => (idx === i ? { ...f, [k]: v } : f));
    setLc({ ...lc, features });
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <h2 style={{ color: G, fontWeight: 900, fontSize: 20, margin: '4px 0 4px' }}>Desktop landing page</h2>
      <p style={{ fontSize: 12, color: '#6b7d74', marginBottom: 16 }}>
        Shown to laptop/desktop visitors on your home page. Mobile users see the app directly. Changes go live instantly.
      </p>

      <div style={card}>
        <div style={h}>Brand</div>
        <label style={label}>Logo image URL (upload in Products/Uploader, paste the link)</label>
        <input style={input} value={lc.logoUrl} onChange={(e) => set('logoUrl', e.target.value)} placeholder="https://…/logo.png (blank = letter badge)" />
        <label style={label}>Brand name</label>
        <input style={input} value={lc.brandName} onChange={(e) => set('brandName', e.target.value)} />
        <label style={label}>City (shown in header, e.g. Indore)</label>
        <input style={input} value={lc.city} onChange={(e) => set('city', e.target.value)} placeholder="Indore" />
      </div>

      <div style={card}>
        <div style={h}>Hero</div>
        <div style={row2}>
          <div><label style={label}>Headline line 1</label><input style={input} value={lc.tagline1} onChange={(e) => set('tagline1', e.target.value)} /></div>
          <div><label style={label}>Headline line 2 (shimmer)</label><input style={input} value={lc.tagline2} onChange={(e) => set('tagline2', e.target.value)} /></div>
        </div>
        <label style={label}>Badge line</label>
        <input style={input} value={lc.heroBadge} onChange={(e) => set('heroBadge', e.target.value)} />
        <label style={label}>Subtitle paragraph</label>
        <textarea style={{ ...input, minHeight: 70 }} value={lc.heroSubtitle} onChange={(e) => set('heroSubtitle', e.target.value)} />
      </div>

      <div style={card}>
        <div style={h}>Hero stats (3)</div>
        {[1, 2, 3].map((n) => (
          <div key={n} style={row2}>
            <div><label style={label}>Stat {n} value</label><input style={input} value={(lc as any)[`stat${n}Value`]} onChange={(e) => set(`stat${n}Value` as any, e.target.value)} /></div>
            <div><label style={label}>Stat {n} label</label><input style={input} value={(lc as any)[`stat${n}Label`]} onChange={(e) => set(`stat${n}Label` as any, e.target.value)} /></div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={h}>Why choose us (4 cards)</div>
        {lc.features.map((f, i) => (
          <div key={i} style={{ ...row2, gridTemplateColumns: '60px 1fr 1fr', marginTop: 6 }}>
            <div><label style={label}>Icon</label><input style={input} value={f.icon} onChange={(e) => setFeat(i, 'icon', e.target.value)} /></div>
            <div><label style={label}>Title</label><input style={input} value={f.title} onChange={(e) => setFeat(i, 'title', e.target.value)} /></div>
            <div><label style={label}>Subtitle</label><input style={input} value={f.subtitle} onChange={(e) => setFeat(i, 'subtitle', e.target.value)} /></div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={h}>Find us</div>
        <label style={label}>Phone</label>
        <input style={input} value={lc.phone} onChange={(e) => set('phone', e.target.value)} />
        <label style={label}>Hours line</label>
        <input style={input} value={lc.hoursLine} onChange={(e) => set('hoursLine', e.target.value)} />
        <label style={label}>Google Maps embed URL (optional — blank uses your saved store lat/lng)</label>
        <input style={input} value={lc.mapEmbedUrl} onChange={(e) => set('mapEmbedUrl', e.target.value)} placeholder="https://www.google.com/maps/embed?pb=…" />
      </div>

      <div style={card}>
        <div style={h}>Final call-to-action</div>
        <label style={label}>Heading</label>
        <input style={input} value={lc.ctaHeading} onChange={(e) => set('ctaHeading', e.target.value)} />
        <label style={label}>Subtitle</label>
        <input style={input} value={lc.ctaSubtitle} onChange={(e) => set('ctaSubtitle', e.target.value)} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={save} disabled={saving} style={{ background: G, color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          {saving ? 'Saving…' : 'Save landing content'}
        </button>
        {msg && <span style={{ fontSize: 13, fontWeight: 700, color: msg.startsWith('✓') ? AMBER : '#c0392b' }}>{msg}</span>}
      </div>
    </div>
  );
}
