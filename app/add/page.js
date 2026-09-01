'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TickerPicker from '../../components/TickerPicker';

export default function AddPairPage() {
  const [asset1, setAsset1] = useState('');
  const [exchange1, setExchange1] = useState('');
  const [asset2, setAsset2] = useState('');
  const [exchange2, setExchange2] = useState('');
  const [err, setErr] = useState('');
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!asset1 || !exchange1 || !asset2 || !exchange2) {
      setErr('Выберите оба актива из списка');
      return;
    }
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
          <div style={label}>Актив 1{exchange1 && <span style={pickedNote}> · выбрано на {exchange1}</span>}</div>
          <TickerPicker placeholder="Например EL" onPick={(a, ex) => { setAsset1(a); setExchange1(ex); }} />
        </div>
        <div>
          <div style={label}>Актив 2{exchange2 && <span style={pickedNote}> · выбрано на {exchange2}</span>}</div>
          <TickerPicker placeholder="Например USDT" onPick={(a, ex) => { setAsset2(a); setExchange2(ex); }} />
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
const pickedNote = { color: 'var(--accent)' };
const okBtn = { flex: 1, padding: 12, borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600 };
const cancelBtn = { flex: 1, padding: 12, borderRadius: 8, border: '1px solid var(--input-border)', background: 'none', color: 'var(--text-dim)' };
