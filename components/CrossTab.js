'use client';
import { useT, useLang } from './LangProvider';
import { useEffect, useRef, useState } from 'react';
import CoinIcon from './CoinIcon';
import Flag from './Flag';
import PriceValue from './PriceValue';
import NewsFeed from './NewsFeed';
import CrossChart from './CrossChart';
import CrossPicker from './CrossPicker';
import { COMMODITIES } from '../lib/commodities';
import { currencyOf } from '../lib/currencies';

const swapBtn = {
  width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'none', border: '1px solid var(--input-border)', color: 'var(--text-dim)',
  borderRadius: 6, cursor: 'pointer', fontSize: 15, padding: 0,
};
const cell = { minWidth: 90, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const rowStyle = { display: 'flex', alignItems: 'center', gap: 14, padding: '9px 6px', flexWrap: 'wrap', borderBottom: '1px solid var(--card-border)', color: 'var(--text)', borderRadius: 6 };

// Описание одной стороны пары: текст, значок, источник данных
export function legInfo(asset, exchange, lang) {
  if (exchange === 'COM') {
    const c = COMMODITIES.find(x => x.key === asset);
    return {
      text: c ? c.enLabel : asset,
      icon: <span className="cx-emoji pair-icon">{c?.emoji || '◆'}</span>,
      src: 'Yahoo Finance',
    };
  }
  if (exchange === 'FX') {
    return { text: asset, icon: <span className="cx-flag pair-icon"><Flag cc={currencyOf(asset).cc} width={22} /></span>, src: 'Yahoo Finance' };
  }
  return { text: asset, icon: <CoinIcon className="pair-icon" symbol={asset} size={24} />, src: exchange };
}

export default function CrossTab() {
  const t = useT();
  const { lang } = useLang();
  const dec = lang === 'en' ? '.' : ',';
  const [pairs, setPairs] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [swappingId, setSwappingId] = useState(null);
  const [chartId, setChartId] = useState(null);
  const [sortDir, setSortDir] = useState(null);
  const [info, setInfo] = useState(null);
  const alive = useRef(true);

  useEffect(() => {
    try {
      const s = localStorage.getItem('crossSortDir'); if (s) setSortDir(s);
      const c = localStorage.getItem('crossChartId'); if (c) setChartId(c);
    } catch {}
  }, []);

  async function loadPairs() {
    try {
      const d = await (await fetch('/api/cross')).json();
      if (alive.current) setPairs(d.pairs || []);
    } catch {}
    if (alive.current) setLoading(false);
  }
  async function loadPrices() {
    try {
      const d = await (await fetch('/api/cross-prices')).json();
      if (!alive.current) return;
      const m = {};
      (d.prices || []).forEach(p => { m[p.id] = p; });
      setPrices(m);
    } catch {}
  }
  useEffect(() => {
    alive.current = true;
    loadPairs(); loadPrices();
    const iv = setInterval(loadPrices, 30000);
    return () => { alive.current = false; clearInterval(iv); };
  }, []);

  function pickChart(id) {
    setChartId(String(id));
    try { localStorage.setItem('crossChartId', String(id)); } catch {}
    if (typeof window !== 'undefined' && window.innerWidth < 1300) {
      setTimeout(() => document.querySelector('.side-chart')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }
  function toggleSelectMode() { setSelectMode(v => !v); setSelected(new Set()); }
  function toggleSelected(id) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  async function confirmDelete() {
    if (selected.size === 0) { setSelectMode(false); return; }
    if (!confirm(t('Удалить выбранные пары ({n})?', { n: selected.size }))) return;
    setDeleting(true);
    await Promise.all([...selected].map(id => fetch(`/api/cross/${id}`, { method: 'DELETE' })));
    setPairs(prev => prev.filter(p => !selected.has(p.id)));
    setSelected(new Set()); setSelectMode(false); setDeleting(false);
  }
  async function swap(e, id) {
    e.stopPropagation();
    setSwappingId(id);
    await fetch(`/api/cross/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ swap: true }) });
    await Promise.all([loadPairs(), loadPrices()]);
    setSwappingId(null);
  }

  function clickSort(kind) {
    const first = kind === 'alpha' ? 'alpha_asc' : 'pct_desc', second = kind === 'alpha' ? 'alpha_desc' : 'pct_asc';
    const next = sortDir === first ? second : sortDir === second ? null : first;
    setSortDir(next);
    try { next ? localStorage.setItem('crossSortDir', next) : localStorage.removeItem('crossSortDir'); } catch {}
  }
  const arrow = (kind) => (sortDir && sortDir.startsWith(kind) ? (sortDir.endsWith('asc') ? ' ↑' : ' ↓') : '');

  const nameOf = (p) => `${legInfo(p.asset1, p.exchange1, lang).text}/${legInfo(p.asset2, p.exchange2, lang).text}`;
  let list = [...pairs];
  if (sortDir) {
    const sign = sortDir.endsWith('asc') ? 1 : -1;
    list.sort((a, b) => {
      if (sortDir.startsWith('alpha')) return sign * nameOf(a).localeCompare(nameOf(b));
      const va = prices[a.id]?.changePct, vb = prices[b.id]?.changePct;
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return sign * (va - vb);
    });
  }
  const active = pairs.find(p => String(p.id) === chartId) || pairs[0] || null;

  return (
    <>
      {addOpen && <CrossPicker onClose={() => setAddOpen(false)} onAdded={(p) => { loadPairs().then(loadPrices); if (p?.id) pickChart(p.id); }} />}
      {info && (
        <div className="modal-overlay ex-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) setInfo(null); }}>
          <div className="modal-box" role="dialog" aria-modal="true" style={{ maxWidth: 360, height: 'auto' }}>
            <div className="modal-head">
              <h2>{nameOf(info)}</h2>
              <button className="modal-close" onClick={() => setInfo(null)} aria-label={t('Закрыть')}>✕</button>
            </div>
            <div className="modal-sub" style={{ display: 'block', marginBottom: 10 }}>{t('Источники данных')}</div>
            {[[info.asset1, info.exchange1], [info.asset2, info.exchange2]].map(([a, ex], i) => {
              const l = legInfo(a, ex, lang);
              return <div key={i} className="ex-line"><b>{l.text}</b><span>{ex === 'COM' || ex === 'FX' ? t('источник') : t('биржа')}: {l.src}</span></div>;
            })}
          </div>
        </div>
      )}
      <div className="page-wrap" style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px 16px' }}>
        <div className="list-actions">
          {!selectMode ? (
            <>
              <button onClick={() => setAddOpen(true)} className="hd-btn hd-sm add" title={t('Добавить пару')}>{t('Добавить')}</button>
              {pairs.length > 0 && <button onClick={toggleSelectMode} className="hd-btn hd-sm del" title={t('Выбрать для удаления')}>{t('Удалить')}</button>}
            </>
          ) : (
            <>
              <button onClick={toggleSelectMode} className="hd-btn hd-sm">{t('Отмена')}</button>
              <button onClick={confirmDelete} disabled={deleting} className="hd-btn hd-sm del solid">{deleting ? '...' : `${t('Удалить')} (${selected.size})`}</button>
            </>
          )}
        </div>

        {loading && <p>{t('Загрузка...')}</p>}
        {!loading && pairs.length === 0 && <p style={{ opacity: 0.7 }}>{t('Пар пока нет — нажмите «Добавить», чтобы создать первую.')}</p>}
        {!loading && pairs.length > 0 && (
          <div className="pair-row pair-grid spot-head">
            <span className={`ar-sort sp-coin${sortDir?.startsWith('alpha') ? ' on' : ''}`} role="button" style={{ gridColumn: 'name-start / name-end' }} onClick={() => clickSort('alpha')}>Coin{arrow('alpha')}</span>
            <span className="sp-p" style={{ gridArea: 'price1' }}>{t('Цена 1')} USD</span>
            <span className="sp-p" style={{ gridArea: 'price2' }}>{t('Цена 2')} USD</span>
            <span className="sp-price" style={{ gridArea: 'ratio', textAlign: 'right' }}>Price</span>
            <span className={`ar-sort${sortDir?.startsWith('pct') ? ' on' : ''}`} role="button" style={{ gridArea: 'pct', textAlign: 'right' }} onClick={() => clickSort('pct')}>24h{arrow('pct')}</span>
          </div>
        )}
        {list.map((p) => {
          const price = prices[p.id];
          const pct = price?.changePct;
          const pctColor = pct == null ? 'var(--text-dim)' : pct >= 0 ? 'var(--up)' : 'var(--down)';
          const isSel = selected.has(p.id);
          const l1 = legInfo(p.asset1, p.exchange1, lang), l2 = legInfo(p.asset2, p.exchange2, lang);
          const nm = `${l1.text}/${l2.text}`;
          return (
            <div
              key={p.id} role="button" tabIndex={0}
              className={`pair-row pair-grid${selectMode ? ' sort-active' : ''}`}
              style={{ ...rowStyle, cursor: 'pointer', background: isSel ? 'var(--danger-bg)' : active && p.id === active.id ? 'var(--input-bg)' : 'transparent' }}
              onClick={() => { if (selectMode) toggleSelected(p.id); else pickChart(p.id); }}
              onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (selectMode) toggleSelected(p.id); else pickChart(p.id); } }}
            >
              {selectMode && <input type="checkbox" checked={isSel} onChange={() => toggleSelected(p.id)} onClick={(e) => e.stopPropagation()} className="cell-order" style={{ width: 18, height: 18 }} />}
              <div className="cell-icons" style={{ display: 'flex', gap: 4 }}>{l1.icon}{l2.icon}</div>
              <div className="cell-name" title={nm} style={{ minWidth: 90 }}>
                {nm}</div>
              {!selectMode && <button onClick={(e) => swap(e, p.id)} disabled={swappingId === p.id} className="cell-swap" style={swapBtn} title={t('Поменять местами')}>{swappingId === p.id ? '…' : '⇄'}</button>}
              <div className="cell-exchange" style={{ opacity: 0.6, fontSize: 14, minWidth: 90, textTransform: 'lowercase' }}>
                <span className="ex-full">{l1.src}/<wbr />{l2.src}</span>
                <button type="button" className="ex-info" aria-label={t('Источники данных')} title={t('Источники данных')} onClick={(e) => { e.stopPropagation(); setInfo(p); }}>ⓘ</button>
              </div>
              <div className="cell-price" style={cell}><PriceValue value={price?.price1} total={7} /></div>
              <div className="cell-price second" style={cell}><PriceValue value={price?.price2} total={7} /></div>
              <div className="cell-ratio" style={{ ...cell, fontWeight: 600 }}><PriceValue value={price?.ratio} total={9} /></div>
              <div className="cell-pct" style={{ minWidth: 56, textAlign: 'right', fontWeight: 600, fontSize: 16, color: pctColor }}>
                {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', dec)}%` : '—'}
              </div>
            </div>
          );
        })}
      </div>
      <aside className="side-panel">
        <section className="side-chart">
          <CrossChart key={active?.id || 'none'} pairId={active?.id} title={active ? nameOf(active) : ''} sub={active ? `${legInfo(active.asset1, active.exchange1, lang).src} / ${legInfo(active.asset2, active.exchange2, lang).src}` : ''} />
        </section>
        <section className="side-news"><div className="side-title">{t('Новости')}</div><NewsFeed key="crypto" /></section>
      </aside>
    </>
  );
}
