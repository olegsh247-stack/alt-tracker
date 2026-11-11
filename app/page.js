'use client';
import { useT, useLang } from '../components/LangProvider';
import { useEffect, useRef, useState } from 'react';
import LangSwitch from '../components/LangSwitch';
import ThemeToggle from '../components/ThemeToggle';
import PriceValue from '../components/PriceValue';
import CrossTab from '../components/CrossTab';
import { shortTickerFor, enLabelFor, tvSymbolFor } from '../lib/commodities';
import PoolSearch from '../components/PoolSearch';
import PoolTable from '../components/PoolTable';
import TvChart from '../components/TvChart';
import CrossChart from '../components/CrossChart';
import NewsFeed from '../components/NewsFeed';
import Logo from '../components/Logo';
import CoinIcon from '../components/CoinIcon';
import AssetChart from '../components/AssetChart';
import { ALGOS } from '../lib/algos';
import Flag from '../components/Flag';
import TvCalendar from '../components/TvCalendar';
import { CURRENCIES, currencyOf, currencyName, DEFAULT_FOREX, DEFAULT_BASE } from '../lib/currencies';
import PoolChart from '../components/PoolChart';
import AddAssetModal from '../components/AddAssetModal';
import { saveSetting, pullSettings } from '../lib/settingsSync';

