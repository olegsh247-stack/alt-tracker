import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Рейтинг, предложение, изменение за 24ч и цена для списка монет — одним запросом к CoinGecko (без ключа).
// Общий кэш в памяти на 3 минуты, при сбое отдаём прошлые данные.
const TTL = 3 * 60 * 1000;
const cache = new Map(); // key(sorted symbols) -> { ts, data }

async function load(symbols) {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&symbols=${symbols.map(s => s.toLowerCase()).join(',')}&price_change_percentage=24h&per_page=250&page=1`;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(String(r.status));
    const rows = await r.json();
    const out = {};
    for (const c of Array.isArray(rows) ? rows : []) {
      const sym = String(c.symbol || '').toUpperCase();
      const rank = c.market_cap_rank ?? Infinity;
      // одинаковые тикеры у разных монет — берём ту, что выше в рейтинге
      if (out[sym] && (out[sym].rank ?? Infinity) <= rank) continue;
      out[sym] = {
        rank: c.market_cap_rank ?? null,
        circulating: c.circulating_supply ?? null,
        max: c.max_supply ?? null,
        change24h: c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? null,
        price: c.current_price ?? null,
      };
    }
    return out;
  } finally { clearTimeout(t); }
}

export async function GET(req) {
  const symbols = [...new Set(String(new URL(req.url).searchParams.get('s') || '').toUpperCase().split(',').filter(s => /^[A-Z0-9]{1,15}$/.test(s)))].sort().slice(0, 60);
  if (symbols.length === 0) return NextResponse.json({ stats: {} });
  const key = symbols.join(',');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return NextResponse.json({ stats: hit.data });
  try {
    const data = await load(symbols);
    cache.set(key, { ts: Date.now(), data });
    return NextResponse.json({ stats: data });
  } catch {
    if (hit) return NextResponse.json({ stats: hit.data, stale: true });
    return NextResponse.json({ stats: {}, error: true }, { status: 502 });
  }
}
