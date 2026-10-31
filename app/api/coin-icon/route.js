import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Значок монеты, которой нет в основном источнике (CoinCap): берём логотип из DexScreener, затем CoinGecko.
// Результат помним в памяти (в том числе «не нашли»), а браузеру и CDN разрешаем кэшировать на сутки.
const cache = new Map(); // SYMBOL -> { url|null, ts }
const TTL = 24 * 60 * 60 * 1000;

async function getJson(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(t); }
}

async function findIcon(sym) {
  try {
    const j = await getJson(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(sym)}`);
    const hit = (j?.pairs || [])
      .filter(p => String(p?.baseToken?.symbol || '').toUpperCase() === sym && /^https:\/\//.test(p?.info?.imageUrl || ''))
      .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    if (hit) return hit.info.imageUrl;
  } catch {}
  try {
    const j = await getJson(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(sym)}`);
    const c = (j?.coins || []).find(x => String(x.symbol || '').toUpperCase() === sym && /^https:\/\//.test(x.large || x.thumb || ''));
    if (c) return c.large || c.thumb;
  } catch {}
  return null;
}

export async function GET(req) {
  const sym = String(new URL(req.url).searchParams.get('s') || '').toUpperCase();
  if (!/^[A-Z0-9._-]{1,15}$/.test(sym)) return new NextResponse(null, { status: 400 });
  let hit = cache.get(sym);
  if (!hit || Date.now() - hit.ts > TTL) {
    hit = { url: await findIcon(sym), ts: Date.now() };
    cache.set(sym, hit);
  }
  if (!hit.url) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'public, s-maxage=3600' } });
  return NextResponse.redirect(hit.url, { status: 302, headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } });
}
