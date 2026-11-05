'use client';
import { useT } from './LangProvider';
import { useEffect, useMemo, useState } from 'react';
import CoinIcon from './CoinIcon';

const API = 'https://crypto-api.olegsh247.workers.dev';
const MAX_SHOWN = 100;

// Окно добавления монет: поиск по топ-500 CoinGecko + монеты старого списка. Остаётся открытым — можно набрать несколько подряд.
export default function AddAssetModal({ onClose, onChange }) {
  const t = useT();
  const [coins, setCoins] = useState([]);
  const [worker, setWorker] = useState([]);
  const [tracked, setTracked] = useState([]);
  const [meta, setMeta] = useState({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('cryptoTrackedAssets') || '[]');
      setTracked(Array.isArray(saved) ? saved : []);
      setMeta(JSON.parse(localStorage.getItem('cryptoTrackedMeta') || '{}') || {});
    } catch {}
    Promise.allSettled([
      fetch('/api/coin-list').then(r => r.json()),
      fetch(`${API}/api/assets`).then(r => r.json()),
    ]).then(([c, w]) => {
      const cl = c.status === 'fulfilled' ? c.value.coins || [] : [];
      const wl = w.status === 'fulfilled' ? w.value.assets || [] : [];
      setCoins(cl);
      setWorker(wl);
      if (cl.length === 0 && wl.length === 0) setError(t('Не удалось загрузить список монет. Попробуйте позже.'));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const all = useMemo(() => {
    const byWorkerSym = new Map(worker.map(a => [String(a.symbol).toUpperCase(), a]));
    const list = coins.map(c => {
      const w = byWorkerSym.get(c.symbol);
      return { key: w ? w.asset_id : c.id, symbol: c.symbol, name: c.name, rank: c.rank };
    });
    const have = new Set(list.map(x => x.key));
    for (const a of worker) if (!have.has(a.asset_id)) list.push({ key: a.asset_id, symbol: String(a.symbol).toUpperCase(), name: a.name, rank: null });
    return list;
  }, [coins, worker]);

  function add(item) {
    if (tracked.includes(item.key)) return;
    const nextMeta = /^(cg|pp):/.test(item.key) ? { ...meta, [item.key]: { symbol: item.symbol, name: item.name } } : meta;
    const next = [...tracked, item.key];
    setTracked(next);
    setMeta(nextMeta);
    try {
      localStorage.setItem('cryptoTrackedAssets', JSON.stringify(next));
      localStorage.setItem('cryptoTrackedMeta', JSON.stringify(nextMeta));
    } catch {}
    onChange && onChange();
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    const score = (x) => {
      const s = x.symbol.toLowerCase(), n = x.name.toLowerCase();
      if (s === q) return 0;
      if (s.startsWith(q)) return 1;
      if (n.startsWith(q)) return 2;
      if (n.split(/[\s.\-_]+/).some(w => w.startsWith(q))) return 3;
      return 9;
    };
    return all.map(x => [score(x), x]).filter(([sc]) => sc < 9)
      .sort((a, b) => a[0] - b[0] || (a[1].rank ?? 1e9) - (b[1].rank ?? 1e9))
      .map(([, x]) => x);
  }, [all, query]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label={t('Добавить монету')}>
        <div className="modal-head">
          <h2>{t('Добавить монету')}</h2>
          <span className="modal-sub">{t('топ-500 по капитализации')}</span>
          <button className="modal-close" onClick={onClose} aria-label={t('Закрыть')}>✕</button>
        </div>
        <input
          type="search" autoFocus value={query} onChange={e => setQuery(e.target.value)}
          placeholder={t('Тикер или название: B, BN, ETH…')} autoComplete="off" autoCapitalize="none" spellCheck={false}
          className="modal-search"
        />
        <div className="modal-count">
          {loading ? t('Загрузка списка…') : error ? '' : `${query.trim() ? t('Найдено') : t('Доступно')}: ${results.length}${results.length > MAX_SHOWN ? ' · ' + t('показаны первые {n}, уточните запрос', { n: MAX_SHOWN }) : ''}`}
        </div>
        <div className="modal-list">
          {error && <div className="modal-empty" style={{ color: 'var(--danger)' }}>{error}</div>}
          {!loading && !error && results.length === 0 && <div className="modal-empty">{t('Ничего не найдено.')}</div>}
          {results.slice(0, MAX_SHOWN).map(it => {
            const added = tracked.includes(it.key);
            return (
              <div key={it.key} className="modal-row">
                <CoinIcon symbol={it.symbol} size={30} />
                <div className="modal-coin">
                  <b>{it.symbol}</b>
                  <span>{it.name}</span>
                </div>
                <div className="modal-rank">{it.rank ? `#${it.rank}` : ''}</div>
                <button className={`modal-add${added ? ' done' : ''}`} onClick={() => add(it)} disabled={added}>{added ? t('✓ Добавлено') : t('+ Добавить')}</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
