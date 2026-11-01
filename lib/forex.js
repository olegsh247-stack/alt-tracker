// Курсы валют. Основной источник — Yahoo Finance (внутри дня), запасной — open.er-api.com (сутки) + вчерашний курс из currency-api (jsDelivr).
// Для каждой валюты храним «сколько её за 1 USD» сейчас и на закрытии предыдущего дня; любую базу считаем через доллар.

const TTL = 15 * 60 * 1000;
const perUsd = new Map(); // CODE -> { ts, now, prev }
let fallback = null;      // { ts, now: {CODE: n}, prev: {CODE: n}|null }
let fbInflight = null;

async function getJson(url, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctl.signal, headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; AltTracker/1.0)' } });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(t); }
}

async function yahoo(code) {
  const j = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${code}=X?range=5d&interval=1d`);
  const res = j?.chart?.result?.[0];
  const closes = (res?.indicators?.quote?.[0]?.close || []).filter(v => v != null && v > 0);
  const now = res?.meta?.regularMarketPrice ?? closes[closes.length - 1];
  if (!(now > 0)) throw new Error('нет курса');
  const prev = closes.length >= 2 ? closes[closes.length - 2] : null;
  return { now, prev };
}

async function loadFallback() {
  if (fallback && Date.now() - fallback.ts < 60 * 60 * 1000) return fallback;
  if (!fbInflight) {
    fbInflight = (async () => {
      const cur = await getJson('https://open.er-api.com/v6/latest/USD');
      const now = cur?.rates;
      if (!now || !now.EUR) throw new Error('нет курсов');
      let prev = null;
      try {
        const d = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
        const p = await getJson(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${d}/v1/currencies/usd.json`);
        const raw = p?.usd || {};
        prev = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toUpperCase(), v]));
      } catch {}
      fallback = { ts: Date.now(), now, prev };
      return fallback;
    })().finally(() => { fbInflight = null; });
  }
  try { return await fbInflight; } catch (e) { if (fallback) return fallback; throw e; }
}

async function perUsdFor(code) {
  if (code === 'USD') return { now: 1, prev: 1 };
  const hit = perUsd.get(code);
  if (hit && Date.now() - hit.ts < TTL) return hit;
  let v = null;
  try { v = await yahoo(code); } catch {}
  if (!v) {
    try {
      const fb = await loadFallback();
      if (fb.now[code] > 0) v = { now: fb.now[code], prev: fb.prev?.[code] > 0 ? fb.prev[code] : null };
    } catch {}
  }
  if (!v) return hit || null;
  const entry = { ts: Date.now(), ...v };
  perUsd.set(code, entry);
  return entry;
}

// Для базы B и списка валют: цена 1 единицы валюты X в базе B и изменение за сутки в %.
export async function getRates(base, codes) {
  const need = [...new Set([base, ...codes])];
  const data = Object.fromEntries(await Promise.all(need.map(async c => [c, await perUsdFor(c)])));
  const b = data[base];
  const out = {};
  if (!b) return out;
  for (const x of codes) {
    const d = data[x];
    if (!d || x === base) continue;
    const price = b.now / d.now;
    const prevPrice = b.prev && d.prev ? b.prev / d.prev : null;
    out[x] = { price, change: prevPrice ? (price / prevPrice - 1) * 100 : null };
  }
  return out;
}
