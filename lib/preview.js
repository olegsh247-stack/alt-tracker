import { loadStats, binancePrices } from './coins';
import { getPriceRaw } from './exchanges';
import { getDefaultPools } from './pools';
import { getCommodityQuote, enLabelFor } from './commodities';
import { getRates } from './forex';

// Публичное превью для главной страницы (без входа): по мини-таблице на каждый раздел.
// Каждая секция грузится отдельно: если источник недоступен, секция просто пустая (null).
const TTL = 5 * 60 * 1000;
let cache = null;
let inflight = null;

const ASSET_SYMS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];
const SPOT_COINS = ['BTC', 'ETH', 'SOL'];
const COMMODITY_KEYS = ['gold', 'silver', 'crude-wti', 'natgas'];
const FOREX = ['EUR', 'GBP', 'JPY', 'RUB'];

async function assets() {
  const [stats, bn] = await Promise.all([loadStats(ASSET_SYMS, []), binancePrices().catch(() => ({}))]);
  const rows = ASSET_SYMS.map(sym => stats[sym] ? { symbol: sym, rank: stats[sym].rank, price: bn[sym] ?? stats[sym].price, change: stats[sym].change24h } : null).filter(Boolean);
  if (!rows.length) throw new Error('пусто');
  return rows;
}
async function spot() {
  const rows = await Promise.all(SPOT_COINS.map(async coin => {
    const [a, b] = await Promise.allSettled([getPriceRaw('BINANCE', coin), getPriceRaw('OKX', coin)]);
    if (a.status !== 'fulfilled' || b.status !== 'fulfilled') return null;
    const p1 = Number(a.value), p2 = Number(b.value);
    return { coin, ex1: 'Binance', p1, ex2: 'OKX', p2, diff: p1 > 0 ? (p2 / p1 - 1) * 100 : null };
  }));
  const ok = rows.filter(Boolean);
  if (!ok.length) throw new Error('пусто');
  return ok;
}
async function pools() {
  const res = await Promise.allSettled([getDefaultPools('eth'), getDefaultPools('solana')]);
  const rows = res.flatMap((r, i) => (r.status === 'fulfilled' ? r.value.map(p => ({ network: i === 0 ? 'Ethereum' : 'Solana', base: p.base, quote: p.quote, dex: p.dex, feePct: p.feePct ?? null, apr: p.apr ?? null, tvl: p.tvl ?? null })) : []));
  if (!rows.length) throw new Error('пусто');
  return rows;
}
async function commodities() {
  const rows = (await Promise.allSettled(COMMODITY_KEYS.map(async k => ({ name: enLabelFor(k), ...(await getCommodityQuote(k)) })))).filter(r => r.status === 'fulfilled').map(r => r.value);
  if (!rows.length) throw new Error('пусто');
  return rows;
}
async function forex() {
  const rates = await getRates('USD', FOREX);
  const rows = FOREX.filter(c => rates[c]).map(c => ({ code: c, price: rates[c].price, change: rates[c].change }));
  if (!rows.length) throw new Error('пусто');
  return rows;
}

async function build() {
  const names = ['assets', 'spot', 'pools', 'commodities', 'forex'];
  const res = await Promise.allSettled([assets(), spot(), pools(), commodities(), forex()]);
  const out = { updatedAt: Date.now() };
  res.forEach((r, i) => { out[names[i]] = r.status === 'fulfilled' ? r.value : null; });
  return out;
}

export async function getPreview() {
  if (cache && Date.now() - cache.ts < TTL) return cache.value;
  if (!inflight) inflight = build().then(v => { cache = { ts: Date.now(), value: v }; return v; }).finally(() => { inflight = null; });
  return inflight;
}
