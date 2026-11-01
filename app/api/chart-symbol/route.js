import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Для монеты находим, где брать график: TradingView-тикер на OKX / Coinbase / KuCoin, иначе главный DEX-пул (DexScreener).
const STABLES = new Set(['USDT', 'USDC', 'DAI', 'USDE', 'FDUSD', 'TUSD', 'USDS', 'PYUSD', 'USDD', 'GUSD', 'BUSD', 'USDP', 'FRAX', 'LUSD', 'USD1', 'USDG', 'RLUSD', 'USDY', 'USDX']);
const TTL = 6 * 60 * 60 * 1000;

// Списки бирж меняются редко — кэшируем на уровне Next (общий для всех экземпляров сервера), а не только в памяти
async function getJson(url, ms = 5000, revalidate = 0) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...(revalidate ? { next: { revalidate } } : { cache: 'no-store' }), signal: ctl.signal, headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; AltTracker/1.0)' } });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(t); }
}

const EXCHANGES = [
  // Binance первым: как в Spot (там шапка виджета короткая). data-api.binance.vision — публичное зеркало без блокировок по региону
  { name: 'Binance', tv: (s) => `BINANCE:${s}USDT`, load: async () => new Set((await getJson('https://data-api.binance.vision/api/v3/ticker/price', 8000, TTL / 1000)).filter(x => /USDT$/.test(x.symbol)).map(x => x.symbol.slice(0, -4).toUpperCase())) },
  { name: 'OKX', tv: (s) => `OKX:${s}USDT`, load: async () => new Set((await getJson('https://www.okx.com/api/v5/public/instruments?instType=SPOT', 6000, TTL / 1000)).data.filter(x => x.state === 'live' && x.quoteCcy === 'USDT').map(x => String(x.baseCcy).toUpperCase())) },
  { name: 'Coinbase', tv: (s) => `COINBASE:${s}USD`, load: async () => new Set((await getJson('https://api.exchange.coinbase.com/products', 6000, TTL / 1000)).filter(x => x.status === 'online' && x.quote_currency === 'USD').map(x => String(x.base_currency).toUpperCase())) },
  { name: 'KuCoin', tv: (s) => `KUCOIN:${s}USDT`, load: async () => new Set((await getJson('https://api.kucoin.com/api/v2/symbols', 6000, TTL / 1000)).data.filter(x => x.enableTrading && x.quoteCurrency === 'USDT').map(x => String(x.baseCurrency).toUpperCase())) },
];
const lists = new Map(); // name -> { ts, set }
async function listFor(ex) {
  const hit = lists.get(ex.name);
  if (hit && Date.now() - hit.ts < TTL) return hit.set;
  try {
    const set = await ex.load();
    if (set.size) { lists.set(ex.name, { ts: Date.now(), set }); return set; }
  } catch {}
  return hit?.set || null;
}

const answers = new Map(); // SYMBOL -> { ts, value }
async function resolve(sym) {
  if (STABLES.has(sym)) return { kind: 'stable' };
  // списки всех бирж грузим параллельно, дальше выбираем по приоритету (Binance, OKX, Coinbase, KuCoin)
  const sets = await Promise.all(EXCHANGES.map(listFor));
  let anyList = false;
  for (let i = 0; i < EXCHANGES.length; i++) {
    if (!sets[i]) continue;
    anyList = true;
    if (sets[i].has(sym)) return { kind: 'tv', symbol: EXCHANGES[i].tv(sym) };
  }
  if (!anyList) return { kind: 'tv', symbol: `BINANCE:${sym}USDT` }; // биржи недоступны — пробуем самый ходовой вариант
  try {
    const j = await getJson(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(sym)}`, 5000);
    const hit = (j?.pairs || [])
      .filter(p => String(p?.baseToken?.symbol || '').toUpperCase() === sym && /^[a-z0-9_-]+$/i.test(p.chainId || '') && /^[A-Za-z0-9]+$/.test(p.pairAddress || ''))
      .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    if (hit) return { kind: 'dex', chain: hit.chainId, pair: hit.pairAddress, name: `${hit.baseToken.symbol}/${hit.quoteToken?.symbol || ''}`, dex: hit.dexId || '' };
  } catch {}
  return { kind: 'none' };
}

export async function GET(req) {
  const sym = String(new URL(req.url).searchParams.get('s') || '').toUpperCase();
  if (!/^[A-Z0-9]{1,15}$/.test(sym)) return NextResponse.json({ kind: 'none' }, { status: 400 });
  const hit = answers.get(sym);
  if (hit && Date.now() - hit.ts < TTL) return NextResponse.json(hit.value);
  const value = await resolve(sym);
  if (value.kind !== 'none') answers.set(sym, { ts: Date.now(), value });
  return NextResponse.json(value, { headers: { 'Cache-Control': 'no-store' } });
}
