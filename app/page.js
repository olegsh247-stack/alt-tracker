'use client';
import { useEffect, useRef, useState } from 'react';
import ThemeToggle from '../components/ThemeToggle';
import PriceValue from '../components/PriceValue';
import { shortTickerFor, enLabelFor } from '../lib/commodities';
import PoolSearch from '../components/PoolSearch';
import PoolTable from '../components/PoolTable';
import TvChart from '../components/TvChart';
import NewsFeed from '../components/NewsFeed';
import Logo from '../components/Logo';

function icon(asset) {
  return `https://assets.coincap.io/assets/icons/${asset.toLowerCase()}@2x.png`;
}

export default function HomePage() {
  const [login, setLogin] = useState('');
  const [tab, setTab] = useState('assets');
  const [loading, setLoading] = useState(true);

  // При первой загрузке — вкладка из ссылки (?tab=...), иначе последняя использованная, иначе Crypto
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('tab');
    const fromStorage = localStorage.getItem('activeTab');
    const raw = fromUrl || fromStorage || 'assets';
    const normalized = raw === 'crypto' ? 'pair' : raw === 'dex' ? 'pool' : raw;
    setTab(normalized);
  }, []);

  function changeTab(next) {
    setTab(next);
    setSortMenuOpen(false);
    localStorage.setItem('activeTab', next);
  }

  // --- Crypto ---
  const [pairs, setPairs] = useState([]);
  const [prices, setPrices] = useState({});
  const [sparks, setSparks] = useState({});
  const [swappingId, setSwappingId] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [sortDir, setSortDir] = useState(null); // null | 'alpha_asc' | 'alpha_desc' | 'pct_asc' | 'pct_desc'
  const [assets, setAssets] = useState([]);
  const [assetDetails, setAssetDetails] = useState({});
  const [assetSelectMode, setAssetSelectMode] = useState(false);
  const [assetSelected, setAssetSelected] = useState(new Set());
  const [assetDeleting, setAssetDeleting] = useState(false);

  // --- Commodities ---
  const [cPairs, setCPairs] = useState([]);
  const [cPrices, setCPrices] = useState({});
  const [cSparks, setCSparks] = useState({});
  const [cSwappingId, setCSwappingId] = useState(null);
  const [cSelectMode, setCSelectMode] = useState(false);
  const [cSelected, setCSelected] = useState(new Set());
  const [cDeleting, setCDeleting] = useState(false);
  const [cSortDir, setCSortDir] = useState(null);

  // --- Pool (избранные пулы ликвидности) ---
  const [poolFavs, setPoolFavs] = useState([]);
  const [poolLoaded, setPoolLoaded] = useState(false);
  const [poolStatsError, setPoolStatsError] = useState(false);
  const [poolSelectMode, setPoolSelectMode] = useState(false);
  const [poolSelected, setPoolSelected] = useState(new Set());
  const [poolDeleting, setPoolDeleting] = useState(false);
  const [poolSearching, setPoolSearching] = useState(false);

  async function loadPools() {
    try {
      const r = await fetch('/api/pool-favorites');
      const d = await r.json();
      if (r.ok) { setPoolFavs(d.pools || []); setPoolStatsError(!!d.statsError); }
    } catch {}
    setPoolLoaded(true);
  }
  useEffect(() => {
    if (tab !== 'pool') return;
    loadPools();
    const t = setInterval(loadPools, 30000);
    return () => clearInterval(t);
  }, [tab]);

  function togglePoolSelectMode() { setPoolSelectMode(v => !v); setPoolSelected(new Set()); }
  function togglePoolSelected(id) { setPoolSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  async function confirmDeletePools() {
    if (poolSelected.size === 0) { setPoolSelectMode(false); return; }
    if (!confirm(`Удалить выбранные пулы (${poolSelected.size})?`)) return;
    setPoolDeleting(true);
    await Promise.all([...poolSelected].map(id => fetch(`/api/pool-favorites/${id}`, { method: 'DELETE' })));
    setPoolFavs(prev => prev.filter(f => !poolSelected.has(f.id)));
    setPoolSelected(new Set());
    setPoolSelectMode(false);
    setPoolDeleting(false);
  }

  // --- Меню сортировки ---
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef(null);
  useEffect(() => {
    try {
      const fix = (v) => (v === 'asc' || v === 'desc' ? `pct_${v}` : v || null);
      setSortDir(fix(localStorage.getItem('pairSortDir')));
      setCSortDir(fix(localStorage.getItem('commoditySortDir')));
    } catch {}
  }, []);
  useEffect(() => {
    function onDown(e) { if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) setSortMenuOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); };
  }, []);

  async function loadAssets() {
    try {
      const tracked = JSON.parse(localStorage.getItem('cryptoTrackedAssets') || '[]');
      const r = await fetch('https://crypto-api.olegsh247.workers.dev/api/assets');
      const d = await r.json();
      const all = d.assets || [];
      const mine = tracked.map(id => all.find(a => a.asset_id === id)).filter(Boolean);
      setAssets(mine);
      const rows = await Promise.all(mine.map(async asset => {
        try {
          const rr = await fetch(`https://crypto-api.olegsh247.workers.dev/api/assets/${asset.asset_id}`);
          return [asset.asset_id, rr.ok ? await rr.json() : null];
        } catch { return [asset.asset_id, null]; }
      }));
      setAssetDetails(Object.fromEntries(rows));
    } catch {
      setAssets([]);
    }
  }

  function toggleAssetSelect(id) {
    setAssetSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function confirmDeleteAssets() {
    if (assetSelected.size === 0) {
      setAssetSelectMode(false);
      return;
    }
    if (!confirm(`Удалить выбранные активы (${assetSelected.size})?`)) return;
    setAssetDeleting(true);
    const tracked = JSON.parse(localStorage.getItem('cryptoTrackedAssets') || '[]');
    const next = tracked.filter(id => !assetSelected.has(id));
    localStorage.setItem('cryptoTrackedAssets', JSON.stringify(next));
    setAssets(prev => prev.filter(a => !assetSelected.has(a.asset_id)));
    setAssetSelected(new Set());
    setAssetSelectMode(false);
    setAssetDeleting(false);
  }

  async function load() {
    const [pRes, priceRes, sparkRes, meRes, cpRes, cPriceRes, cSparkRes] = await Promise.all([
      fetch('/api/pairs').then(r => r.json()),
      fetch('/api/prices').then(r => r.json()),
      fetch('/api/sparkline').then(r => r.json()),
      fetch('/api/me').then(r => r.json()),
      fetch('/api/commodities').then(r => r.json()),
      fetch('/api/commodity-prices').then(r => r.json()),
      fetch('/api/commodity-sparkline').then(r => r.json()),
    ]);
    setPairs(pRes.pairs || []);
    const map = {};
    (priceRes.prices || []).forEach(p => { map[p.id] = p; });
    setPrices(map);
    const smap = {};
    (sparkRes.sparklines || []).forEach(s => { smap[s.id] = s; });
    setSparks(smap);
    if (meRes.login) setLogin(meRes.login);

    setCPairs(cpRes.pairs || []);
    const cmap = {};
    (cPriceRes.prices || []).forEach(p => { cmap[p.id] = p; });
    setCPrices(cmap);
    const csmap = {};
    (cSparkRes.sparklines || []).forEach(s => { csmap[s.id] = s; });
    setCSparks(csmap);

    await loadAssets();
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  // --- Crypto handlers ---
  async function swapPair(e, id) {
    e.preventDefault();
    e.stopPropagation();
    setSwappingId(id);
    const r = await fetch(`/api/pairs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ swap: true }) });
    if (r.ok) await load();
    setSwappingId(null);
  }
  function toggleSelectMode() { setSelectMode(v => !v); setSelected(new Set()); }
  function toggleSelected(id) { setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  function onRowClick(e, id) { if (!selectMode) return; e.preventDefault(); toggleSelected(id); }
  async function confirmDeleteSelected() {
    if (selected.size === 0) { setSelectMode(false); return; }
    if (!confirm(`Удалить выбранные пары (${selected.size})?`)) return;
    setDeleting(true);
    await Promise.all([...selected].map(id => fetch(`/api/pairs/${id}`, { method: 'DELETE' })));
    setPairs(prev => prev.filter(p => !selected.has(p.id)));
    setSelected(new Set());
    setSelectMode(false);
    setDeleting(false);
  }

  // --- Commodity handlers (то же самое, но на /api/commodities) ---
  async function cSwapPair(e, id) {
    e.preventDefault();
    e.stopPropagation();
    setCSwappingId(id);
    const r = await fetch(`/api/commodities/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ swap: true }) });
    if (r.ok) await load();
    setCSwappingId(null);
  }
  function cToggleSelectMode() { setCSelectMode(v => !v); setCSelected(new Set()); }
  function cToggleSelected(id) { setCSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  function cOnRowClick(e, id) { if (!cSelectMode) return; e.preventDefault(); cToggleSelected(id); }
  async function cConfirmDeleteSelected() {
    if (cSelected.size === 0) { setCSelectMode(false); return; }
    if (!confirm(`Удалить выбранные пары (${cSelected.size})?`)) return;
    setCDeleting(true);
    await Promise.all([...cSelected].map(id => fetch(`/api/commodities/${id}`, { method: 'DELETE' })));
    setCPairs(prev => prev.filter(p => !cSelected.has(p.id)));
    setCSelected(new Set());
    setCSelectMode(false);
    setCDeleting(false);
  }

  // ───── графики справа (только вкладка Spot): монеты выбранной пары, по умолчанию BTC и ETH ─────
  const [chartPairId, setChartPairId] = useState(null);
  useEffect(() => { try { const v = localStorage.getItem('chartPairId'); if (v) setChartPairId(v); } catch {} }, []);
  function pickChartPair(id) {
    setChartPairId(String(id));
    try { localStorage.setItem('chartPairId', String(id)); } catch {}
    if (typeof window !== 'undefined' && window.innerWidth < 1200) {
      setTimeout(() => document.querySelector('.side-chart')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }
  const TV_PREFIX = { BINANCE: 'BINANCE', BYBIT: 'BYBIT', OKX: 'OKX', GATE: 'GATEIO', MEXC: 'MEXC' };
  const STABLE_COINS = new Set(['USDT', 'USDC', 'USD', 'DAI', 'FDUSD', 'BUSD', 'TUSD']);
  function chartSymbolsFor(pair) {
    if (!pair) return ['BINANCE:BTCUSDT', 'BINANCE:ETHUSDT'];
    const out = [];
    [[pair.asset1, pair.exchange1], [pair.asset2, pair.exchange2]].forEach(([a, ex]) => {
      const coin = String(a || '').toUpperCase();
      if (!coin || STABLE_COINS.has(coin)) return;
      const sym = `${TV_PREFIX[String(ex || '').toUpperCase()] || 'BINANCE'}:${coin}USDT`;
      if (!out.includes(sym)) out.push(sym);
    });
    return out.length ? out : ['BINANCE:BTCUSDT', 'BINANCE:ETHUSDT'];
  }
  const chartPair = pairs.find(p => String(p.id) === chartPairId) || null;
  const chartSymbols = chartSymbolsFor(chartPair);

  const isAssets = tab === 'assets';
  const isPair = tab === 'pair';
  const isCommodities = tab === 'commodities';
  const isPool = tab === 'pool';
  const isCrypto = isPair;
  const curSelectMode = isPool ? poolSelectMode : isAssets ? assetSelectMode : (isCrypto ? selectMode : cSelectMode);
  const curSelected = isPool ? poolSelected : isAssets ? assetSelected : (isCrypto ? selected : cSelected);
  const curDeleting = isPool ? poolDeleting : isAssets ? assetDeleting : (isCrypto ? deleting : cDeleting);
  const curPairs = isPool ? poolFavs : isAssets ? assets : (isCrypto ? pairs : cPairs);
  const curToggleSelectMode = isPool ? togglePoolSelectMode : isAssets ? (() => { setAssetSelectMode(v => !v); setAssetSelected(new Set()); }) : (isCrypto ? toggleSelectMode : cToggleSelectMode);
  const curSortDir = isCrypto ? sortDir : cSortDir;
  function chooseSort(dir) {
    // повторный выбор того же пункта возвращает исходный порядок
    const next = curSortDir === dir ? null : dir;
    const key = isCrypto ? 'pairSortDir' : 'commoditySortDir';
    (isCrypto ? setSortDir : setCSortDir)(next);
    try { next ? localStorage.setItem(key, next) : localStorage.removeItem(key); } catch {}
    setSortMenuOpen(false);
  }
  function sortList(list, sparksMap, mode, nameOf) {
    if (!mode) return list;
    const [kind, dir] = mode.split('_');
    const sign = dir === 'asc' ? 1 : -1;
    if (kind === 'alpha') {
      return [...list].sort((a, b) => sign * nameOf(a).localeCompare(nameOf(b), 'en', { sensitivity: 'base' }));
    }
    const val = (p) => sparksMap[p.id]?.changePct;
    return [...list].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;   // без данных — всегда внизу
      if (vb == null) return -1;
      return sign * (va - vb);
    });
  }
  const displayPairs = sortList(pairs, sparks, sortDir, p => `${p.asset1}/${p.asset2}`);
  const displayCPairs = sortList(cPairs, cSparks, cSortDir, p => `${enLabelFor(p.asset1)}/${enLabelFor(p.asset2)}`);
  const curConfirmDelete = isPool ? confirmDeletePools : isAssets ? confirmDeleteAssets : (isCrypto ? confirmDeleteSelected : cConfirmDeleteSelected);

  return (
    <div className="app-shell">
    <div className="page-wrap" style={{ maxWidth: 860, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={28} />
          <span className="header-login" style={{ color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>{login || '\u00A0'}</span>
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {!curSelectMode ? (
            <>
              <ThemeToggle />
              <a href="/account" style={{ ...sortModeBtn, textDecoration: 'none' }} title="Аккаунт и восстановление доступа" aria-label="Аккаунт">⚙</a>
              {!isPool && <a href={isAssets ? '/assets' : isCrypto ? '/add' : '/add-commodity'} style={plusBtn} title={isAssets ? 'Добавить актив' : isCrypto ? 'Добавить пару' : 'Добавить commodity'}>+</a>}
              {curPairs.length > 0 && <button onClick={curToggleSelectMode} style={deleteModeBtn} title="Удалить">–</button>}
              {!isAssets && !isPool && curPairs.length > 1 && (
                <div ref={sortMenuRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setSortMenuOpen(v => !v)}
                    style={{ ...sortModeBtn, ...(curSortDir ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}
                    title="Сортировка"
                  >⇅</button>
                  {sortMenuOpen && (
                    <div style={sortMenu}>
                      <div style={sortHead}>По алфавиту</div>
                      {[['alpha_asc', 'A → Z'], ['alpha_desc', 'Z → A']].map(([k, t]) => (
                        <button key={k} onClick={() => chooseSort(k)} style={sortItem}>
                          <span>{t}</span>{curSortDir === k && <span style={{ color: 'var(--accent)' }}>✓</span>}
                        </button>
                      ))}
                      <div style={sortHead}>По изменению за 24ч</div>
                      {[['pct_asc', 'По возрастанию'], ['pct_desc', 'По убыванию']].map(([k, t], idx) => (
                        <button key={k} onClick={() => chooseSort(k)} style={{ ...sortItem, ...(idx === 1 ? { borderBottom: 'none' } : {}) }}>
                          <span>{t}</span>{curSortDir === k && <span style={{ color: 'var(--accent)' }}>✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button onClick={logout} style={logoutBtn}>Выйти</button>
            </>
          ) : (
            <>
              <button onClick={curToggleSelectMode} style={logoutBtn}>Отмена</button>
              <button onClick={curConfirmDelete} disabled={curDeleting} style={confirmDeleteBtn}>
                {curDeleting ? '...' : `Удалить (${curSelected.size})`}
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button onClick={() => changeTab('assets')} style={tab === 'assets' ? tabActive : tabInactive}>Assets</button>
        <button onClick={() => changeTab('pair')} style={tab === 'pair' ? tabActive : tabInactive}>Spot</button>
        <button onClick={() => changeTab('pool')} style={tab === 'pool' ? tabActive : tabInactive}>Pool</button>
        <button onClick={() => changeTab('commodities')} style={tab === 'commodities' ? tabActive : tabInactive}>Commodities</button>
      </div>

      {loading && <p>Загрузка...</p>}

      {isPool && (
        <PoolSearch
          favSet={new Set(poolFavs.map(f => `${f.network}:${f.address}`))}
          onAdded={loadPools}
          onActiveChange={setPoolSearching}
        />
      )}
      {isPool && !poolSearching && poolFavs.length > 0 && <div style={{ fontSize: 14, color: 'var(--text-dim)', margin: '4px 0 2px' }}>Избранное</div>}
      {isPool && !poolSearching && poolLoaded && poolFavs.length === 0 && <p style={{ opacity: 0.7 }}>Избранных пулов пока нет — найдите пул по монете выше и добавьте его.</p>}
      {isPool && !poolSearching && poolStatsError && <p style={{ color: 'var(--danger)', fontSize: 14 }}>Часть данных не загрузилась — источник временно недоступен, обновится автоматически.</p>}
      {isPool && !poolSearching && poolFavs.length > 0 && (
        <PoolTable
          rows={poolFavs}
          showAge
          getKey={f => f.id}
          onRowClick={f => window.open(`https://www.geckoterminal.com/${f.network}/pools/${f.address}`, '_blank', 'noopener,noreferrer')}
          select={{ mode: poolSelectMode, selected: poolSelected, onToggle: f => togglePoolSelected(f.id) }}
        />
      )}

      {isAssets && !loading && assets.length === 0 && <p style={{ opacity: 0.7 }}>Активов пока нет — нажмите "+", чтобы добавить первый.</p>}
      {isAssets && !loading && assets.map((asset) => {
        const metrics = assetDetails[asset.asset_id]?.metrics || [];
        const m = metrics.find(x => x.metric_id === 'market.spot_price');
        const price = m?.value;
        const isSelected = assetSelected.has(asset.asset_id);
        return (
          <div key={asset.asset_id} className="pair-row" style={{ ...row, background: isSelected ? 'var(--danger-bg)' : 'transparent' }} onClick={() => assetSelectMode && toggleAssetSelect(asset.asset_id)}>
            {assetSelectMode && <input type="checkbox" checked={isSelected} onChange={() => toggleAssetSelect(asset.asset_id)} onClick={e => e.stopPropagation()} style={{ width: 18, height: 18 }} />}
            <img src={icon(asset.symbol)} width={28} height={28} alt="" onError={e => e.currentTarget.style.visibility='hidden'} />
            <div style={{ minWidth: 90, fontWeight: 700 }}>{asset.symbol}</div>
            <div style={{ flex: 1, color: 'var(--text-dim)' }}>{asset.name}</div>
            <div style={cell}>{price == null ? '—' : Number(price).toLocaleString('en-US', { maximumFractionDigits: price >= 1000 ? 2 : price >= 1 ? 4 : 8 })}</div>
          </div>
        );
      })}

      {isCrypto && !loading && pairs.length === 0 && <p style={{ opacity: 0.7 }}>Пар пока нет — нажмите "+", чтобы добавить первую.</p>}
      {isCrypto && displayPairs.map((p) => {
        const price = prices[p.id];
        const spark = sparks[p.id];
        const pct = spark?.changePct;
        const pctColor = pct == null ? 'var(--text-dim)' : pct >= 0 ? 'var(--up)' : 'var(--down)';
        const isSelected = selected.has(p.id);
        return (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            className={`pair-row pair-grid${selectMode ? ' sort-active' : ''}`}
            style={{ ...row, cursor: 'pointer', background: isSelected ? 'var(--danger-bg)' : String(p.id) === chartPairId ? 'var(--input-bg)' : 'transparent' }}
            onClick={(e) => { if (selectMode) onRowClick(e, p.id); else pickChartPair(p.id); }}
            onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (selectMode) toggleSelected(p.id); else pickChartPair(p.id); } }}
          >
            {selectMode && (
              <input type="checkbox" checked={isSelected} onChange={() => toggleSelected(p.id)} onClick={(e) => e.stopPropagation()} className="cell-order" style={{ width: 18, height: 18 }} />
            )}
            <div className="cell-icons" style={{ display: 'flex', gap: 4 }}>
              <img className="pair-icon" src={icon(p.asset1)} width={24} height={24} onError={e => e.target.style.visibility = 'hidden'} />
              <img className="pair-icon" src={icon(p.asset2)} width={24} height={24} onError={e => e.target.style.visibility = 'hidden'} />
            </div>
            <div className="cell-name" style={{ minWidth: 90 }}>{p.asset1}/<wbr />{p.asset2}{!selectMode && <a href={`/pair/${p.id}`} className="open-pair" title="Открыть страницу пары" aria-label="Открыть страницу пары" onClick={(e) => e.stopPropagation()}>↗</a>}</div>
            {!selectMode && (
              <button onClick={(e) => swapPair(e, p.id)} disabled={swappingId === p.id} className="cell-swap" style={swapBtn} title="Поменять местами">
                {swappingId === p.id ? '…' : '⇄'}
              </button>
            )}
            <div className="cell-exchange" style={{ opacity: 0.6, fontSize: 14, minWidth: 90, textTransform: 'lowercase' }}>{p.exchange1}/<wbr />{p.exchange2}</div>
            <div className="cell-price" style={cell}><PriceValue value={price?.price1} /></div>
            <div className="cell-price second" style={cell}><PriceValue value={price?.price2} /></div>
            <div className="cell-ratio" style={{ ...cell, fontWeight: 600 }}>{price?.ratio ? price.ratio.toFixed(8) : '—'}</div>
            <div className="cell-pct" style={{ minWidth: 56, textAlign: 'right', fontWeight: 600, fontSize: 16, color: pctColor }}>
              {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%` : '—'}
            </div>
          </div>
        );
      })}

      {isCommodities && !loading && cPairs.length === 0 && <p style={{ opacity: 0.7 }}>Пар пока нет — нажмите "+", чтобы добавить первую.</p>}
      {isCommodities && displayCPairs.map((p) => {
        const price = cPrices[p.id];
        const spark = cSparks[p.id];
        const pct = spark?.changePct;
        const pctColor = pct == null ? 'var(--text-dim)' : pct >= 0 ? 'var(--up)' : 'var(--down)';
        const isSelected = cSelected.has(p.id);
        return (
          <a
            key={p.id}
            href={`/commodity-pair/${p.id}`}
            className={`pair-row pair-grid${cSelectMode ? ' sort-active' : ''}`}
            style={{ ...row, background: isSelected ? 'var(--danger-bg)' : 'transparent' }}
            onClick={(e) => cOnRowClick(e, p.id)}
          >
            {cSelectMode && (
              <input type="checkbox" checked={isSelected} onChange={() => cToggleSelected(p.id)} onClick={(e) => e.stopPropagation()} className="cell-order" style={{ width: 18, height: 18 }} />
            )}
            <div className="cell-icons" style={{ display: 'flex', gap: 4 }}>
              <span className="commodity-icon">{shortTickerFor(p.asset1)}</span>
              <span className="commodity-icon">{shortTickerFor(p.asset2)}</span>
            </div>
            <div className="cell-name" style={{ minWidth: 90 }}>{enLabelFor(p.asset1)}/<wbr />{enLabelFor(p.asset2)}</div>
            {!cSelectMode && (
              <button onClick={(e) => cSwapPair(e, p.id)} disabled={cSwappingId === p.id} className="cell-swap" style={swapBtn} title="Поменять местами">
                {cSwappingId === p.id ? '…' : '⇄'}
              </button>
            )}
            <div className="cell-exchange" style={{ opacity: 0.6, fontSize: 14, minWidth: 90 }}></div>
            <div className="cell-price" style={cell}><PriceValue value={price?.price1} /></div>
            <div className="cell-price second" style={cell}><PriceValue value={price?.price2} /></div>
            <div className="cell-ratio" style={{ ...cell, fontWeight: 600 }}>{price?.ratio ? price.ratio.toFixed(8) : '—'}</div>
            <div className="cell-pct" style={{ minWidth: 56, textAlign: 'right', fontWeight: 600, fontSize: 16, color: pctColor }}>
              {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%` : '—'}
            </div>
          </a>
        );
      })}
    </div>
    <aside className="side-panel">
      {isCrypto && <section className="side-chart"><TvChart symbols={chartSymbols} /></section>}
      <section className="side-news"><div className="side-title">Новости</div><NewsFeed /></section>
    </aside>
    </div>
  );
}

const row = {
  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 6px', flexWrap: 'wrap',
  borderBottom: '1px solid var(--card-border)', textDecoration: 'none', color: 'var(--text)',
  borderRadius: 6,
};
const cell = { minWidth: 90, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const plusBtn = {
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--accent)', color: 'var(--on-accent)', borderRadius: 8, textDecoration: 'none', fontSize: 20,
};
const trashBtn = {
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--danger)', color: 'var(--on-danger)', border: 'none', borderRadius: 8, fontSize: 20, cursor: 'pointer',
};
const deleteModeBtn = trashBtn;
const sortModeBtn = {
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'none', border: '1px solid var(--input-border)', color: 'var(--text)', borderRadius: 8, fontSize: 18, cursor: 'pointer',
};
const sortMenu = {
  position: 'absolute', top: '100%', right: 0, marginTop: 6, minWidth: 220, zIndex: 30,
  background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 10,
  boxShadow: '0 8px 20px rgba(0,0,0,0.25)', overflow: 'hidden',
};
const sortHead = {
  padding: '8px 14px 4px', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5,
  color: 'var(--text-dim)', background: 'var(--bg)', borderBottom: '1px solid var(--card-border)',
};
const sortItem = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%',
  padding: '12px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--card-border)',
  color: 'var(--text)', fontSize: 16, textAlign: 'left', cursor: 'pointer',
};
const logoutBtn = { background: 'none', border: '1px solid var(--input-border)', color: 'var(--text-dim)', borderRadius: 8, padding: '0 12px' };
const confirmDeleteBtn = {
  background: 'var(--danger)', color: 'var(--on-danger)', border: 'none', borderRadius: 8, padding: '0 14px', fontWeight: 600, cursor: 'pointer',
};
const swapBtn = {
  width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'none', border: '1px solid var(--input-border)', color: 'var(--text-dim)',
  borderRadius: 6, cursor: 'pointer', fontSize: 15, padding: 0,
};
const tabActive = {
  padding: '8px 10px', borderRadius: 8, border: '1px solid var(--accent)',
  background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 600, cursor: 'pointer',
};
const tabInactive = {
  padding: '8px 10px', borderRadius: 8, border: '1px solid var(--input-border)',
  background: 'none', color: 'var(--text-dim)', cursor: 'pointer',
};
