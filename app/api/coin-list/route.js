import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Список монет для выбора в Assets: топ-500 по капитализации (CoinGecko, без ключа, 2 страницы по 250).
// Кэш в памяти на 6 часов, при сбое отдаём прошлый список.
const TOP = 500;
const TTL = 6 * 60 * 60 * 1000;
let cache = null;
let inflight = null;

async function page(n) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${n}`, { cache: 'no-store', signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(t); }
}

async function load() {
  const rows = [];
  for (let n = 1; n <= Math.ceil(TOP / 250); n++) rows.push(...(await page(n)));
  const coins = rows.slice(0, TOP).map(c => ({ id: c.id, symbol: String(c.symbol || '').toUpperCase(), name: c.name, rank: c.market_cap_rank ?? null }));
  if (coins.length === 0) throw new Error('пусто');
  return coins;
}

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) return NextResponse.json({ coins: cache.coins });
  if (!inflight) inflight = load().then(coins => { cache = { ts: Date.now(), coins }; return coins; }).finally(() => { inflight = null; });
  try {
    return NextResponse.json({ coins: await inflight }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
  } catch {
    if (cache) return NextResponse.json({ coins: cache.coins, stale: true });
    return NextResponse.json({ coins: [], error: true }, { status: 502 });
  }
}
