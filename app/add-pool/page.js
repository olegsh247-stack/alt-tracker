'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import NetworkBadge from '../../components/NetworkBadge';
import { NETWORKS } from '../../lib/networks';
import { fmtUsd, fmtPct, fmtFee, fmtAge } from '../../lib/format';

const MIN_TVL = 10000; // «совсем мусор» — пулы с ликвидностью меньше этого скрываем

export default function AddPoolPage() {
  const router = useRouter();
  const [network, setNetwork] = useState('solana');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hideSmall, setHideSmall] = useState(true);
  const [err, setErr] = useState('');
  const [addingKey, setAddingKey] = useState(null);
  const reqId = useRef(0);

  useEffect(() => {
    try { const n = localStorage.getItem('poolNetwork'); if (n && NETWORKS.some(x => x.key === n)) setNetwork(n); } catch {}
  }, []);

  // поиск с задержкой, чтобы не дёргать источник на каждую букву
  useEffect(() => {
    const q = query.trim();
    setErr('');
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/pool-search?network=${network}&q=${encodeURIComponent(q)}`);
        const d = await r.json();
        if (id !== reqId.current) return;
        if (!r.ok) { setErr(d.error || 'Ошибка поиска'); setResults([]); }
        else setResults(d.results || []);
      } catch {
        if (id === reqId.current) { setErr('Ошибка соединения'); setResults([]); }
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query, network]);

  function pickNetwork(k) {
    setNetwork(k);
    try { localStorage.setItem('poolNetwork', k); } catch {}
  }

  async function add(p) {
    setErr('');
    setAddingKey(p.address);
    const r = await fetch('/api/pool-favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ network: p.network, address: p.address }),
    });
    const d = await r.json();
    setAddingKey(null);
    if (!r.ok) { setErr(d.error || 'Не удалось добавить'); return; }
    router.push('/?tab=pool');
  }

  const shown = results.filter(p => !hideSmall || (p.tvl || 0) >= MIN_TVL);
  const hiddenCount = results.length - shown.length;

  return (
    <div style={{ maxWidth: 560, margin: '40px auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, marginTop: 0 }}>Добавить пул</h1>

      <div style={label}>Сеть</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {NETWORKS.map(n => (
          <button key={n.key} type="button" onClick={() => pickNetwork(n.key)} style={network === n.key ? chipActive : chip}>
            <NetworkBadge network={n.key} size="md" />
            <span>{n.label}</span>
          </button>
        ))}
      </div>

      <div style={label}>Тикер или адрес токена</div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Например ELIZAOS (от 2 символов)"
        autoComplete="off"
        style={input}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0', fontSize: 15, color: 'var(--text-dim)' }}>
        <input type="checkbox" checked={hideSmall} onChange={e => setHideSmall(e.target.checked)} style={{ width: 18, height: 18 }} />
        Скрыть пулы с TVL меньше {fmtUsd(MIN_TVL)}
      </label>

      {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
      {loading && <p style={{ opacity: 0.7 }}>Ищу…</p>}
      {!loading && query.trim().length >= 2 && !err && shown.length === 0 && (
        <p style={{ opacity: 0.7 }}>
          Пулов не найдено{hiddenCount > 0 ? ` (скрыто мелких: ${hiddenCount})` : ''}.
        </p>
      )}

      <div>
        {shown.map(p => (
          <button key={p.address} type="button" onClick={() => add(p)} disabled={addingKey === p.address} style={resultRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700 }}>{p.base}/{p.quote}</span>
              <span style={feeBadge}>{fmtFee(p.feePct)}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>{p.dex || '—'}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 600, color: (p.change24 ?? 0) >= 0 ? '#26a69a' : '#ef5350' }}>{fmtPct(p.change24)}</span>
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 14, color: 'var(--text-dim)', marginTop: 4 }}>
              <span>TVL {fmtUsd(p.tvl)}</span>
              <span>Объём 24ч {fmtUsd(p.vol24)}</span>
              <span>Возраст {fmtAge(p.createdAt)}</span>
            </div>
          </button>
        ))}
      </div>

      <button type="button" onClick={() => router.push('/?tab=pool')} style={cancelBtn}>Отмена</button>
    </div>
  );
}

const label = { fontSize: 15, opacity: 0.7, marginBottom: 6 };
const input = { width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box', fontSize: 16 };
const chip = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 15 };
const chipActive = { ...chip, borderColor: 'var(--accent)', background: 'var(--input-bg)', fontWeight: 600 };
const resultRow = { display: 'block', width: '100%', textAlign: 'left', padding: '12px 4px', background: 'none', border: 'none', borderBottom: '1px solid var(--card-border)', color: 'var(--text)', cursor: 'pointer' };
const feeBadge = { fontSize: 12, fontWeight: 700, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--card-border)', color: 'var(--text-dim)' };
const cancelBtn = { width: '100%', marginTop: 20, padding: 12, borderRadius: 8, border: '1px solid var(--input-border)', background: 'none', color: 'var(--text-dim)', cursor: 'pointer' };
