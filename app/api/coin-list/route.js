import { NextResponse } from 'next/server';
import { loadCoinList } from '../../../lib/coins';

export const dynamic = 'force-dynamic';

// Список монет для выбора в Assets: топ-500 (CoinGecko, при сбое — CoinPaprika). Кэш в памяти на 6 часов.
const TTL = 6 * 60 * 60 * 1000;
let cache = null;
let inflight = null;

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) return NextResponse.json({ coins: cache.v.coins, source: cache.v.source });
  if (!inflight) inflight = loadCoinList().then(v => { cache = { ts: Date.now(), v }; return v; }).finally(() => { inflight = null; });
  try {
    const v = await inflight;
    return NextResponse.json({ coins: v.coins, source: v.source }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
  } catch {
    if (cache) return NextResponse.json({ coins: cache.v.coins, source: cache.v.source, stale: true });
    return NextResponse.json({ coins: [], error: true }, { status: 502 });
  }
}
