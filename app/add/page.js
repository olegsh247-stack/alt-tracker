'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const EXCHANGES = ['BINANCE', 'BYBIT', 'OKX', 'MEXC'];

export default function AddPairPage() {
  const [asset1, setAsset1] = useState('');
  const [exchange1, setExchange1] = useState('BINANCE');
  const [asset2, setAsset2] = useState('');
  const [exchange2, setExchange2] = useState('BINANCE');
  const [err, setErr] = useState('');
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setErr('');
    const r = await fetch('/api/pairs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset1, exchange1, asset2, exchange2 }),
    });
    const d = await r.json();
    if (!r.ok) { setErr(d.error); return; }
    router.push('/?tab=crypto');
  }

  return (
    <div style={{ maxWidth: 360, margin: '40px auto', padding: 24 }}>
      <h1 style={{ fontSize: 20 }}>Добавить пару</h1>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={label}>Актив 1</div>
          <input placeholder="Например DOGE" value={asset1} onChange={e => setAsset1(e.target.value)} style={input} />
          <select value={exchange1} onChange={e => setExchange1(e.target.value)} style={{ ...input, marginTop: 8 }}>
            {EXCHANGES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
          </select>
        </div>
        <div>
          <div style={label}>Актив 2</div>
          <input placeholder="Например LTC" value={asset2} onChange={e => setAsset2(e.target.value)} style={input} />
          <select value={exchange2} onChange={e => setExchange2(e.target.value)} style={{ ...input, marginTop: 8 }}>
            {EXCHANGES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
          </select>
        </div>
        {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => router.push('/?tab=crypto')} style={cancelBtn}>Отмена</button>
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
