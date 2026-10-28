'use client';
import { useEffect, useRef, useState } from 'react';
import NetworkBadge from './NetworkBadge';
import PoolTable from './PoolTable';
import { NETWORKS, networkFor } from '../lib/networks';
import { fmtUsd } from '../lib/format';

const MIN_TVL = 10000; // «совсем мусор»: пулы с ликвидностью меньше этого скрываем
const SORTS = [['tvl', 'TVL'], ['apr', 'APR'], ['vol24', 'Объём']];

// favSet — множество "сеть:адрес" уже добавленных пулов; onAdded() — после успешного добавления;
// onActiveChange(bool) — сообщает странице, что идёт поиск (чтобы спрятать избранное)
export default function PoolSearch({ favSet, onAdded, onActiveChange }) {
  const [nets, setNets] = useState(['solana']); // выбранные сети (можно несколько)
  const [failed, setFailed] = useState([]);
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
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem('poolNetworks') || 'null'); } catch {}
      if (!Array.isArray(saved)) { const n = localStorage.getItem('poolNetwork'); saved = n ? [n] : null; }
      const ok = (saved || []).filter(k => NETWORKS.some(x => x.key === k));
      if (ok.length > 0) setNets(ok);
      const sv = localStorage.getItem('poolSort');
      if (sv && SORTS.some(x => x[0] === sv)) setSort(sv);
    } catch {}
  }, []);
  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem('poolRecentAll') || '[]')); } catch { setRecent([]); }
  }, []);

  const q = query.trim();
  useEffect(() => { onActiveChange && onActiveChange(q.length > 0); }, [q.length > 0]);

  // поиск с задержкой; по каждой выбранной сети запрос идёт отдельно, результаты склеиваются
  const netsKey = nets.join(',');
  useEffect(() => {
    setErr('');
    setFailed([]);
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      const settled = await Promise.allSettled(nets.map(async (net) => {
        const r = await fetch(`/api/pool-search?network=${net}&q=${encodeURIComponent(q)}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Ошибка поиска');
        return d.results || [];
      }));
      if (id !== reqId.current) return;
      const okRows = settled.filter(x => x.status === 'fulfilled').flatMap(x => x.value);
      const bad = nets.filter((_, i) => settled[i].status === 'rejected');
      if (bad.length === nets.length) {
        const first = settled.find(x => x.status === 'rejected');
        setErr(first?.reason?.message || 'Ошибка соединения');
        setResults([]);
      } else {
        setResults(okRows);
        setFailed(bad);
      }
      setLoading(false);
    }, 400);
    return () => clearTimeout(t);
  }, [q, netsKey]);

  // клик по сети включает/выключает её; хотя бы одна всегда остаётся выбранной
  function toggleNetwork(k) {
    const next = nets.includes(k) ? nets.filter(x => x !== k) : [...nets, k];
    if (next.length === 0) return;
    const ordered = NETWORKS.map(n => n.key).filter(x => next.includes(x));
    setNets(ordered);
    try { localStorage.setItem('poolNetworks', JSON.stringify(ordered)); } catch {}
  }
  function pickSort(k) {
    setSort(k);
    try { localStorage.setItem('poolSort', k); } catch {}
  }
  function rememberCoin(coin) {
    const list = [coin, ...recent.filter(x => x.toUpperCase() !== coin.toUpperCase())].slice(0, 4);
    setRecent(list);
    try { localStorage.setItem('poolRecentAll', JSON.stringify(list)); } catch {}
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

  const quick = [...new Set([...recent, ...nets.flatMap(k => networkFor(k).quick || [])])].slice(0, 8);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {NETWORKS.map(n => (
          <button key={n.key} type="button" onClick={() => toggleNetwork(n.key)} aria-pressed={nets.includes(n.key)} style={nets.includes(n.key) ? chipActive : chip}>
            <NetworkBadge network={n.key} size="md" />
            <span>{n.label}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>Сортировка:</span>
          {SORTS.map(([k, t]) => (
            <button key={k} type="button" onClick={() => pickSort(k)} style={sort === k ? sortChipActive : sortChip}>{t}</button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={nets.length === 1 ? `Монета в сети ${networkFor(nets[0]).label}: ETH, SOL…` : `Монета в выбранных сетях (${nets.length}): ETH, SOL…`}
            autoComplete="off"
            autoCapitalize="characters"
            style={input}
          />
          {query && <button type="button" onClick={() => setQuery('')} style={clearBtn} aria-label="Очистить">×</button>}
        </div>
      </div>

      {!q && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {quick.map(c => (
            <button key={c} type="button" onClick={() => { setQuery(c); inputRef.current?.focus(); }} style={coinChip}>{c}</button>
          ))}
        </div>
      )}

      {q && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '10px 0 8px', fontSize: 15, color: 'var(--text-dim)' }}>
          <label style={checkLabel}>
            <input type="checkbox" checked={hideSmall} onChange={e => setHideSmall(e.target.checked)} style={checkBox} />
            Скрыть мелкие (TVL &lt; {fmtUsd(MIN_TVL)})
          </label>
          <label style={checkLabel}>
            <input type="checkbox" checked={stableOnly} onChange={e => setStableOnly(e.target.checked)} style={checkBox} />
            Только со стейблом
          </label>
        </div>
      )}

      {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
      {loading && <p style={{ opacity: 0.7 }}>Ищу…</p>}
      {!loading && failed.length > 0 && <p style={{ opacity: 0.7, fontSize: 14 }}>Не ответили: {failed.map(k => networkFor(k).label).join(', ')}.</p>}
      {q && q.length < 2 && <p style={{ opacity: 0.7 }}>Введите минимум 2 символа.</p>}
      {!loading && q.length >= 2 && !err && shown.length === 0 && (
        <p style={{ opacity: 0.7 }}>Пулов не найдено{hiddenCount > 0 ? ` (скрыто фильтрами: ${hiddenCount})` : ''}.</p>
      )}

      {q.length >= 2 && shown.length > 0 && (
        <PoolTable
          rows={shown}
          getKey={p => `${p.network}:${p.address}`}
          showAge
          onRowClick={add}
          isDisabled={p => favSet.has(`${p.network}:${p.address}`) || addingKey === p.address}
          markDisabled
        />
      )}
    </div>
  );
}

const input = { width: '100%', padding: '10px 36px 10px 12px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box', fontSize: 16 };
const clearBtn = { position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, border: 'none', background: 'none', color: 'var(--text-dim)', fontSize: 22, cursor: 'pointer' };
const chip = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, border: '1px solid #000', background: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 15 };
const chipActive = { ...chip, background: 'var(--input-bg)', fontWeight: 600 };
const coinChip = { padding: '8px 14px', borderRadius: 999, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer', fontSize: 16, fontWeight: 600 };
const sortChip = { padding: '5px 12px', borderRadius: 999, border: '1px solid var(--input-border)', background: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14 };
const sortChipActive = { ...sortChip, borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 };
const checkLabel = { display: 'flex', alignItems: 'center', gap: 8 };
const checkBox = { width: 18, height: 18 };
