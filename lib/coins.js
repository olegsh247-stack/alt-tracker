// Данные по монетам: основной источник — CoinGecko, запасной — CoinPaprika (оба без ключа).
// Ключи монет: "cg:<id CoinGecko>" или "pp:<id CoinPaprika>", для монет старого списка — их asset_id.

const TOP = 500;

async function getJson(url, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(t); }
}

// ───── CoinPaprika: один запрос — все монеты с рейтингом, предложением, ценой и изменением ─────
let ppCache = null; // { ts, rows }
let ppInflight = null;
async function paprikaAll() {
  if (ppCache && Date.now() - ppCache.ts < 3 * 60 * 1000) return ppCache.rows;
  if (!ppInflight) {
    ppInflight = getJson('https://api.coinpaprika.com/v1/tickers?quotes=USD', 15000)
      .then(j => {
        const rows = (Array.isArray(j) ? j : [])
          .filter(c => c && c.id && c.symbol && c.rank > 0)
          .map(c => ({
            id: c.id, symbol: String(c.symbol).toUpperCase(), name: c.name, rank: c.rank,
            circulating: num(c.circulating_supply), max: num(c.max_supply) || null, marketCap: num(c.quotes?.USD?.market_cap),
            change24h: num(c.quotes?.USD?.percent_change_24h), change30d: num(c.quotes?.USD?.percent_change_30d), change1y: num(c.quotes?.USD?.percent_change_1y), price: num(c.quotes?.USD?.price),
          }))
          .sort((a, b) => a.rank - b.rank);
        if (rows.length === 0) throw new Error('пусто');
        ppCache = { ts: Date.now(), rows };
        return rows;
      })
      .finally(() => { ppInflight = null; });
  }
  try { return await ppInflight; } catch (e) { if (ppCache) return ppCache.rows; throw e; }
}
const num = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const stat = (c) => ({ rank: c.rank ?? null, circulating: c.circulating ?? null, max: c.max ?? null, marketCap: c.marketCap ?? null, change24h: c.change24h ?? null, change30d: c.change30d ?? null, change1y: c.change1y ?? null, price: c.price ?? null });

// ───── Список монет для выбора ─────
export async function loadCoinList() {
  try {
    const rows = [];
    for (let n = 1; n <= Math.ceil(TOP / 250); n++) {
      rows.push(...await getJson(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${n}`));
    }
    const coins = rows.slice(0, TOP).map(c => ({ id: `cg:${c.id}`, symbol: String(c.symbol || '').toUpperCase(), name: c.name, rank: c.market_cap_rank ?? null }));
    if (coins.length) return { coins, source: 'coingecko' };
  } catch {}
  const all = await paprikaAll();
  return { coins: all.slice(0, TOP).map(c => ({ id: `pp:${c.id}`, symbol: c.symbol, name: c.name, rank: c.rank })), source: 'coinpaprika' };
}

// ───── Статистика ─────
async function cgRows(query) {
  const rows = await getJson(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&${query}&price_change_percentage=24h,30d,1y&per_page=250&page=1`);
  return Array.isArray(rows) ? rows : [];
}
const cgStat = (c) => ({
  rank: c.market_cap_rank ?? null, circulating: c.circulating_supply ?? null, max: c.max_supply ?? null, marketCap: c.market_cap ?? null,
  change24h: c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? null,
  change30d: c.price_change_percentage_30d_in_currency ?? null, change1y: c.price_change_percentage_1y_in_currency ?? null,
  price: c.current_price ?? null,
});

// symbols: ['BTC', …] -> ключ = тикер; items: [{ key: 'cg:bitcoin', symbol: 'BTC' }] -> ключ = key
export async function loadStats(symbols, items) {
  const out = {};
  let cgOk = true;
  try {
    if (symbols.length) {
      for (const c of await cgRows(`symbols=${symbols.map(s => s.toLowerCase()).join(',')}`)) {
        const sym = String(c.symbol || '').toUpperCase();
        if (out[sym] && (out[sym].rank ?? Infinity) <= (c.market_cap_rank ?? Infinity)) continue; // тикер у нескольких монет — берём старшую по рейтингу
        out[sym] = cgStat(c);
      }
    }
    const cgItems = items.filter(i => i.key.startsWith('cg:'));
    if (cgItems.length) for (const c of await cgRows(`ids=${cgItems.map(i => i.key.slice(3)).join(',')}`)) out[`cg:${c.id}`] = cgStat(c);
  } catch { cgOk = false; }

  const missingSyms = symbols.filter(s => !out[s]);
  const missingItems = items.filter(i => !out[i.key]);
  if (!cgOk || missingSyms.length || missingItems.length) {
    try {
      const all = await paprikaAll();
      const bySym = new Map();
      for (const c of all) if (!bySym.has(c.symbol)) bySym.set(c.symbol, c); // all отсортирован по рейтингу
      const byId = new Map(all.map(c => [c.id, c]));
      for (const s of missingSyms) if (bySym.has(s)) out[s] = stat(bySym.get(s));
      for (const i of missingItems) {
        const c = i.key.startsWith('pp:') ? byId.get(i.key.slice(3)) : bySym.get(i.symbol);
        if (c) out[i.key] = stat(c);
      }
    } catch {
      if (!cgOk) throw new Error('нет данных');
    }
  }
  return out;
}

// Актуальные цены с Binance (зеркало data-api.binance.vision, без региональных блокировок) — как на графике справа.
let bnCache = null;
let bnInflight = null;
export async function binancePrices() {
  if (bnCache && Date.now() - bnCache.ts < 20 * 1000) return bnCache.map;
  if (!bnInflight) {
    bnInflight = getJson('https://data-api.binance.vision/api/v3/ticker/price', 10000)
      .then(rows => {
        const map = {};
        for (const r of Array.isArray(rows) ? rows : []) if (/USDT$/.test(r.symbol) && Number(r.price) > 0) map[r.symbol.slice(0, -4)] = Number(r.price);
        bnCache = { ts: Date.now(), map };
        return map;
      })
      .finally(() => { bnInflight = null; });
  }
  try { return await bnInflight; } catch { return bnCache?.map || {}; }
}