export default function HomePage() {
  const t = useT();
  const { lang } = useLang();
  const dec = lang === 'en' ? '.' : ',';
  const [login, setLogin] = useState('');
  const [googleLinked, setGoogleLinked] = useState(null);
  const [tab, setTab] = useState('pair');
  const [loading, setLoading] = useState(true);

  // При первой загрузке — вкладка из ссылки (?tab=...), иначе последняя использованная, иначе Crypto
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('tab');
    const raw = fromUrl || 'pair'; // главная страница сайта — Spot; другая вкладка открывается только по ссылке ?tab=
    const normalized = raw === 'crypto' ? 'pair' : raw === 'dex' ? 'pool' : raw;
    setTab(normalized);
  }, []);

  useEffect(() => { try { document.querySelector('.hd-tab.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch {} }, [tab]);

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
  const [assetStats, setAssetStats] = useState({});
  const [addOpen, setAddOpen] = useState(false);
  const [exInfo, setExInfo] = useState(null); // пара, для которой открыто окно «откуда данные»
  const [assetBase, setAssetBase] = useState('USDT');
  const [assetSort, setAssetSort] = useState({ key: 'cap', dir: 'desc' }); // по умолчанию — по капитализации
  const [chartAssetKey, setChartAssetKey] = useState(null);

  // --- Forex: список валют и база хранятся в браузере (как Assets) ---
  const [forexCodes, setForexCodes] = useState(DEFAULT_FOREX);
  const [forexBase, setForexBase] = useState(DEFAULT_BASE);
  const [forexRates, setForexRates] = useState({});
  const [forexLoaded, setForexLoaded] = useState(false);
  const [forexError, setForexError] = useState(false);
  const [fxSelectMode, setFxSelectMode] = useState(false);
  const [fxSelected, setFxSelected] = useState(new Set());
  const [fxChartCode, setFxChartCode] = useState(null);
  const [sideView, setSideView] = useState('news');
  const [fxAmt, setFxAmt] = useState('1');
  const [fxFrom, setFxFrom] = useState(null);
  const [fxTo, setFxTo] = useState(null);
  function applyLocalSettings() {
    try {
      const c = localStorage.getItem('forexCodes');
      if (c) { const v = JSON.parse(c); if (Array.isArray(v)) setForexCodes(v); }
      { const ab = localStorage.getItem('assetBase'); if (ab === 'BTC' || ab === 'ETH' || ab === 'USDT') setAssetBase(ab); }
      const b = localStorage.getItem('forexBase');
      if (b) setForexBase(b);
      const ch = localStorage.getItem('fxChartCode');
      if (ch) setFxChartCode(ch);
      const calc = JSON.parse(localStorage.getItem('fxCalc') || 'null');
      if (calc) { if (calc.amt) setFxAmt(String(calc.amt)); if (calc.from) setFxFrom(calc.from); if (calc.to) setFxTo(calc.to); }
    } catch {}
  }
  useEffect(() => {
    applyLocalSettings();
    setForexLoaded(true);
    // подтягиваем списки и основные валюты с сервера (общие для всех устройств)
    pullSettings().then((changed) => { if (changed) { applyLocalSettings(); loadAssets(); } });
  }, []);
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
    if (!confirm(t('Удалить выбранные пулы ({n})?', { n: poolSelected.size }))) return;
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
    setCSortDir('alpha_asc');
    try {
      const fix = (v) => (v === 'asc' || v === 'desc' ? `pct_${v}` : v || null);
      setSortDir(fix(localStorage.getItem('pairSortDir')));
      { const cv = localStorage.getItem('commoditySortDir'); setCSortDir(cv === 'off' ? null : (fix(cv) || 'alpha_asc')); }
    } catch {}
  }, []);
  useEffect(() => {
    function onDown(e) { if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) setSortMenuOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); };
  }, []);

  useEffect(() => {
    if (tab !== 'forex' || !forexLoaded) return;
    const codes = forexCodes.filter(c => c !== forexBase);
    if (codes.length === 0) { setForexRates({}); return; }
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/forex?base=${forexBase}&codes=${codes.join(',')}`);
        const j = await r.json();
        if (alive) { setForexRates(j.rates || {}); setForexError(!!j.error); }
      } catch { if (alive) setForexError(true); }
    };
    load();
    const t = setInterval(load, 15 * 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, [tab, forexLoaded, forexBase, forexCodes]);

  function changeForexBase(code) {
    setForexBase(code);
    setForexRates({});
    saveSetting('forexBase', code);
  }
  function pickFxChart(code) {
    setFxChartCode(code);
    try { localStorage.setItem('fxChartCode', code); } catch {}
    if (typeof window !== 'undefined' && window.innerWidth < 1300) {
      setTimeout(() => document.querySelector('.side-chart')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }
  function saveCalc(amt, from, to) {
    try { localStorage.setItem('fxCalc', JSON.stringify({ amt, from, to })); } catch {}
  }
  function toggleFxSelectMode() { setFxSelectMode(v => !v); setFxSelected(new Set()); }
  function toggleFxSelected(code) {
    setFxSelected(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; });
  }
  function confirmDeleteForex() {
    if (fxSelected.size === 0) { setFxSelectMode(false); return; }
    if (!confirm(t('Удалить выбранные валюты ({n})?', { n: fxSelected.size }))) return;
    const next = forexCodes.filter(c => !fxSelected.has(c));
    setForexCodes(next);
    saveSetting('forexCodes', JSON.stringify(next));
    setFxSelected(new Set());
    setFxSelectMode(false);
  }

  async function loadAssets() {
    try {
      const tracked = JSON.parse(localStorage.getItem('cryptoTrackedAssets') || '[]');
      let all = [];
      try { all = (await (await fetch('https://crypto-api.olegsh247.workers.dev/api/assets')).json()).assets || []; } catch {}
      let meta = {};
      try { meta = JSON.parse(localStorage.getItem('cryptoTrackedMeta') || '{}') || {}; } catch {}
      const mine = tracked.map(id => all.find(a => a.asset_id === id) || (/^(cg|pp):/.test(String(id)) && meta[id] ? { asset_id: id, symbol: meta[id].symbol, name: meta[id].name, ext: true } : null)).filter(Boolean);
      setAssets(mine);
      const rows = await Promise.all(mine.filter(a => !a.ext).map(async asset => {
        try {
          const rr = await fetch(`https://crypto-api.olegsh247.workers.dev/api/assets/${asset.asset_id}`);
          return [asset.asset_id, rr.ok ? await rr.json() : null];
        } catch { return [asset.asset_id, null]; }
      }));
      setAssetDetails(Object.fromEntries(rows));
      if (mine.length) {
        try {
          const symList = [...new Set([...mine.filter(a => !a.ext).map(a => a.symbol), 'BTC', 'ETH'])];
          const sr = await fetch(`/api/asset-stats?s=${encodeURIComponent(symList.join(','))}&ids=${encodeURIComponent(mine.filter(a => a.ext).map(a => `${a.asset_id}~${a.symbol}`).join(','))}`);
          if (sr.ok) setAssetStats((await sr.json()).stats || {});
        } catch {}
      }
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
    if (!confirm(t('Удалить выбранные активы ({n})?', { n: assetSelected.size }))) return;
    setAssetDeleting(true);
    const tracked = JSON.parse(localStorage.getItem('cryptoTrackedAssets') || '[]');
    const next = tracked.filter(id => !assetSelected.has(id));
    saveSetting('cryptoTrackedAssets', JSON.stringify(next));
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
    if (typeof meRes.googleLinked === 'boolean') setGoogleLinked(meRes.googleLinked);

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
    if (!confirm(t('Удалить выбранные пары ({n})?', { n: selected.size }))) return;
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
  const [cChartPairId, setCChartPairId] = useState(null);
  useEffect(() => { try { const v = localStorage.getItem('cChartPairId'); if (v) setCChartPairId(v); } catch {} }, []);
  function cPickChart(id) {
    setCChartPairId(String(id));
    try { localStorage.setItem('cChartPairId', String(id)); } catch {}
    if (typeof window !== 'undefined' && window.innerWidth < 1300) {
      setTimeout(() => document.querySelector('.side-chart')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }
  function cOnRowClick(e, id) { if (cSelectMode) cToggleSelected(id); else cPickChart(id); }
  function cChartSymbolsFor(pair) {
    if (!pair) return ['TVC:GOLD', 'TVC:SILVER'];
    const out = [];
    [pair.asset1, pair.asset2].forEach(k => { const t = tvSymbolFor(k); if (t && !out.includes(t)) out.push(t); });
    return out.length ? out : ['TVC:GOLD', 'TVC:SILVER'];
  }
  async function cConfirmDeleteSelected() {
    if (cSelected.size === 0) { setCSelectMode(false); return; }
    if (!confirm(t('Удалить выбранные пары ({n})?', { n: cSelected.size }))) return;
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
    if (typeof window !== 'undefined' && window.innerWidth < 1300) {
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
  const chartPair = pairs.find(p => String(p.id) === chartPairId) || pairs[0] || null;
  const chartSymbols = chartSymbolsFor(chartPair);

  // график пула (вкладка Pool): выбранная строка, по умолчанию — первое избранное
  const [chartPool, setChartPool] = useState(null);
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem('chartPool') || 'null'); if (v?.address) setChartPool(v); } catch {} }, []);
  function selectPool(p) {
    const v = { network: p.network, address: p.address, base: p.base, quote: p.quote, baseAddress: p.baseAddress || null, quoteAddress: p.quoteAddress || null, dex: p.dex, feePct: p.feePct ?? null, feeApprox: !!p.feeApprox, change24: p.change24 ?? null };
    setChartPool(v);
    try { localStorage.setItem('chartPool', JSON.stringify(v)); } catch {}
    if (typeof window !== 'undefined' && window.innerWidth < 1300) {
      setTimeout(() => document.querySelector('.side-chart')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }
  const poolForChart = chartPool || (poolFavs[0] ? { ...poolFavs[0] } : null);
  const isActivePool = (p) => !!poolForChart && poolForChart.network === p.network && poolForChart.address === p.address;

  const isAssets = tab === 'assets';
  const isPair = tab === 'pair';
  const isCommodities = tab === 'commodities';
  const isPool = tab === 'pool';
  const isForex = tab === 'forex';
  const isCross = tab === 'cross';
  const isCrypto = isPair;
  const curSelectMode = isForex ? fxSelectMode : isPool ? poolSelectMode : isAssets ? assetSelectMode : (isCrypto ? selectMode : cSelectMode);
  const curSelected = isForex ? fxSelected : isPool ? poolSelected : isAssets ? assetSelected : (isCrypto ? selected : cSelected);
  const curDeleting = isForex ? false : isPool ? poolDeleting : isAssets ? assetDeleting : (isCrypto ? deleting : cDeleting);
  const curPairs = isForex ? forexCodes : isPool ? poolFavs : isAssets ? assets : (isCrypto ? pairs : cPairs);
  const curToggleSelectMode = isForex ? toggleFxSelectMode : isPool ? togglePoolSelectMode : isAssets ? (() => { setAssetSelectMode(v => !v); setAssetSelected(new Set()); }) : (isCrypto ? toggleSelectMode : cToggleSelectMode);
  const curSortDir = isCrypto ? sortDir : cSortDir;
  function chooseSort(dir) {
    // повторный выбор того же пункта возвращает исходный порядок
    const next = curSortDir === dir ? null : dir;
    const key = isCrypto ? 'pairSortDir' : 'commoditySortDir';
    (isCrypto ? setSortDir : setCSortDir)(next);
    try { next ? localStorage.setItem(key, next) : (isCrypto ? localStorage.removeItem(key) : localStorage.setItem(key, 'off')); } catch {}
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
  const rawStatOf = (a) => assetStats[a.ext ? a.asset_id : String(a.symbol || '').toUpperCase()];
  // Пересчёт в выбранную основную валюту (USDT ≈ USD — без изменений): цена и изменения считаются через курс BTC/ETH в USD
  const baseStat = assetBase === 'USDT' ? null : assetStats[assetBase];
  const statOf = (a) => {
    const st = rawStatOf(a);
    if (!baseStat) return st;
    if (!st) return st;
    if (String(a.symbol || '').toUpperCase() === assetBase) return { ...st, price: 1, change24h: 0, change30d: 0, change1y: 0 };
    const chg = (c, cb) => (c == null || cb == null ? null : ((1 + c / 100) / (1 + cb / 100) - 1) * 100);
    return {
      ...st,
      price: st.price != null && baseStat.price > 0 ? st.price / baseStat.price : null,
      change24h: chg(st.change24h, baseStat.change24h), change30d: chg(st.change30d, baseStat.change30d), change1y: chg(st.change1y, baseStat.change1y),
    };
  };
  function changeAssetBase(v) { setAssetBase(v); saveSetting('assetBase', v); }
  const ASSET_SORT_VAL = { ticker: a => String(a.symbol || ''), y1: a => statOf(a)?.change1y, m1: a => statOf(a)?.change30d, h24: a => statOf(a)?.change24h, cap: a => statOf(a)?.marketCap };
  function clickAssetSort(key) {
    setAssetSort(cur => !cur || cur.key !== key ? { key, dir: key === 'ticker' ? 'asc' : 'desc' } : cur.dir === (key === 'ticker' ? 'asc' : 'desc') ? { key, dir: key === 'ticker' ? 'desc' : 'asc' } : null);
  }
  const displayAssets = !assetSort ? assets : [...assets].sort((a, b) => {
    const get = ASSET_SORT_VAL[assetSort.key], sign = assetSort.dir === 'asc' ? 1 : -1;
    const va = get(a), vb = get(b);
    if (assetSort.key === 'ticker') return sign * va.localeCompare(vb, 'en', { sensitivity: 'base' });
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return sign * (va - vb);
  });
  const sortHead = (key, label, cls) => (
    <span className={`${cls || ''} ar-sort${assetSort?.key === key ? ' on' : ''}`} role="button" onClick={() => clickAssetSort(key)}>
      {label}{assetSort?.key === key ? (assetSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </span>
  );
  function clickSpotSort(kind) {
    const first = kind === 'alpha' ? 'alpha_asc' : 'pct_desc', second = kind === 'alpha' ? 'alpha_desc' : 'pct_asc';
    const next = sortDir === first ? second : sortDir === second ? null : first;
    setSortDir(next);
    try { next ? localStorage.setItem('pairSortDir', next) : localStorage.removeItem('pairSortDir'); } catch {}
  }
  const spotArrow = (kind) => (sortDir && sortDir.startsWith(kind) ? (sortDir.endsWith('asc') ? ' ↑' : ' ↓') : '');
  const cChartPair = cPairs.find(p => String(p.id) === cChartPairId) || null;
  const cChartSymbols = cChartSymbolsFor(cChartPair);
  const chartAsset = assets.find(a => a.asset_id === chartAssetKey) || assets[0] || null;
  const displayPairs = sortList(pairs, sparks, sortDir, p => `${p.asset1}/${p.asset2}`);
  const displayCPairs = sortList(cPairs, cSparks, cSortDir, p => `${enLabelFor(p.asset1)}/${enLabelFor(p.asset2)}`);
  const curConfirmDelete = isForex ? confirmDeleteForex : isPool ? confirmDeletePools : isAssets ? confirmDeleteAssets : (isCrypto ? confirmDeleteSelected : cConfirmDeleteSelected);

  return (
    <div className={`app-shell${isCrypto ? ' tab-spot' : ''}${isPool ? ' tab-pool' : ''}${isAssets ? ' tab-assets' : ''}${isForex ? ' tab-forex' : ''}${isCross ? ' tab-spot tab-cross' : ''}`}>
    <header className="app-header">
        <div className="hd-lt">
        <a href="/" className="hd-logo" title={t('На главную')} aria-label={t('На главную')} onClick={(e) => { e.preventDefault(); changeTab('pair'); try { window.history.replaceState(null, '', '/'); } catch {} window.scrollTo({ top: 0 }); }}><Logo size={30} /></a>
        <nav className="hd-tabs" aria-label={t('Разделы')}>
          <button onClick={() => changeTab('assets')} className={`hd-tab${tab === 'assets' ? ' on' : ''}`}>Assets</button>
          <button onClick={() => changeTab('pair')} className={`hd-tab${tab === 'pair' ? ' on' : ''}`}>Spot</button>
          <button onClick={() => changeTab('pool')} className={`hd-tab${tab === 'pool' ? ' on' : ''}`}>Pool</button>
          <button onClick={() => changeTab('commodities')} className={`hd-tab${tab === 'commodities' ? ' on' : ''}`}>Commodities</button>
          <button onClick={() => changeTab('forex')} className={`hd-tab${tab === 'forex' ? ' on' : ''}`}>Forex</button>
          <button onClick={() => changeTab('cross')} className={`hd-tab${tab === 'cross' ? ' on' : ''}`}>Cross</button>
        </nav>
        </div>
        <div className="hd-right">
          <ThemeToggle />
          <LangSwitch />
          <a
            href="/account"
            className={`hd-btn hd-id${googleLinked === true ? ' ok' : googleLinked === false ? ' no' : ''}`}
            data-tip={googleLinked === true ? t('Google подключён') : googleLinked === false ? t('Google не подключён — нажмите, чтобы привязать') : t('Аккаунт')}
            aria-label={`${t('Аккаунт')} ${login}${googleLinked === true ? ', ' + t('Google подключён') : googleLinked === false ? ', ' + t('Google не подключён') : ''}`}
          >{login || '\u00A0'}</a>
          <button onClick={logout} className="hd-btn">{t('Выйти')}</button>
        </div>
      </header>
    {exInfo && (
      <div className="modal-overlay ex-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) setExInfo(null); }}>
        <div className="modal-box" role="dialog" aria-modal="true" style={{ maxWidth: 360, height: 'auto' }}>
          <div className="modal-head">
            <h2>{exInfo.asset1}/{exInfo.asset2}</h2>
            <button className="modal-close" onClick={() => setExInfo(null)} aria-label={t('Закрыть')}>✕</button>
          </div>
          <div className="modal-sub" style={{ display: 'block', marginBottom: 10 }}>{t('Источники данных')}</div>
          <div className="ex-line"><b>{exInfo.asset1}</b><span>{t('биржа')}: {exInfo.exchange1}</span></div>
          <div className="ex-line"><b>{exInfo.asset2}</b><span>{t('биржа')}: {exInfo.exchange2}</span></div>
        </div>
      </div>
    )}
    {addOpen && <AddAssetModal onClose={() => setAddOpen(false)} onChange={loadAssets} />}
    {isCross ? <CrossTab /> : (<>
    <div className="page-wrap" style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px 16px' }}>
      <div className="list-actions">
        {isAssets && (
          <label className="fx-base">
            <span>{t('Основная валюта')}</span>
            <select value={assetBase} onChange={e => changeAssetBase(e.target.value)} className="hd-btn hd-sm">
              <option value="USDT">USDT</option><option value="BTC">BTC</option><option value="ETH">ETH</option>
            </select>
          </label>
        )}
        {isForex && (
          <label className="fx-base">
            <span>{t('Основная валюта')}</span>
            <select value={forexBase} onChange={e => changeForexBase(e.target.value)} className="hd-btn hd-sm">
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {currencyName(c, lang)}</option>)}
            </select>
          </label>
        )}
          {!curSelectMode ? (
            <>
              {isAssets && <button onClick={() => setAddOpen(true)} className="hd-btn hd-sm add" title={t('Добавить актив')}>{t('Добавить')}</button>}
              {!isPool && !isAssets && <a href={isForex ? '/add-currency' : isCrypto ? '/add' : '/add-commodity'} className="hd-btn hd-sm add" title={isAssets ? t('Добавить актив') : isForex ? t('Добавить валюту') : isCrypto ? t('Добавить пару') : t('Добавить commodity')}>{t('Добавить')}</a>}
              {curPairs.length > 0 && <button onClick={curToggleSelectMode} className="hd-btn hd-sm del" title={t('Выбрать для удаления')}>{t('Удалить')}</button>}
          {!isAssets && !isPool && !isForex && !isCrypto && curPairs.length > 1 && (
            <div ref={sortMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setSortMenuOpen(v => !v)}
                className="hd-btn hd-sm hd-icon"
                style={curSortDir ? { borderColor: 'var(--accent)', color: 'var(--accent-text)' } : undefined}
                title={t('Сортировка')}
                aria-label={t('Сортировка')}
              >⇅</button>
              {sortMenuOpen && (
                <div style={sortMenu}>
                  <div style={sortHead}>{t('По алфавиту')}</div>
                  {[['alpha_asc', 'A → Z'], ['alpha_desc', 'Z → A']].map(([k, lbl]) => (
                    <button key={k} onClick={() => chooseSort(k)} style={sortItem}>
                      <span>{lbl}</span>{curSortDir === k && <span style={{ color: 'var(--accent-text)' }}>✓</span>}
                    </button>
                  ))}
                  <div style={sortHead}>{t('По изменению за 24ч')}</div>
                  {[['pct_asc', t('По возрастанию')], ['pct_desc', t('По убыванию')]].map(([k, lbl], idx) => (
                    <button key={k} onClick={() => chooseSort(k)} style={{ ...sortItem, ...(idx === 1 ? { borderBottom: 'none' } : {}) }}>
                      <span>{lbl}</span>{curSortDir === k && <span style={{ color: 'var(--accent-text)' }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
            </>
          ) : (
            <>
              <button onClick={curToggleSelectMode} className="hd-btn hd-sm">{t('Отмена')}</button>
              <button onClick={curConfirmDelete} disabled={curDeleting} className="hd-btn hd-sm del solid">
                {curDeleting ? '...' : `${t('Удалить')} (${curSelected.size})`}
              </button>
            </>
          )}
        </div>

      {loading && <p>{t('Загрузка...')}</p>}

      {isPool && (
        <PoolSearch
          favSet={new Set(poolFavs.map(f => `${f.network}:${f.address}`))}
          onAdded={loadPools}
          onActiveChange={setPoolSearching}
          onSelectPool={selectPool}
          isActivePool={isActivePool}
        />
      )}
      {isPool && !poolSearching && poolFavs.length > 0 && <div style={{ fontSize: 14, color: 'var(--text-dim)', margin: '4px 0 2px' }}>{t('Избранное')}</div>}
      {isPool && !poolSearching && poolLoaded && poolFavs.length === 0 && <p style={{ opacity: 0.7 }}>{t('Избранных пулов пока нет — найдите пул по монете выше и добавьте его.')}</p>}
      {isPool && !poolSearching && poolStatsError && <p style={{ color: 'var(--danger)', fontSize: 14 }}>{t('Часть данных не загрузилась — источник временно недоступен, обновится автоматически.')}</p>}
      {isPool && !poolSearching && poolFavs.length > 0 && (
        <PoolTable
          rows={poolFavs}
          showAge
          getKey={f => f.id}
          onSelect={selectPool}
          isActive={isActivePool}
          pairExtra={f => <a href={`https://www.geckoterminal.com/${f.network}/pools/${f.address}`} target="_blank" rel="noopener noreferrer" className="open-pair" title={t('Открыть на GeckoTerminal')} aria-label={t('Открыть на GeckoTerminal')}>↗</a>}
          select={{ mode: poolSelectMode, selected: poolSelected, onToggle: f => togglePoolSelected(f.id) }}
        />
      )}

      {isAssets && !loading && assets.length === 0 && <p style={{ opacity: 0.7 }}>{t('Активов пока нет — нажмите "+", чтобы добавить первый.')}</p>}
      {isAssets && !loading && assets.length > 0 && (
        <div className={`asset-row asset-head${assetSelectMode ? ' sel' : ''}`}>
          {assetSelectMode && <span />}
          <span />
          {sortHead('ticker', 'Ticker', 'ar-tk')}
          {sortHead('cap', 'Rank', 'ar-r')}
          {sortHead('y1', '1Y', 'ar-r ar-long')}
          {sortHead('m1', '1M', 'ar-r ar-long')}
          {sortHead('h24', '24h', 'ar-r')}
          <span className="ar-r">Price</span>
        </div>
      )}
      {isAssets && !loading && displayAssets.map((asset) => {
        const metrics = assetDetails[asset.asset_id]?.metrics || [];
        const m = metrics.find(x => x.metric_id === 'market.spot_price');
        const st = statOf(asset);
        const price = assetBase === 'USDT' ? (st?.price ?? m?.value) : st?.price;
        const isSelected = assetSelected.has(asset.asset_id);
        const ch = st?.change24h;
        return (
          <div key={asset.asset_id} className={`asset-row${assetSelectMode ? ' sel' : ''}`} style={{ cursor: 'pointer', background: isSelected ? 'var(--danger-bg)' : chartAsset?.asset_id === asset.asset_id ? 'var(--input-bg)' : 'transparent' }} onClick={() => { if (assetSelectMode) toggleAssetSelect(asset.asset_id); else { setChartAssetKey(asset.asset_id); setTimeout(() => document.querySelector('.side-chart')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } }}>
            {assetSelectMode && <input type="checkbox" checked={isSelected} onChange={() => toggleAssetSelect(asset.asset_id)} onClick={e => e.stopPropagation()} style={{ width: 18, height: 18 }} />}
            <CoinIcon symbol={asset.symbol} size={28} />
            <div className="ar-coin"><b>{asset.symbol}</b></div>
            <div className="ar-r">{st?.rank ? `#${st.rank}` : '—'}</div>
            <div className="ar-r ar-long"><Pct v={st?.change1y} /></div>
            <div className="ar-r ar-long"><Pct v={st?.change30d} /></div>
            <div className="ar-r" style={{ fontWeight: 600, color: ch == null ? 'var(--text-dim)' : ch >= 0 ? 'var(--up)' : 'var(--down)' }}>{ch == null ? '—' : `${ch >= 0 ? '+' : ''}${ch.toFixed(1).replace('.', dec)}%`}</div>
            <div className="ar-r" style={{ fontWeight: 600 }}>{price == null ? '—' : assetBase === 'USDT' ? Number(price).toLocaleString('en-US', { maximumFractionDigits: price >= 1000 ? 2 : price >= 1 ? 4 : 8 }) : Number(price).toFixed(8)}</div>
          </div>
        );
      })}

      {isCrypto && !loading && pairs.length === 0 && <p style={{ opacity: 0.7 }}>{t('Пар пока нет — нажмите "+", чтобы добавить первую.')}</p>}
      {isCrypto && !loading && pairs.length > 0 && (
        <div className="pair-row pair-grid spot-head">
          <span className={`ar-sort sp-coin${sortDir?.startsWith('alpha') ? ' on' : ''}`} role="button" style={{ gridColumn: 'name-start / name-end' }} onClick={() => clickSpotSort('alpha')}>Coin{spotArrow('alpha')}</span>
          <span className="sp-p" style={{ gridArea: 'price1' }}>{t('Цена 1')} USDT</span>
          <span className="sp-p" style={{ gridArea: 'price2' }}>{t('Цена 2')} USDT</span>
          <span className="sp-price" style={{ gridArea: 'ratio', textAlign: 'right' }}>Price</span>
          <span className={`ar-sort${sortDir?.startsWith('pct') ? ' on' : ''}`} role="button" style={{ gridArea: 'pct', textAlign: 'right' }} onClick={() => clickSpotSort('pct')}>24h{spotArrow('pct')}</span>
        </div>
      )}
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
              <CoinIcon className="pair-icon" symbol={p.asset1} size={24} />
              <CoinIcon className="pair-icon" symbol={p.asset2} size={24} />
            </div>
            <div className="cell-name" style={{ minWidth: 90 }}>{p.asset1}/{p.asset2}</div>
            {!selectMode && (
              <button onClick={(e) => swapPair(e, p.id)} disabled={swappingId === p.id} className="cell-swap" style={swapBtn} title={t('Поменять местами')}>
                {swappingId === p.id ? '…' : '⇄'}
              </button>
            )}
            <div className="cell-exchange" style={{ opacity: 0.6, fontSize: 14, minWidth: 90, textTransform: 'lowercase' }}><span className="ex-full">{p.exchange1}/<wbr />{p.exchange2}</span><button type="button" className="ex-info" aria-label={t('Источники данных')} title={t('Источники данных')} onClick={(e) => { e.stopPropagation(); setExInfo(p); }}>ⓘ</button></div>
            <div className="cell-price" style={cell}><PriceValue value={price?.price1} total={7} /></div>
            <div className="cell-price second" style={cell}><PriceValue value={price?.price2} total={7} /></div>
            <div className="cell-ratio" style={{ ...cell, fontWeight: 600 }}>{price?.ratio ? price.ratio.toFixed(8) : '—'}</div>
            <div className="cell-pct" style={{ minWidth: 56, textAlign: 'right', fontWeight: 600, fontSize: 16, color: pctColor }}>
              {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', dec)}%` : '—'}
            </div>
          </div>
        );
      })}

      {isForex && forexLoaded && (() => {
        const list = forexCodes.filter(c => c !== forexBase);
        const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 2 : n >= 1 ? 4 : 6, minimumFractionDigits: n >= 100 ? 2 : 0 }));
        const active = fxChartCode && list.includes(fxChartCode) ? fxChartCode : list[0];
        const opts = [forexBase, ...list];
        const from = opts.includes(fxFrom) ? fxFrom : forexBase;
        const to = opts.includes(fxTo) && fxTo !== from ? fxTo : (opts.find(c => c !== from) || from);
        const priceOf = (c) => (c === forexBase ? 1 : forexRates[c]?.price);
        const amtNum = Number(String(fxAmt).replace(/\s/g, '').replace(',', '.'));
        const pf = priceOf(from), pt = priceOf(to);
        const result = Number.isFinite(amtNum) && pf > 0 && pt > 0 ? (amtNum * pf) / pt : null;
        const fmtRes = (n) => n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 2 : n >= 1 ? 4 : n >= 0.01 ? 5 : 8 });
        return (
          <>
            {list.length > 0 && (
              <div className="fx-calc">
                <input
                  type="text" inputMode="decimal" value={fxAmt} aria-label={t('Сумма')}
                  onChange={e => { setFxAmt(e.target.value); saveCalc(e.target.value, from, to); }}
                  className="fx-calc-amt"
                />
                <select value={from} onChange={e => { setFxFrom(e.target.value); saveCalc(fxAmt, e.target.value, to); }} className="hd-btn" aria-label={t('Из валюты')}>
                  {opts.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button type="button" className="hd-btn hd-icon" title={t('Поменять местами')} aria-label={t('Поменять местами')} onClick={() => { setFxFrom(to); setFxTo(from); saveCalc(fxAmt, to, from); }}>⇄</button>
                <select value={to} onChange={e => { setFxTo(e.target.value); saveCalc(fxAmt, from, e.target.value); }} className="hd-btn" aria-label={t('В валюту')}>
                  {opts.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="fx-calc-res">= {result == null ? '—' : fmtRes(result)} <b>{to}</b></span>
              </div>
            )}
            {list.length === 0 && <p style={{ opacity: 0.7 }}>{t('Валют пока нет — нажмите «Добавить», чтобы выбрать нужные.')}</p>}
            {list.length > 0 && (
              <div className={`fx-row fx-head${fxSelectMode ? ' sel' : ''}`}>
                {fxSelectMode && <span />}
                <span>{t('Тикер')}</span><span>{t('Флаг')}</span><span className="fx-name">{t('Название')}</span><span className="ar-r">{t('Цена')}</span><span className="ar-r">{t('Изменение')}</span>
              </div>
            )}
            {list.map(code => {
              const c = currencyOf(code);
              const rt = forexRates[code];
              const ch = rt?.change;
              const isSel = fxSelected.has(code);
              return (
                <div
                  key={code}
                  role="button"
                  tabIndex={0}
                  className={`fx-row${fxSelectMode ? ' sel' : ''}`}
                  style={{ cursor: 'pointer', background: isSel ? 'var(--danger-bg)' : code === active ? 'var(--input-bg)' : 'transparent' }}
                  onClick={() => (fxSelectMode ? toggleFxSelected(code) : pickFxChart(code))}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fxSelectMode ? toggleFxSelected(code) : pickFxChart(code); } }}
                >
                  {fxSelectMode && <input type="checkbox" checked={isSel} onChange={() => toggleFxSelected(code)} onClick={e => e.stopPropagation()} style={{ width: 18, height: 18 }} />}
                  <b>{code}</b>
                  <Flag cc={c.cc} width={28} />
                  <span className="fx-name">{currencyName(c, lang)}</span>
                  <span className="ar-r" style={{ fontWeight: 600 }}>{fmt(rt?.price)}</span>
                  <span className="ar-r" style={{ fontWeight: 600, color: ch == null ? 'var(--text-dim)' : ch >= 0 ? 'var(--up)' : 'var(--down)' }}>{ch == null ? '—' : `${ch >= 0 ? '+' : ''}${ch.toFixed(2).replace('.', dec)}%`}</span>
                </div>
              );
            })}
            {forexError && <p style={{ color: 'var(--danger)', fontSize: 14 }}>{t('Курсы временно недоступны — обновятся автоматически.')}</p>}
            {list.length > 0 && <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 10 }}>{t('Цена — сколько {base} стоит 1 единица валюты. Обновляется раз в 15 минут.', { base: forexBase })}</p>}
          </>
        );
      })()}

      {isCommodities && !loading && cPairs.length === 0 && <p style={{ opacity: 0.7 }}>{t('Пар пока нет — нажмите "+", чтобы добавить первую.')}</p>}
      {isCommodities && displayCPairs.map((p) => {
        const price = cPrices[p.id];
        const spark = cSparks[p.id];
        const pct = spark?.changePct;
        const pctColor = pct == null ? 'var(--text-dim)' : pct >= 0 ? 'var(--up)' : 'var(--down)';
        const isSelected = cSelected.has(p.id);
        return (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            className={`pair-row pair-grid comm-grid${cSelectMode ? ' sort-active' : ''}`}
            style={{ ...row, cursor: 'pointer', background: isSelected ? 'var(--danger-bg)' : String(p.id) === String(cChartPair?.id) ? 'var(--input-bg)' : 'transparent' }}
            onClick={(e) => cOnRowClick(e, p.id)}
            onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); cOnRowClick(e, p.id); } }}
          >
            {cSelectMode && (
              <input type="checkbox" checked={isSelected} onChange={() => cToggleSelected(p.id)} onClick={(e) => e.stopPropagation()} className="cell-order" style={{ width: 18, height: 18 }} />
            )}
            <div className="cell-icons" style={{ display: 'flex', gap: 4 }}>
              <span className="commodity-icon">{shortTickerFor(p.asset1)}</span>
              <span className="commodity-icon">{shortTickerFor(p.asset2)}</span>
            </div>
            <div className="cell-name" style={{ minWidth: 90 }}>{enLabelFor(p.asset1)}/<wbr />{enLabelFor(p.asset2)}{!cSelectMode && <a href={`/commodity-pair/${p.id}`} className="open-pair" title={t('Открыть страницу пары')} aria-label={t('Открыть страницу пары')} onClick={(e) => e.stopPropagation()}>↗</a>}</div>
            {!cSelectMode && (
              <button onClick={(e) => cSwapPair(e, p.id)} disabled={cSwappingId === p.id} className="cell-swap" style={swapBtn} title={t('Поменять местами')}>
                {cSwappingId === p.id ? '…' : '⇄'}
              </button>
            )}
            <div className="cell-price" style={cell}><PriceValue value={price?.price1} /></div>
            <div className="cell-price second" style={cell}><PriceValue value={price?.price2} /></div>
            <div className="cell-ratio" style={{ ...cell, fontWeight: 600 }}>{price?.ratio ? price.ratio.toFixed(8) : '—'}</div>
            <div className="cell-pct" style={{ minWidth: 56, textAlign: 'right', fontWeight: 600, fontSize: 16, color: pctColor }}>
              {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', dec)}%` : '—'}
            </div>
          </div>
        );
      })}
    </div>
    <aside className="side-panel">
      {isCrypto && <section className="side-chart spot-chart">
        <CrossChart endpoint="/api/klines" pairId={chartPair?.id} sig={chartPair ? `${chartPair.asset1}:${chartPair.exchange1}:${chartPair.asset2}:${chartPair.exchange2}` : ''} title={chartPair ? `${chartPair.asset1}/${chartPair.asset2}` : ''} />
      </section>}
      {isAssets && <section className="side-chart"><AssetChart symbol={chartAsset?.symbol} name={chartAsset?.name} /></section>}
      {isAssets && (() => {
        const st = chartAsset ? assetStats[chartAsset.ext ? chartAsset.asset_id : String(chartAsset.symbol || '').toUpperCase()] : null;
        const algo = chartAsset ? ALGOS[String(chartAsset.symbol || '').toUpperCase()] : null;
        const full = (v) => (v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 }));
        return (
          <div className="side-col3">
            <section className="side-info">
              {!chartAsset ? <div className="si-empty">{t('Выберите монету')}</div> : (
                <>
                  <div className="si-head"><b>{chartAsset.symbol}</b><span>{chartAsset.name}</span></div>
                  <div className="si-row"><span>Market cap</span><b>{st?.marketCap == null ? '—' : '$' + Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(st.marketCap)}</b></div>
                  <div className="si-row"><span>Circulating supply</span><b>{full(st?.circulating)}</b></div>
                  <div className="si-row"><span>Max supply</span><b>{st ? (st.max == null ? '∞' : full(st.max)) : '—'}</b></div>
                  {st?.max > 0 && st?.circulating > 0 && <div className="si-row"><span>Issued</span><b>{(st.circulating / st.max * 100).toFixed(1).replace('.', dec)}%</b></div>}
                  <div className="si-row"><span>Algorithm</span><b>{algo || '—'}</b></div>
                </>
              )}
            </section>
            <section className="side-news"><div className="side-title">{t('Новости')}</div><NewsFeed key="crypto" /></section>
          </div>
        );
      })()}
      {isCommodities && <section className="side-chart"><TvChart symbols={cChartSymbols} /></section>}
      {isForex && (() => {
        const list = forexCodes.filter(c => c !== forexBase);
        const active = fxChartCode && list.includes(fxChartCode) ? fxChartCode : list[0];
        return active ? <section className="side-chart"><TvChart symbols={[`FX_IDC:${active}${forexBase}`]} /></section> : null;
      })()}
      {isPool && <section className="side-chart"><PoolChart pool={poolForChart} /></section>}
      {isForex ? (
        <section className="side-news">
          <div className="side-title side-tabs">
            <button className={sideView === 'news' ? 'active' : ''} onClick={() => setSideView('news')}>{t('Новости')}</button>
            <button className={sideView === 'cal' ? 'active' : ''} onClick={() => setSideView('cal')}>{t('Календарь')}</button>
          </div>
          {sideView === 'cal' ? <div className="cal-box"><TvCalendar /></div> : <NewsFeed key="fx" kind="fx" />}
        </section>
      ) : isAssets ? null : (
        <section className="side-news"><div className="side-title">{t('Новости')}</div>{isCommodities ? <NewsFeed key="com" kind="com" /> : isPool ? <NewsFeed key="pool" kind="pool" /> : <NewsFeed key="crypto" />}</section>
      )}
    </aside>
    </>)}
    </div>
  );
}

