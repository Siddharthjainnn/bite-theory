'use client';

/**
 * /account/addresses — Saved Addresses.
 * List the user's addresses, add a new one (map pick + manual fields),
 * set default, delete. Same address API the checkout page uses.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppShell from '../../components/AppShell';
import AppHeader from '../../components/AppHeader';
import MapPicker, { PickedLocation } from '../../components/MapPicker';
import {
  C, SavedAddress, fetchAddresses, createAddress, updateAddress, deleteAddress,
} from '../../lib/bite';

export default function SavedAddressesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = (session?.user as any)?.id ? Number((session?.user as any).id) : undefined;

  const [rows, setRows] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [form, setForm] = useState({ label: 'Home', fullAddress: '', landmark: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login?callbackUrl=/account/addresses');
  }, [status, router]);

  useEffect(() => {
    if (!userId) return;
    fetchAddresses(userId)
      .then(setRows)
      .catch(() => setError('Could not load addresses'))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (picked) setForm((f) => ({ ...f, fullAddress: picked.address }));
  }, [picked]);

  async function save() {
    if (!userId) return;
    if (!form.fullAddress.trim()) { setError('Please enter the full address'); return; }
    setSaving(true); setError('');
    try {
      const saved = await createAddress({
        userId,
        label: form.label,
        fullAddress: form.fullAddress.trim(),
        landmark: form.landmark.trim() || undefined,
        pincode: picked?.pincode, city: picked?.city, state: picked?.state,
        latitude: picked?.lat, longitude: picked?.lng,
      });
      setRows((r) => [saved, ...r]);
      setAdding(false);
      setPicked(null);
      setForm({ label: 'Home', fullAddress: '', landmark: '' });
    } catch (e: any) {
      setError(e.message || 'Could not save address');
    } finally {
      setSaving(false);
    }
  }

  async function makeDefault(a: SavedAddress) {
    setBusyId(Number(a.id));
    try {
      await updateAddress(Number(a.id), { isDefault: true });
      setRows((r) => r.map((x) => ({ ...x, isDefault: Number(x.id) === Number(a.id) })));
    } catch { setError('Could not update default'); }
    finally { setBusyId(null); }
  }

  async function remove(a: SavedAddress) {
    if (!confirm('Delete this address?')) return;
    setBusyId(Number(a.id));
    try {
      await deleteAddress(Number(a.id));
      setRows((r) => r.filter((x) => Number(x.id) !== Number(a.id)));
    } catch { setError('Could not delete address'); }
    finally { setBusyId(null); }
  }

  const card: React.CSSProperties = {
    background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16,
    padding: 14, marginBottom: 12,
  };
  const input: React.CSSProperties = {
    width: '100%', border: `1px solid ${C.line}`, borderRadius: 10,
    padding: '10px 12px', fontSize: 13, outline: 'none', background: '#fff',
    marginBottom: 8, boxSizing: 'border-box',
  };
  const chip = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
    border: `1px solid ${active ? C.green : C.line}`,
    background: active ? C.greenSoft : '#fff',
    color: active ? C.greenDeep : C.muted, cursor: 'pointer',
  });

  return (
    <AppShell header={<AppHeader variant="page" title="Saved Addresses" />}>
      <div style={{ padding: '14px 14px 28px' }}>
        {error && (
          <div style={{ ...card, borderColor: '#f3c1c1', background: '#fdf0f0', color: '#c0392b', fontSize: 13 }}>
            {error}
          </div>
        )}

        {!adding && (
          <button
            onClick={() => { setAdding(true); setError(''); }}
            style={{
              width: '100%', border: `1.5px dashed ${C.green}`, background: C.greenSoft,
              color: C.greenDeep, fontWeight: 800, fontSize: 14, borderRadius: 14,
              padding: '13px 0', cursor: 'pointer', marginBottom: 14,
            }}
          >
            ＋ Add New Address
          </button>
        )}

        {adding && (
          <div style={card}>
            <div style={{ fontWeight: 800, fontSize: 14, color: C.ink, marginBottom: 10 }}>New Address</div>
            <MapPicker onPick={setPicked} />
            <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}>
              {['Home', 'Work', 'Other'].map((l) => (
                <button key={l} style={chip(form.label === l)} onClick={() => setForm((f) => ({ ...f, label: l }))}>
                  {l}
                </button>
              ))}
            </div>
            <textarea
              style={{ ...input, minHeight: 64, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Full address (house no, street, area)"
              value={form.fullAddress}
              onChange={(e) => setForm((f) => ({ ...f, fullAddress: e.target.value }))}
            />
            <input
              style={input}
              placeholder="Landmark (optional)"
              value={form.landmark}
              onChange={(e) => setForm((f) => ({ ...f, landmark: e.target.value }))}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={save} disabled={saving}
                style={{
                  flex: 1, background: C.green, color: '#fff', border: 'none', borderRadius: 12,
                  padding: '12px 0', fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save Address'}
              </button>
              <button
                onClick={() => { setAdding(false); setError(''); }}
                style={{
                  background: '#fff', color: C.muted, border: `1px solid ${C.line}`, borderRadius: 12,
                  padding: '12px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ ...card, color: C.muted, fontSize: 13 }}>Loading your addresses…</div>
        ) : rows.length === 0 && !adding ? (
          <div style={{ ...card, textAlign: 'center', padding: 30 }}>
            <div style={{ fontSize: 34 }}>📍</div>
            <div style={{ fontWeight: 800, color: C.ink, marginTop: 6 }}>No saved addresses yet</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>
              Add one now and checkout becomes one tap faster.
            </div>
          </div>
        ) : (
          rows.map((a) => (
            <div key={a.id} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>{a.label === 'Work' ? '💼' : a.label === 'Other' ? '📌' : '🏠'}</span>
                <b style={{ fontSize: 14, color: C.ink }}>{a.label || 'Address'}</b>
                {a.isDefault && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, background: C.greenSoft, color: C.greenDeep,
                    borderRadius: 12, padding: '2px 9px', letterSpacing: 0.3,
                  }}>DEFAULT</span>
                )}
              </div>
              <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.45 }}>{a.fullAddress}</div>
              {a.landmark && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Landmark: {a.landmark}</div>}
              {(a.city || a.pincode) && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {[a.city, a.state, a.pincode].filter(Boolean).join(', ')}
                </div>
              )}
              <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
                {!a.isDefault && (
                  <button
                    onClick={() => makeDefault(a)} disabled={busyId === Number(a.id)}
                    style={{ background: 'none', border: 'none', color: C.greenDeep, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', padding: 0 }}
                  >
                    Set as default
                  </button>
                )}
                <button
                  onClick={() => remove(a)} disabled={busyId === Number(a.id)}
                  style={{ background: 'none', border: 'none', color: '#d64545', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', padding: 0 }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
