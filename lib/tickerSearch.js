// Кэш всех торгуемых USDT-пар с 4 бирж — для быстрого поиска "по мере ввода" на странице добавления пары.
// Обновляется не чаще раза в TTL, чтобы не долбить биржи на каждый символ, который печатает пользователь.

let cache = { rows: [], ts: 0 };
const TTL_MS = 45 * 1000;
let refreshing = null; // промис текущего обновления, чтобы не запускать параллельно несколько раз

async function fetchBinance() {
  const r = await fetch('https://api.binance.com/api/v3/ticker/24hr');
  const d = await r.json();
  if (!Array.isArray(d)) return [];
  return d
    .filter(t => typeof t.symbol === 'string' && t.symbol.endsWith('USDT') && t.symbol.length > 4)
    .map(t => ({
      asset: t.symbol.slice(0, -4),
      exchange: 'BINANCE',
      price: parseFloat(t.lastPrice),
      changePct: parseFloat(t.priceChangePercent),
    }))
    .filter(t => t.price > 0 && Number.isFinite(t.changePct));
}

async function fetchBybit() {
  const r = await fetch('https://api.bybit.com/v5/market/tickers?category=spot');
  const d = await r.json();
  const list = d?.result?.list;
  if (!Array.isArray(list)) return [];
  return list
    .filter(t => typeof t.symbol === 'string' && t.symbol.endsWith('USDT') && t.symbol.length > 4)
    .map(t => ({
      asset: t.symbol.slice(0, -4),
      exchange: 'BYBIT',
      price: parseFloat(t.lastPrice),
      // price24hPcnt приходит как доля (0.012 = 1.2%)
      changePct: parseFloat(t.price24hPcnt) * 100,
    }))
    .filter(t => t.price > 0 && Number.isFinite(t.changePct));
}

async function fetchOkx() {
  const r = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT');
  const d = await r.json();
  const list = d?.data;
  if (!Array.isArray(list)) return [];
  return list
    .filter(t => typeof t.instId === 'string' && t.instId.endsWith('-USDT'))
    .map(t => {
      const price = parseFloat(t.last);
      const open = parseFloat(t.open24h);
      const changePct = open > 0 ? ((price - open) / open) * 100 : 0;
      return { asset: t.instId.slice(0, -5), exchange: 'OKX', price, changePct };
    })
    .filter(t => t.price > 0 && Number.isFinite(t.changePct));
}

async function fetchMexc() {
  const r = await fetch('https://api.mexc.com/api/v3/ticker/24hr');
  const d = await r.json();
  if (!Array.isArray(d)) return [];
  return d
    .filter(t => typeof t.symbol === 'string' && t.symbol.endsWith('USDT') && t.symbol.length > 4)
    .map(t => ({
      asset: t.symbol.slice(0, -4),
      exchange: 'MEXC',
      price: parseFloat(t.lastPrice),
      changePct: parseFloat(t.priceChangePercent),
    }))
    .filter(t => t.price > 0 && Number.isFinite(t.changePct));
}

async function refreshCache() {
  const results = await Promise.allSettled([fetchBinance(), fetchBybit(), fetchOkx(), fetchMexc()]);
  const rows = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
  cache = { rows, ts: Date.now() };
  return rows;
}

async function ensureFresh() {
  if (Date.now() - cache.ts < TTL_MS) return cache.rows;
  if (!refreshing) {
    refreshing = refreshCache().finally(() => { refreshing = null; });
  }
  return refreshing;
}

// query — то, что ввёл пользователь (например "EL"); возвращает совпадения по началу тикера
export async function searchTickers(query) {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const rows = await ensureFresh();
  return rows
    .filter(t => t.asset.startsWith(q))
    .sort((a, b) => (a.asset === b.asset ? a.exchange.localeCompare(b.exchange) : a.asset.localeCompare(b.asset)))
    .slice(0, 60);
}