const row = {
  display: 'flex', alignItems: 'center', gap: 14, padding: '9px 6px', flexWrap: 'wrap',
  borderBottom: '1px solid var(--card-border)', textDecoration: 'none', color: 'var(--text)',
  borderRadius: 6,
};
function Pct({ v }) {
  const { lang } = useLang();
  const dec = lang === 'en' ? '.' : ',';
  if (v == null || !Number.isFinite(v)) return <span style={{ color: 'var(--text-dim)' }}>—</span>;
  const a = Math.abs(v);
  const txt = a >= 1e4 ? `${Math.round(v / 1e3)}K%` : a >= 1000 ? `${Math.round(v)}%` : `${v.toFixed(a >= 100 ? 0 : 1).replace('.', dec)}%`;
  return <span style={{ fontWeight: 600, color: v >= 0 ? 'var(--up)' : 'var(--down)' }}>{v >= 0 ? '+' : ''}{txt}</span>;
}
function fmtSupply(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  const f = (x, u) => `${x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)}${u}`;
  if (n >= 1e12) return f(n / 1e12, 'T');
  if (n >= 1e9) return f(n / 1e9, 'B');
  if (n >= 1e6) return f(n / 1e6, 'M');
  if (n >= 1e3) return f(n / 1e3, 'K');
  return n.toFixed(0);
}
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
  padding: '8px 10px', borderRadius: 8, border: '1px solid var(--input-border)',
  background: 'var(--bg-elevated)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer',
  boxShadow: 'inset 0 -2px 0 var(--accent)',
};
const tabInactive = {
  padding: '8px 10px', borderRadius: 8, border: '1px solid var(--input-border)',
  background: 'none', color: 'var(--text-dim)', cursor: 'pointer',
};
