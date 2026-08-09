'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ThemeToggle from '../components/ThemeToggle';
import PriceValue from '../components/PriceValue';
import { emojiFor, shortTickerFor } from '../lib/commodities';

function icon(asset) {
  return `https://assets.coincap.io/assets/icons/${asset.toLowerCase()}@2x.png`;
}

export default function HomePage() {
  const searchParams = useSearchParams();
  const [login, setLogin] = useState('');
  const [tab, setTab] = useState('crypto');
  const [loading, setLoading] = useState(true);

  // При первой загрузке — вкладка из ссылки (?tab=...), иначе последняя использованная, иначе Crypto
  useEffect(() => {
    const fromUrl = searchParams.get('tab');
    const fromStorage = typeof window !== 'undefined' ? localStorage.getItem('activeTab') : null;
    const initial = fromUrl || fromStorage || 'crypto';
    setTab(initial);
  }, []);

  function changeTab(next) {
    setTab(next);
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
  const [sortMode, setSortMode] = useState(false);

  // --- Commodities ---
  const [cPairs, setCPairs] = useState([]);
  const [cPrices, setCPrices] = useState({});
  const [cSparks, setCSparks] = useState({});
  const [cSwappingId, setCSwappingId] = useState(null);
  const [cSelectMode, setCSelectMode] = useState(false);
  const [cSelected, setCSelected] = useState(new Set());
  const [cDeleting, setCDeleting] = useState(false);
  const [cSortMode, setCSortMode] = useState(false);

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
  async function move(e, index, dir) {
    e.preventDefault();
    e.stopPropagation();
    const j = index + dir;
    if (j < 0 || j >= pairs.length) return;
    const a = pairs[index], b = pairs[j];
    const newPairs = [...pairs];
    [newPairs[index], newPairs[j]] = [newPairs[j], newPairs[index]];
    setPairs(newPairs);
    await Promise.all([
      fetch(`/api/pairs/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: b.sort_order }) }),
      fetch(`/api/pairs/${b.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: a.sort_order }) }),
    ]);
  }
  async function swapPair(e, id) {
    e.preventDefault();
    e.stopPropagation();
    setSwappingId(id);
    const r = await fetch(`/api/pairs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ swap: true }) });
    if (r.ok) await load();
    setSwappingId(null);
  }
  function toggleSelectMode() { setSelectMode(v => !v); setSortMode(false); setSelected(new Set()); }
  function toggleSortMode() { setSortMode(v => !v); setSelectMode(false); }
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
  async function cMove(e, index, dir) {
    e.preventDefault();
    e.stopPropagation();
    const j = index + dir;
    if (j < 0 || j >= cPairs.length) return;
    const a = cPairs[index], b = cPairs[j];
    const newPairs = [...cPairs];
    [newPairs[index], newPairs[j]] = [newPairs[j], newPairs[index]];
    setCPairs(newPairs);
    await Promise.all([
      fetch(`/api/commodities/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: b.sort_order }) }),
      fetch(`/api/commodities/${b.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: a.sort_order }) }),
    ]);
  }
  async function cSwapPair(e, id) {
    e.preventDefault();
    e.stopPropagation();
    setCSwappingId(id);
    const r = await fetch(`/api/commodities/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ swap: true }) });
    if (r.ok) await load();
    setCSwappingId(null);
  }
  function cToggleSelectMode() { setCSelectMode(v => !v); setCSortMode(false); setCSelected(new Set()); }
  function cToggleSortMode() { setCSortMode(v => !v); setCSelectMode(false); }
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

  const isCrypto = tab === 'crypto';
  const curSelectMode = isCrypto ? selectMode : cSelectMode;
  const curSortMode = isCrypto ? sortMode : cSortMode;
  const curSelected = isCrypto ? selected : cSelected;
  const curDeleting = isCrypto ? deleting : cDeleting;
  const curPairs = isCrypto ? pairs : cPairs;
  const curToggleSelectMode = isCrypto ? toggleSelectMode : cToggleSelectMode;
  const curToggleSortMode = isCrypto ? toggleSortMode : cToggleSortMode;
  const curConfirmDelete = isCrypto ? confirmDeleteSelected : cConfirmDeleteSelected;

  return (
    <div className="page-wrap" style={{ maxWidth: 860, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <span className="header-login" style={{ color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>{login || '\u00A0'}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {!curSelectMode && !curSortMode ? (
            <>
              <ThemeToggle />
              <a href={isCrypto ? '/add' : '/add-commodity'} style={plusBtn}>+</a>
              {curPairs.length > 0 && <button onClick={curToggleSelectMode} style={deleteModeBtn} title="Удалить пары">–</button>}
              {curPairs.length > 1 && <button onClick={curToggleSortMode} style={sortModeBtn} title="Изменить порядок">⇅</button>}
              <button onClick={logout} style={logoutBtn}>Выйти</button>
            </>
          ) : curSelectMode ? (
            <>
              <button onClick={curToggleSelectMode} style={logoutBtn}>Отмена</button>
              <button onClick={curConfirmDelete} disabled={curDeleting} style={confirmDeleteBtn}>
                {curDeleting ? '...' : `Удалить (${curSelected.size})`}
              </button>
            </>
          ) : (
            <button onClick={curToggleSortMode} style={confirmDeleteBtn}>Готово</button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => changeTab('crypto')} style={tab === 'crypto' ? tabActive : tabInactive}>Crypto</button>
        <button onClick={() => changeTab('commodities')} style={tab === 'commodities' ? tabActive : tabInactive}>Commodities</button>
      </div>

      {loading && <p>Загрузка...</p>}

      {isCrypto && !loading && pairs.length === 0 && <p style={{ opacity: 0.7 }}>Пар пока нет — нажмите "+", чтобы добавить первую.</p>}
      {isCrypto && pairs.map((p, i) => {
        const price = prices[p.id];
        const spark = sparks[p.id];
        const pct = spark?.changePct;
        const pctColor = pct == null ? 'var(--text-dim)' : pct >= 0 ? '#26a69a' : '#ef5350';
        const isSelected = selected.has(p.id);
        return (
          <a
            key={p.id}
            href={`/pair/${p.id}`}
            className={`pair-row${sortMode || selectMode ? ' sort-active' : ''}`}
            style={{ ...row, background: isSelected ? 'var(--danger-bg)' : 'transparent' }}
            onClick={(e) => onRowClick(e, p.id)}
          >
            {sortMode && (
              <div className="cell-order" style={{ display: 'flex', flexDirection: 'column' }}>
                <button onClick={(e) => move(e, i, -1)} style={arrowBtn} disabled={i === 0}>▲</button>
                <button onClick={(e) => move(e, i, 1)} style={arrowBtn} disabled={i === pairs.length - 1}>▼</button>
              </div>
            )}
            {selectMode && (
              <input type="checkbox" checked={isSelected} onChange={() => toggleSelected(p.id)} onClick={(e) => e.stopPropagation()} className="cell-order" style={{ width: 18, height: 18 }} />
            )}
            <div className="cell-icons" style={{ display: 'flex', gap: 4 }}>
              <img className="pair-icon" src={icon(p.asset1)} width={24} height={24} onError={e => e.target.style.visibility = 'hidden'} />
              <img className="pair-icon" src={icon(p.asset2)} width={24} height={24} onError={e => e.target.style.visibility = 'hidden'} />
            </div>
            <div className="cell-name" style={{ minWidth: 90 }}>{p.asset1}/{p.asset2}</div>
            {!selectMode && !sortMode && (
              <button onClick={(e) => swapPair(e, p.id)} disabled={swappingId === p.id} className="cell-swap" style={swapBtn} title="Поменять местами">
                {swappingId === p.id ? '…' : '⇄'}
              </button>
            )}
            <div className="cell-exchange" style={{ opacity: 0.6, fontSize: 12, minWidth: 90, textTransform: 'lowercase' }}>{p.exchange1}/{p.exchange2}</div>
            <div className="cell-price" style={cell}><PriceValue value={price?.price1} /></div>
            <div className="cell-price second" style={cell}><PriceValue value={price?.price2} /></div>
            <div className="cell-ratio" style={{ ...cell, fontWeight: 600 }}>{price?.ratio ? price.ratio.toFixed(8) : '—'}</div>
            <div className="cell-pct" style={{ minWidth: 56, textAlign: 'right', fontWeight: 600, fontSize: 14, color: pctColor }}>
              {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%` : '—'}
            </div>
          </a>
        );
      })}

      {!isCrypto && !loading && cPairs.length === 0 && <p style={{ opacity: 0.7 }}>Пар пока нет — нажмите "+", чтобы добавить первую.</p>}
      {!isCrypto && cPairs.map((p, i) => {
        const price = cPrices[p.id];
        const spark = cSparks[p.id];
        const pct = spark?.changePct;
        const pctColor = pct == null ? 'var(--text-dim)' : pct >= 0 ? '#26a69a' : '#ef5350';
        const isSelected = cSelected.has(p.id);
        return (
          <a
            key={p.id}
            href={`/commodity-pair/${p.id}`}
            className={`pair-row${cSortMode || cSelectMode ? ' sort-active' : ''}`}
            style={{ ...row, background: isSelected ? 'var(--danger-bg)' : 'transparent' }}
            onClick={(e) => cOnRowClick(e, p.id)}
          >
            {cSortMode && (
              <div className="cell-order" style={{ display: 'flex', flexDirection: 'column' }}>
                <button onClick={(e) => cMove(e, i, -1)} style={arrowBtn} disabled={i === 0}>▲</button>
                <button onClick={(e) => cMove(e, i, 1)} style={arrowBtn} disabled={i === cPairs.length - 1}>▼</button>
              </div>
            )}
            {cSelectMode && (
              <input type="checkbox" checked={isSelected} onChange={() => cToggleSelected(p.id)} onClick={(e) => e.stopPropagation()} className="cell-order" style={{ width: 18, height: 18 }} />
            )}
            <div className="cell-icons" style={{ display: 'flex', gap: 4, fontSize: 18 }}>
              <span>{emojiFor(p.asset1)}</span>
              <span>{emojiFor(p.asset2)}</span>
            </div>
            <div className="cell-name" style={{ minWidth: 90 }}>{shortTickerFor(p.asset1)}/{shortTickerFor(p.asset2)}</div>
            {!cSelectMode && !cSortMode && (
              <button onClick={(e) => cSwapPair(e, p.id)} disabled={cSwappingId === p.id} className="cell-swap" style={swapBtn} title="Поменять местами">
                {cSwappingId === p.id ? '…' : '⇄'}
              </button>
            )}
            <div className="cell-exchange" style={{ opacity: 0.6, fontSize: 12, minWidth: 90 }}></div>
            <div className="cell-price" style={cell}><PriceValue value={price?.price1} /></div>
            <div className="cell-price second" style={cell}><PriceValue value={price?.price2} /></div>
            <div className="cell-ratio" style={{ ...cell, fontWeight: 600 }}>{price?.ratio ? price.ratio.toFixed(8) : '—'}</div>
            <div className="cell-pct" style={{ minWidth: 56, textAlign: 'right', fontWeight: 600, fontSize: 14, color: pctColor }}>
              {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%` : '—'}
            </div>
          </a>
        );
      })}
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
  background: 'var(--accent)', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 18,
};
const trashBtn = {
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 18, cursor: 'pointer',
};
const deleteModeBtn = trashBtn;
const sortModeBtn = {
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'none', border: '1px solid var(--input-border)', color: 'var(--text)', borderRadius: 8, fontSize: 16, cursor: 'pointer',
};
const logoutBtn = { background: 'none', border: '1px solid var(--input-border)', color: 'var(--text-dim)', borderRadius: 8, padding: '0 12px' };
const confirmDeleteBtn = {
  background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, padding: '0 14px', fontWeight: 600, cursor: 'pointer',
};
const arrowBtn = {
  background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer',
  fontSize: 9, padding: 0, lineHeight: 1,
};
const swapBtn = {
  width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'none', border: '1px solid var(--input-border)', color: 'var(--text-dim)',
  borderRadius: 6, cursor: 'pointer', fontSize: 13, padding: 0,
};
const tabActive = {
  padding: '8px 16px', borderRadius: 8, border: '1px solid var(--accent)',
  background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer',
};
const tabInactive = {
  padding: '8px 16px', borderRadius: 8, border: '1px solid var(--input-border)',
  background: 'none', color: 'var(--text-dim)', cursor: 'pointer',
};
