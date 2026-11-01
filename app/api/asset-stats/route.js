import { NextResponse } from 'next/server';
import { loadStats } from '../../../lib/coins';

export const dynamic = 'force-dynamic';

// Рейтинг, предложение, изменение за 24ч и цена для списка монет (CoinGecko, при сбое — CoinPaprika).
// s=BTC,ETH — по тикерам (ключ ответа = тикер); ids=cg:bitcoin~BTC,pp:btc-bitcoin~BTC — по ключам (ключ ответа = ключ).
const TTL = 3 * 60 * 1000;
const cache = new Map(); // key -> { ts, data }

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const symbols = [...new Set(String(sp.get('s') || '').toUpperCase().split(',').filter(s => /^[A-Z0-9]{1,15}$/.test(s)))].sort().slice(0, 100);
  const items = [...new Set(String(sp.get('ids') || '').split(',').filter(s => /^(cg|pp):[a-z0-9._-]{1,80}~[A-Za-z0-9]{1,15}$/i.test(s)))].sort().slice(0, 100)
    .map(s => { const [key, sym] = s.split('~'); return { key: key.toLowerCase(), symbol: sym.toUpperCase() }; });
  if (symbols.length === 0 && items.length === 0) return NextResponse.json({ stats: {} });
  const key = `${symbols.join(',')}|${items.map(i => `${i.key}~${i.symbol}`).join(',')}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return NextResponse.json({ stats: hit.data });
  try {
    const data = await loadStats(symbols, items);
    cache.set(key, { ts: Date.now(), data });
    return NextResponse.json({ stats: data });
  } catch {
    if (hit) return NextResponse.json({ stats: hit.data, stale: true });
    return NextResponse.json({ stats: {}, error: true }, { status: 502 });
  }
}
