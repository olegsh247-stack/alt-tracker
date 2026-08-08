'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Chart from '../../../components/Chart';

const RANGES = [{ key: 'all', label: 'All' }, { key: '1y', label: '1 год' }, { key: '1m', label: '1 месяц' }];

export default function PairChartPage() {
  const { id } = useParams();
  const router = useRouter();
  const [range, setRange] = useState('all');
  const [candles, setCandles] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setCandles(null);
    setErr('');
    fetch(`/api/klines?pairId=${id}&range=${range}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setErr(d.error);
        else setCandles(d.candles);
      });
  }, [id, range]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <button onClick={() => router.push('/')} style={backBtn}>← Назад</button>
      <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
        {RANGES.map(r => (
          <button key={r.key} onClick={() => setRange(r.key)} style={r.key === range ? tabActive : tab}>
            {r.label}
          </button>
        ))}
      </div>
      {err && <p style={{ color: '#f66' }}>{err}</p>}
      {!err && !candles && <p>Загрузка графика...</p>}
      {!err && candles && candles.length === 0 && <p>Нет данных за этот период.</p>}
      {!err && candles && candles.length > 0 && <Chart candles={candles} />}
    </div>
  );
}

const backBtn = { background: 'none', border: 'none', color: '#8ab4f8', fontSize: 14, cursor: 'pointer', padding: 0 };
const tab = { padding: '8px 16px', borderRadius: 8, border: '1px solid #333', background: 'none', color: '#aaa' };
const tabActive = { ...tab, background: '#2b6cf6', color: '#fff', borderColor: '#2b6cf6' };
