'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { COMMODITIES } from '../../lib/commodities';

export default function AddCommodityPage() {
  const [asset1, setAsset1] = useState(COMMODITIES[0].key);
  const [asset2, setAsset2] = useState(COMMODITIES[1].key);
  const [err, setErr] = useState('');
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setErr('');
    const r = await fetch('/api/commodities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset1, asset2 }),
    });
    const d = await r.json();
    if (!r.ok) { setErr(d.error); return; }
    router.push('/');
  }

  return (
    <div style={{ maxWidth: 360, margin: '40px auto', padding: 24 }}>
      <h1 style={{ fontSize: 20 }}>Добавить пару (Commodities)</h1>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={label}>Актив 1</div>
          <select value={asset1} onChange={e => setAsset1(e.target.value)} style={input}>
            {COMMODITIES.map(c => <option key={c.key} value={c.key}>{c.short}</option>)}
          </select>
        </div>
        <div>
          <div style={label}>Актив 2</div>
          <select value={asset2} onChange={e => setAsset2(e.target.value)} style={input}>
            {COMMODITIES.map(c => <option key={c.key} value={c.key}>{c.short}</option>)}
          </select>
        </div>
        {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => router.push('/')} style={cancelBtn}>Отмена</button>
          <button style={okBtn}>ОК</button>
        </div>
      </form>
    </div>
  );
}

const label = { fontSize: 13, opacity: 0.7, marginBottom: 6 };
const input = { width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box' };
const okBtn = { flex: 1, padding: 12, borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600 };
const cancelBtn = { flex: 1, padding: 12, borderRadius: 8, border: '1px solid var(--input-border)', background: 'none', color: 'var(--text-dim)' };
