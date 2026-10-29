'use client';
import { useEffect, useRef, useState } from 'react';
import NetworkBadge from './NetworkBadge';
import PoolTable from './PoolTable';
import { NETWORKS, networkFor } from '../lib/networks';
import { fmtUsd } from '../lib/format';

// запрос с одним автоматическим повтором, если источник данных перегружен или недоступен
async function fetchJsonRetry(url) {
  let out;
  for (let i = 0; i < 2; i++) {
    const r = await fetch(url);
    const d = await r.json().catch(() => ({}));
    out = { r, d };
    if (r.ok || (r.status !== 502 && r.status !== 429)) return out;
    if (i === 0) await new Promise(res => setTimeout(res, r.status === 429 ? 3000 : 1500));
  }
  return out;
}

const MIN_VOL = 1000;  // «мёртвые» пулы: объём за 24ч меньше этого (или его нет) скрываем
const MIN_TVL = 10000; // «совсем мусор»: пулы с ликвидностью меньше этого скрываем
const SORTS = [['tvl', 'TVL'], ['apr', 'APR'], ['vol24', 'Объём']];

// favSet — множество "сеть:адрес" уже добавленных пулов; onAdded() — после успешного добавления;
// onActiveChange(bool) — сообщает странице, что идёт поиск (чтобы спрятать избранное)
export default function PoolSearch({ favSet, onAdded, onActiveChange }) {
  const [nets, setNets] = useState(['bsc']); // выбранные сети (можно несколько); при открытии — BNB Chain
  const [failed, setFailed] = useState([]);
  const [query, setQuery] = useState('');   // Актив 1
  const [query2, setQuery2] = useState(''); // Актив 2 (необязательно)
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [sort, setSort] = useState('vol24'); // при открытии — по объёму
  const [hideSmall, setHideSmall] = useState(true);
  const [stableOnly, setStableOnly] = useState(false);
  const [hideDead, setHideDead] = useState(false);
  const [defaults, setDefaults] = useState({}); // пары по умолчанию: { сеть: [пулы] }
  const [defLoading, setDefLoading] = useState(false);
  const [retryTick, setRetryTick] = useState(0); // «Повторить» запускает поиск и основные пары заново
  const [defFailed, setDefFailed] = useState([]);
  const [recent, setRecent] = useState([]);
  const [addingKey, setAddingKey] = useState(null);
  const reqId = useRef(0);
  const inputRef = useRef(null);
  const input2Ref = useRef(null);

  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem('poolRecentAll') || '[]')); } catch { setRecent([]); }
  }, []);

  const t1 = query.trim(), t2 = query2.trim();
  const q = t1 || t2;           // основной актив поиска
  const qb = t1 && t2.length >= 2 ? t2 : ''; // второй актив (если задан первый; от 2 символов)
  useEffect(() => { onActiveChange && onActiveChange(q.length > 0); }, [q.length > 0]);

  // поиск с задержкой; по каждой выбранной сети запрос идёт отдельно, результаты склеиваются
  const netsKey = nets.join(',');
  // пары по умолчанию: пока поиск пуст, для каждой выбранной сети подгружаем 2 пула
  useEffect(() => {
    if (q) return;
    const need = nets.filter(n => !defaults[n]);
    if (need.length === 0) { setDefFailed([]); return; }
    let alive = true;
    setDefLoading(true);
    fetchJsonRetry(`/api/pool-defaults?networks=${need.join(',')}`)
      .then(({ d }) => {
        if (!alive) return;
        setDefaults(prev => ({ ...prev, ...(d.results || {}) }));
        setDefFailed(d.failed || (d.results ? [] : need));
      })
      .catch(() => { if (alive) setDefFailed(need); })
      .finally(() => { if (alive) setDefLoading(false); });
    return () => { alive = false; };
  }, [q, netsKey, retryTick]);
  useEffect(() => {
    setErr('');
    setFailed([]);
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      const settled = await Promise.allSettled(nets.map(async (net) => {
        const { r, d } = await fetchJsonRetry(`/api/pool-search?network=${net}&q=${encodeURIComponent(q)}${qb ? `&q2=${encodeURIComponent(qb)}` : ''}`);
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
  }, [q, qb, netsKey, retryTick]);

  // клик по сети включает/выключает её; хотя бы одна всегда остаётся выбранной
  function toggleNetwork(k) {
    const next = nets.includes(k) ? nets.filter(x => x !== k) : [...nets, k];
    if (next.length === 0) return;
    const ordered = NETWORKS.map(n => n.key).filter(x => next.includes(x));
    setNets(ordered);
  }
  function pickSort(k) {
    setSort(k);
  }
  function rememberCoin(coin) {
    setRecent(prev => {
      const list = [coin, ...prev.filter(x => x.toUpperCase() !== coin.toUpperCase())].slice(0, 4);
      try { localStorage.setItem('poolRecentAll', JSON.stringify(list)); } catch {}
      return list;
    });
  }
  function swapAssets() { setQuery(query2); setQuery2(query); }
  function pickQuick(c) {
    if (!query.trim()) setQuery(c); else if (!query2.trim()) setQuery2(c); else setQuery(c);
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
    [t1, t2].filter(x => x && x.length < 30).reverse().forEach(rememberCoin);
    setQuery('');
    setQuery2('');
    onAdded && onAdded();
  }

  const base = results.filter(p => (!hideSmall || (p.tvl || 0) >= MIN_TVL) && (!stableOnly || p.hasStable));
  const isDead = (p) => !(p.vol24 >= MIN_VOL);
  const deadCount = base.filter(isDead).length;
  let shown = hideDead ? base.filter(p => !isDead(p)) : base;
  shown = [...shown].sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1));
  const hiddenCount = results.length - shown.length;

  const defRows = nets.flatMap(n => defaults[n] || []);

  const quick = [...new Set([...recent, ...nets.flatMap(k => networkFor(k).quick || [])])].slice(0, 8);

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="net-row" role="group" aria-label="Сети">
        {NETWORKS.map(n => (
          <button key={n.key} type="button" className="net-chip" onClick={() => toggleNetwork(n.key)} aria-pressed={nets.includes(n.key)} aria-label={n.label} title={n.label}>
            <NetworkBadge network={n.key} size="md" />
            <span className="net-label">{n.label}</span>
          </button>
        ))}
      </div>

      <div className="pool-top">
        <div className="pool-sort" role="group" aria-label="Сортировка">
          <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>Сортировка:</span>
          {SORTS.map(([k, t]) => (
            <button key={k} type="button" className="pool-sort-chip" aria-pressed={sort === k} onClick={() => pickSort(k)}>{t}</button>
          ))}
        </div>
        <div className="pool-fields">
          <div className="pool-field">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Актив 1"
              aria-label="Актив 1: тикер или адрес токена"
              autoComplete="off"
              autoCapitalize="characters"
              style={input}
            />
            {query && <button type="button" className="pool-clear" onClick={() => setQuery('')} aria-label="Очистить актив 1">×</button>}
          </div>
          <button type="button" className="pool-swap" onClick={swapAssets} aria-label="Поменять активы местами" title="Поменять местами">⇄</button>
          <div className="pool-field">
            <input
              ref={input2Ref}
              value={query2}
              onChange={e => setQuery2(e.target.value)}
              placeholder="Актив 2"
              aria-label="Актив 2 (необязательно): тикер или адрес токена"
              autoComplete="off"
              autoCapitalize="characters"
              style={input}
            />
            {query2 && <button type="button" className="pool-clear" onClick={() => setQuery2('')} aria-label="Очистить актив 2">×</button>}
          </div>
        </div>
      </div>

      {!q && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {quick.map(c => (
            <button key={c} type="button" onClick={() => pickQuick(c)} style={coinChip}>{c}</button>
          ))}
        </div>
      )}

      {q && (
        <div className="pool-filters">
          <label className="filter-chip">
            <input type="checkbox" checked={stableOnly} onChange={e => setStableOnly(e.target.checked)} />
            Только со стейблом
          </label>
          <div className="pool-filters-right">
            <label className="filter-chip" title={`Скрыть пулы с TVL меньше ${fmtUsd(MIN_TVL)}`}>
              <input type="checkbox" checked={hideSmall} onChange={e => setHideSmall(e.target.checked)} />
              Скрыть мелкие
            </label>
            <label className="filter-chip" title={`Скрыть пулы с объёмом за 24ч меньше ${fmtUsd(MIN_VOL)}`}>
              <input type="checkbox" checked={hideDead} onChange={e => setHideDead(e.target.checked)} />
              Без объёма{hideDead && deadCount > 0 ? ` (${deadCount})` : ''}
            </label>
          </div>
        </div>
      )}

      {!q && defRows.length > 0 && (
        <>
          <div style={{ fontSize: 14, color: 'var(--text-dim)', margin: '14px 0 2px' }}>Основные пары</div>
          <PoolTable
            rows={defRows}
            getKey={p => `${p.network}:${p.address}`}
            showAge
            onRowClick={add}
            isDisabled={p => favSet.has(`${p.network}:${p.address}`) || addingKey === p.address}
            markDisabled
          />
        </>
      )}
      {!q && defLoading && defRows.length === 0 && <p style={{ opacity: 0.7 }}>Загружаю основные пары…</p>}
      {!q && !defLoading && defFailed.length > 0 && (
        <p style={{ opacity: 0.8, fontSize: 14 }}>Не загрузились: {defFailed.map(k => networkFor(k).label).join(', ')}. <button type="button" className="pool-retry" onClick={() => setRetryTick(t => t + 1)}>Повторить</button></p>
      )}
      {err && (
        <p style={{ color: 'var(--danger)' }}>{err} <button type="button" className="pool-retry" onClick={() => setRetryTick(t => t + 1)}>Повторить</button></p>
      )}
      {loading && <p style={{ opacity: 0.7 }}>Ищу…</p>}
      {!loading && failed.length > 0 && <p style={{ opacity: 0.8, fontSize: 14 }}>Не ответили: {failed.map(k => networkFor(k).label).join(', ')}. <button type="button" className="pool-retry" onClick={() => setRetryTick(t => t + 1)}>Повторить</button></p>}
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
const coinChip = { padding: '8px 14px', borderRadius: 999, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer', fontSize: 16, fontWeight: 600 };
