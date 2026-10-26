'use client';
import { useEffect, useRef, useState } from 'react';
import NetworkBadge from './NetworkBadge';
import { NETWORKS, networkFor } from '../lib/networks';
import { fmtUsd, fmtPct, fmtFee, fmtAge } from '../lib/format';

const MIN_TVL = 10000; // «совсем мусор»: пулы с ликвидностью меньше этого скрываем
const SORTS = [['tvl', 'TVL'], ['apr', 'APR'], ['vol24', 'Объём']];

// favSet — множество "сеть:адрес" уже добавленных пулов; onAdded() — после успешного добавления;
// onActiveChange(bool) — сообщает странице, что идёт поиск (чтобы спрятать избранное)
export default function PoolSearch({ favSet, onAdded, onActiveChange }) {
  const [network, setNetwork] = useState('solana');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [sort, setSort] = useState('tvl');
  const [hideSmall, setHideSmall] = useState(true);
  const [stableOnly, setStableOnly] = useState(false);
  const [recent, setRecent] = useState([]);
  const [addingKey, setAddingKey] = useState(null);
  const reqId = useRef(0);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      const n = localStorage.getItem('poolNetwork');
      if (n && NETWORKS.some(x => x.key === n)) setNetwork(n);
      const sv = localStorage.getItem('poolSort');
      if (sv && SORTS.some(x => x[0] === sv)) setSort(sv);
    } catch {}
  }, []);
  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem(`poolRecent:${network}`) || '[]')); } catch { setRecent([]); }
  }, [network]);

  const q = query.trim();
  useEffect(() => { onActiveChange && onActiveChange(q.length > 0); }, [q.length > 0]);

  // поиск с задержкой, чтобы не дёргать источник на каждую букву
  useEffect(() => {
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
  }, [q, network]);

  function pickNetwork(k) {
    setNetwork(k);
    try { localStorage.setItem('poolNetwork', k); } catch {}
  }
  function pickSort(k) {
    setSort(k);
    try { localStorage.setItem('poolSort', k); } catch {}
  }
  function rememberCoin(coin) {
    const list = [coin, ...recent.filter(x => x.toUpperCase() !== coin.toUpperCase())].slice(0, 4);
    setRecent(list);
    try { localStorage.setItem(`poolRecent:${network}`, JSON.stringify(list)); } catch {}
  }

  async function add(p) {
    if (favSet.has(`${p.network}:${p.address}`)) return;
    setErr('');
    setAddingKey(p.address);
    const r = await fetch('/api/pool-favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ network: p.network, address: p.address }),
    });
    const d = await r.json();
    setAddingKey(null);
    if (!r.ok && r.status !== 409) { setErr(d.error || 'Не удалось добавить'); return; }
    if (q.length < 30) rememberCoin(q);
    setQuery('');
    onAdded && onAdded();
  }

  let shown = results.filter(p => (!hideSmall || (p.tvl || 0) >= MIN_TVL) && (!stableOnly || p.hasStable));
  shown = [...shown].sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1));
  const hiddenCount = results.length - shown.length;

  const quick = [...new Set([...recent, ...(networkFor(network).quick || [])])].slice(0, 8);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {NETWORKS.map(n => (
          <button key={n.key} type="button" onClick={() => pickNetwork(n.key)} style={network === n.key ? chipActive : chip}>
            <NetworkBadge network={n.key} size="md" />
            <span>{n.label}</span>
          </button>
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Монета в сети ${networkFor(network).label}: ETH, SOL…`}
          autoComplete="off"
          autoCapitalize="characters"
          style={input}
        />
        {query && <button type="button" onClick={() => setQuery('')} style={clearBtn} aria-label="Очистить">×</button>}
      </div>

      {!q && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {quick.map(c => (
            <button key={c} type="button" onClick={() => { setQuery(c); inputRef.current?.focus(); }} style={coinChip}>{c}</button>
          ))}
        </div>
      )}

      {q && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '12px 0 6px' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>Сортировка:</span>
            {SORTS.map(([k, t]) => (
              <button key={k} type="button" onClick={() => pickSort(k)} style={sort === k ? sortChipActive : sortChip}>{t}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8, fontSize: 15, color: 'var(--text-dim)' }}>
            <label style={checkLabel}>
              <input type="checkbox" checked={hideSmall} onChange={e => setHideSmall(e.target.checked)} style={checkBox} />
              Скрыть мелкие (TVL &lt; {fmtUsd(MIN_TVL)})
            </label>
            <label style={checkLabel}>
              <input type="checkbox" checked={stableOnly} onChange={e => setStableOnly(e.target.checked)} style={checkBox} />
              Только со стейблом
            </label>
          </div>
        </>
      )}

      {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
      {loading && <p style={{ opacity: 0.7 }}>Ищу…</p>}
      {q && q.length < 2 && <p style={{ opacity: 0.7 }}>Введите минимум 2 символа.</p>}
      {!loading && q.length >= 2 && !err && shown.length === 0 && (
        <p style={{ opacity: 0.7 }}>Пулов не найдено{hiddenCount > 0 ? ` (скрыто фильтрами: ${hiddenCount})` : ''}.</p>
      )}

      {q.length >= 2 && shown.map(p => {
        const inFav = favSet.has(`${p.network}:${p.address}`);
        return (
          <button key={p.address} type="button" onClick={() => add(p)} disabled={addingKey === p.address || inFav} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 18 }}>{p.base}/{p.quote}</span>
              <span style={feeBadge}>{fmtFee(p.feePct)}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>{p.dex || '—'}</span>
              <span style={{ marginLeft: 'auto', fontSize: 14, color: inFav ? 'var(--accent)' : 'var(--text-dim)' }}>
                {inFav ? '✓ в избранном' : addingKey === p.address ? '…' : '☆ добавить'}
              </span>
            </div>
            <div style={statGrid}>
              <Stat cap="APR 24ч" value={p.apr == null ? '—' : `${p.apr >= 1000 ? Math.round(p.apr) : p.apr.toFixed(1).replace('.', ',')}%`} strong />
              <Stat cap="TVL" value={fmtUsd(p.tvl)} />
              <Stat cap="Объём 24ч" value={fmtUsd(p.vol24)} />
              <Stat cap="Комиссии 24ч" value={fmtUsd(p.vol24 != null && p.feePct != null ? p.vol24 * p.feePct / 100 : null)} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6 }}>
              Цена 24ч <span style={{ color: (p.change24 ?? 0) >= 0 ? '#26a69a' : '#ef5350' }}>{fmtPct(p.change24)}</span> · Возраст {fmtAge(p.createdAt)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Stat({ cap, value, strong }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2, whiteSpace: 'nowrap' }}>{cap}</div>
      <div style={{ fontSize: 16, fontWeight: strong ? 700 : 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

const input = { width: '100%', padding: '14px 40px 14px 14px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box', fontSize: 17 };
const clearBtn = { position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, border: 'none', background: 'none', color: 'var(--text-dim)', fontSize: 22, cursor: 'pointer' };
const chip = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 15 };
const chipActive = { ...chip, borderColor: 'var(--accent)', background: 'var(--input-bg)', fontWeight: 600 };
const coinChip = { padding: '8px 14px', borderRadius: 999, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer', fontSize: 16, fontWeight: 600 };
const sortChip = { padding: '5px 12px', borderRadius: 999, border: '1px solid var(--input-border)', background: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14 };
const sortChipActive = { ...sortChip, borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 };
const checkLabel = { display: 'flex', alignItems: 'center', gap: 8 };
const checkBox = { width: 18, height: 18 };
const card = { display: 'block', width: '100%', textAlign: 'left', padding: '14px 4px', background: 'none', border: 'none', borderBottom: '1px solid var(--card-border)', color: 'var(--text)', cursor: 'pointer' };
const statGrid = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 10 };
const feeBadge = { fontSize: 12, fontWeight: 700, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--card-border)', color: 'var(--text-dim)' };
