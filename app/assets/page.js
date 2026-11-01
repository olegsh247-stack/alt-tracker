'use client';

import CoinIcon from '../../components/CoinIcon';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://crypto-api.olegsh247.workers.dev';
const MAX_SHOWN = 100;

// Ключ актива: если монета есть в старом списке (Crypto Universe) — его asset_id, иначе "cg:<id CoinGecko>".
export default function AssetsPage() {
  const router = useRouter();
  const [coins, setCoins] = useState([]);       // топ-500 CoinGecko
  const [worker, setWorker] = useState([]);     // старый список Crypto Universe
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
      if (cl.length === 0 && wl.length === 0) setError('Не удалось загрузить список монет. Попробуйте позже.');
    }).finally(() => setLoading(false));
  }, []);

  // единый список: монеты CoinGecko + монеты старого списка, которых в топ-500 нет
  const all = useMemo(() => {
    const byWorkerSym = new Map(worker.map(a => [String(a.symbol).toUpperCase(), a]));
    const list = coins.map(c => {
      const w = byWorkerSym.get(c.symbol);
      return { key: w ? w.asset_id : `cg:${c.id}`, symbol: c.symbol, name: c.name, rank: c.rank, cgId: c.id };
    });
    const have = new Set(list.map(x => x.key));
    for (const a of worker) if (!have.has(a.asset_id)) list.push({ key: a.asset_id, symbol: String(a.symbol).toUpperCase(), name: a.name, rank: null });
    return list;
  }, [coins, worker]);

  const info = (key) => all.find(x => x.key === key) || (meta[key] ? { key, symbol: meta[key].symbol, name: meta[key].name, rank: null } : null);

  function persist(next, nextMeta) {
    setTracked(next);
    setMeta(nextMeta);
    try {
      localStorage.setItem('cryptoTrackedAssets', JSON.stringify(next));
      localStorage.setItem('cryptoTrackedMeta', JSON.stringify(nextMeta));
    } catch {}
  }

  function toggle(item) {
    if (tracked.includes(item.key)) {
      persist(tracked.filter(id => id !== item.key), meta);
    } else {
      const nextMeta = item.key.startsWith('cg:') ? { ...meta, [item.key]: { symbol: item.symbol, name: item.name } } : meta;
      persist([...tracked, item.key], nextMeta);
    }
  }

  const mine = tracked.map(info).filter(Boolean);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = all.filter(x => !tracked.includes(x.key));
    if (!q) return items;
    const score = (x) => {
      const s = x.symbol.toLowerCase(), n = x.name.toLowerCase();
      if (s === q) return 0;
      if (s.startsWith(q)) return 1;
      if (n.startsWith(q)) return 2;
      if (n.split(/[\s.\-_]+/).some(w => w.startsWith(q))) return 3;
      return 9;
    };
    return items.map(x => [score(x), x]).filter(([sc]) => sc < 9)
      .sort((a, b) => a[0] - b[0] || (a[1].rank ?? 1e9) - (b[1].rank ?? 1e9))
      .map(([, x]) => x);
  }, [all, tracked, query]);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={header}>
        <button onClick={() => router.push('/?tab=assets')} style={backBtn}>← Assets</button>
        <h1 style={{ margin: 0, fontSize: 26 }}>Активы</h1>
      </div>

      {loading && <p>Загрузка списка…</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {!loading && !error && (
        <>
          <section style={section}>
            <div style={sectionTitle}>
              <h2 style={h2}>Мои активы</h2>
              <span style={count}>{mine.length}</span>
            </div>
            {mine.length === 0 ? (
              <div style={empty}>Пока ничего не добавлено. Найдите монету ниже.</div>
            ) : mine.map(it => <AssetRow key={it.key} item={it} added onToggle={() => toggle(it)} />)}
          </section>

          <section style={section}>
            <div style={sectionTitle}>
              <h2 style={h2}>Добавить монету</h2>
              <span style={count}>топ-500 по капитализации</span>
            </div>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Тикер или название: B, BN, ETH…"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              style={input}
            />
            <div style={{ color: 'var(--text-dim)', fontSize: 13, margin: '6px 2px 4px' }}>
              {query.trim() ? `Найдено: ${results.length}` : `Доступно: ${results.length}`}{results.length > MAX_SHOWN ? ` · показаны первые ${MAX_SHOWN}, уточните запрос` : ''}
            </div>
            {results.slice(0, MAX_SHOWN).map(it => <AssetRow key={it.key} item={it} onToggle={() => toggle(it)} />)}
            {results.length === 0 && <div style={empty}>Ничего не найдено.</div>}
          </section>
        </>
      )}
    </div>
  );
}

function AssetRow({ item, added, onToggle }) {
  return (
    <div style={row}>
      <CoinIcon symbol={item.symbol} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700 }}>{item.symbol}</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
      </div>
      <div style={rankStyle}>{item.rank ? `#${item.rank}` : ''}</div>
      <button onClick={onToggle} style={added ? addedBtn : addBtn}>{added ? '✓ Добавлено' : '+ Добавить'}</button>
    </div>
  );
}

const header = { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 };
const backBtn = { border: '1px solid var(--input-border)', background: 'none', color: 'var(--text)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' };
const section = { marginTop: 24 };
const sectionTitle = { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 };
const h2 = { margin: 0, fontSize: 18 };
const count = { color: 'var(--text-dim)', fontSize: 14 };
const empty = { padding: 18, border: '1px dashed var(--card-border)', borderRadius: 10, color: 'var(--text-dim)' };
const input = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', fontSize: 16, borderRadius: 8, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)' };
const row = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: '1px solid var(--card-border)' };
const rankStyle = { minWidth: 44, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-dim)', fontSize: 14 };
const addBtn = { border: '1px solid var(--up)', background: 'none', color: 'var(--up)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' };
const addedBtn = { border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-dim)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', whiteSpace: 'nowrap' };
