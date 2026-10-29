// Данные о пулах ликвидности — GeckoTerminal (бесплатно, без ключа, лимит маленький → кэшируем),
// при отказе — запасной источник DexScreener (бесплатно, без ключа).
const BASE = 'https://api.geckoterminal.com/api/v2';
const SEARCH_TTL = 3 * 60 * 1000;
const SEARCH_STALE = 30 * 60 * 1000;
const STATS_TTL = 45 * 1000;
// Известные адреса основных монет: по ним берём самые ликвидные пулы токена, а не поиск по названию.
// ETH/BNB/SOL на DEX — это обёрнутые WETH/WBNB/wSOL.
const KNOWN = {
  eth: {
    ETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  },
  bsc: {
    BNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    USDT: '0x55d398326f99059fF775485246999027B3197955', USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    BTCB: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
  },
  arbitrum: {
    ETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',
  },
  base: {
    ETH: '0x4200000000000000000000000000000000000006', WETH: '0x4200000000000000000000000000000000000006',
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', CBBTC: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
  },
  solana: {
    SOL: 'So11111111111111111111111111111111111111112', WSOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  },
};
const STABLES = new Set(['USDC', 'USDT', 'DAI', 'USDS', 'FDUSD', 'USDE', 'PYUSD', 'USD1', 'BUSD', 'TUSD', 'USDC.E', 'USDBC', 'USDT0', 'LUSD', 'FRAX']);
// Площадки, которые не показываем в поиске (по желанию пользователя): закрытые, умершие или без объёма.
// Уже добавленные в избранное пулы этих площадок остаются в избранном.
const EXCLUDED_DEX = [
  /curve/i,
  /lifinity/i,                // Solana: закрывается
  /phoenix/i,                 // Solana: сильно просел
  /biswap/i, /ape\s*swap/i, /bakery/i, /baby\s*swap/i, /nomi\s*swap/i,  // BNB: минимальный объём
  /ramses/i,                  // Arbitrum: TVL и объём почти нулевые
  /base\s*swap/i, /alien\s*base/i,     // Base: сильно упали
];
const isExcludedDex = (r) => {
  const t = `${r.family || ''} ${r.dex || ''} ${r.dexId || ''}`;
  if (EXCLUDED_DEX.some(re => re.test(t))) return true;
  return r.network === 'arbitrum' && /trader\s*-?\s*joe/i.test(t); // Arbitrum: Trader Joe маргинальный
};
const searchCache = new Map();
const statsCache = new Map();

// Грузим несколько страниц параллельно (по 20 пулов); если первая страница не пришла — это ошибка,
// если не пришли следующие (например, лимит запросов) — отдаём то, что есть
const PAGES = 3;
async function gtPages(pathForPage) {
  const res = await Promise.allSettled(Array.from({ length: PAGES }, (_, i) => gt(pathForPage(i + 1))));
  if (res[0].status === 'rejected') throw res[0].reason;
  return res.filter(r => r.status === 'fulfilled').map(r => r.value);
}

// Запросы к GeckoTerminal: бесплатный лимит ~30/мин на адрес, поэтому
//  • ограничитель (не больше GT_LIMIT запросов в минуту, остальные ждут до нескольких секунд),
//  • повтор при 429/5xx/сетевой ошибке (с паузой по Retry-After),
//  • кэш ответов и объединение одинаковых одновременных запросов,
//  • если источник отказал — отдаём последний сохранённый ответ (до 15 минут), а не ошибку.
const GT_LIMIT = 26;
const GT_FRESH = 2 * 60 * 1000;
const GT_FRESH_STATS = 40 * 1000;
const GT_STALE = 15 * 60 * 1000;
const gtCalls = [];
const gtCache = new Map();
const gtInflight = new Map();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function gtThrottle() {
  for (;;) {
    const now = Date.now();
    while (gtCalls.length && now - gtCalls[0] > 60000) gtCalls.shift();
    if (gtCalls.length < GT_LIMIT) { gtCalls.push(now); return; }
    const wait = 60000 - (now - gtCalls[0]) + 50;
    if (wait > 7000) throw new Error('GeckoTerminal: лимит запросов');
    await sleep(wait);
  }
}

// После ответа 429 несколько секунд не трогаем GeckoTerminal вообще (повторы только усугубляют),
// а данные в это время берём из запасного источника DexScreener.
let gtCooldownUntil = 0;
async function gtRaw(path, attempts = 3, timeoutMs = 10000) {
  let lastErr;
  if (Date.now() < gtCooldownUntil) {
    const e = new Error('GeckoTerminal 429 (пауза)');
    e.status = 429; e.noRetry = true;
    throw e;
  }
  for (let attempt = 0; attempt < attempts; attempt++) {
    await gtThrottle();
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(BASE + path, { headers: { Accept: 'application/json;version=20230302' }, cache: 'no-store', signal: ctl.signal });
      if (r.ok) return await r.json();
      lastErr = new Error(`GeckoTerminal ${r.status}`);
      lastErr.status = r.status;
      const ra = parseFloat(r.headers.get('retry-after'));
      if (r.status === 429) {
        gtCooldownUntil = Date.now() + Math.min(60000, Number.isFinite(ra) ? ra * 1000 : 30000);
        lastErr.noRetry = true;
        throw lastErr; // лимит исчерпан: повторять бессмысленно
      }
      if (r.status >= 500) {
        if (attempt < attempts - 1) await sleep(Math.min(4000, Number.isFinite(ra) ? ra * 1000 : 1200 * (attempt + 1)));
        continue;
      }
      throw lastErr; // 4xx кроме 429 — повторять бессмысленно
    } catch (e) {
      if (e && e.noRetry) throw e;
      if (e === lastErr && e.status && e.status < 500) throw e;
      lastErr = e;
      if (attempt < attempts - 1) await sleep(500 * (attempt + 1));
    } finally { clearTimeout(t); }
  }
  throw lastErr || new Error('GeckoTerminal недоступен');
}

async function gt(path) {
  const fresh = path.includes('/pools/multi/') ? GT_FRESH_STATS : GT_FRESH;
  const hit = gtCache.get(path);
  if (hit && Date.now() - hit.ts < fresh) return hit.value;
  if (gtInflight.has(path)) return gtInflight.get(path);
  // есть прошлый ответ — не заставляем ждать: одна быстрая попытка, при отказе сразу отдаём прошлый
  const haveStale = hit && Date.now() - hit.ts < GT_STALE;
  const p = gtRaw(path, haveStale ? 1 : 3, haveStale ? 4000 : 10000)
    .then((value) => {
      gtCache.set(path, { ts: Date.now(), value });
      if (gtCache.size > 400) {
        const oldest = [...gtCache.entries()].sort((x, y) => x[1].ts - y[1].ts).slice(0, 100);
        oldest.forEach(([k]) => gtCache.delete(k));
      }
      return value;
    })
    .catch((e) => {
      if (hit && Date.now() - hit.ts < GT_STALE) return hit.value; // источник отказал — показываем последнее известное
      throw e;
    })
    .finally(() => gtInflight.delete(path));
  gtInflight.set(path, p);
  return p;
}

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

// ───── Запасной источник: DexScreener (бесплатно, без ключа, 300 запросов/мин на пары и токены) ─────
// Используется только когда GeckoTerminal отказал. Комиссию пула DexScreener не отдаёт —
// её добираем теми же способами, что и раньше (API площадок, контракт V4, fee() у V3, фиксированные V2).
const DS_BASE = 'https://api.dexscreener.com';
const DS_CHAIN = { eth: 'ethereum', bsc: 'bsc', arbitrum: 'arbitrum', base: 'base', solana: 'solana' };
const DS_FRESH = 45 * 1000;
const DS_STALE = 30 * 60 * 1000;
const dsCache = new Map();
async function dsGet(path) {
  const hit = dsCache.get(path);
  if (hit && Date.now() - hit.ts < DS_FRESH) return hit.value;
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(DS_BASE + path, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: ctl.signal });
      if (r.ok) {
        const value = await r.json();
        dsCache.set(path, { ts: Date.now(), value });
        if (dsCache.size > 300) [...dsCache.keys()].slice(0, 100).forEach(k => dsCache.delete(k));
        return value;
      }
      lastErr = new Error(`DexScreener ${r.status}`);
      if (r.status !== 429 && r.status < 500) break;
      await sleep(800);
    } catch (e) { lastErr = e; await sleep(400); } finally { clearTimeout(t); }
  }
  if (hit && Date.now() - hit.ts < DS_STALE) return hit.value;
  throw lastErr || new Error('DexScreener недоступен');
}
function dsParse(pairs, network) {
  const evm = network !== 'solana';
  return (Array.isArray(pairs) ? pairs : [])
    .filter(p => p && p.pairAddress && p.chainId === DS_CHAIN[network])
    .map(p => {
      const id = String(p.dexId || '');
      const name = id.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const labels = (p.labels || []).map(l => (String(l).toLowerCase() === 'wp' ? 'Whirlpool' : String(l))).join(' ');
      const dexInfo = parseDex(`${name} ${labels}`.trim(), id);
      const base = p.baseToken?.symbol || '?';
      const quote = p.quoteToken?.symbol || '?';
      const tx = p.txns?.h24;
      return {
        network,
        address: evm && /^0x/i.test(p.pairAddress) ? p.pairAddress.toLowerCase() : p.pairAddress,
        poolName: `${base} / ${quote}`,
        base, quote,
        hasStable: STABLES.has(base.toUpperCase()) || STABLES.has(quote.toUpperCase()),
        dex: dexInfo.dex, dexId: id || null, family: dexInfo.family, version: dexInfo.version,
        feePct: null,
        tvl: num(p.liquidity?.usd),
        vol24: num(p.volume?.h24),
        fees24: null, apr: null,
        change24: num(p.priceChange?.h24),
        txns24: tx ? (tx.buys || 0) + (tx.sells || 0) : null,
        createdAt: p.pairCreatedAt ? new Date(p.pairCreatedAt).toISOString() : null,
        src: 'dexscreener',
      };
    });
}
// статистика по известным адресам пулов (до 30 за запрос)
async function dsByAddresses(network, addrs) {
  const j = await dsGet(`/latest/dex/pairs/${DS_CHAIN[network]}/${addrs.map(encodeURIComponent).join(',')}`);
  return dsParse(j?.pairs, network);
}
// все пулы токена по адресу
async function dsByToken(network, token) {
  const j = await dsGet(`/token-pairs/v1/${DS_CHAIN[network]}/${encodeURIComponent(token)}`);
  return dsParse(j, network).sort((x, y) => (y.tvl || 0) - (x.tvl || 0)).slice(0, 80);
}
async function dsSearch(network, q) {
  const j = await dsGet(`/latest/dex/search?q=${encodeURIComponent(q)}`);
  return dsParse(j?.pairs, network);
}
// пулы по запросу: адрес токена / известная монета — все пулы токена, иначе текстовый поиск
async function dsRows(network, q, known) {
  if (known) return dsByToken(network, known);
  const up = q.toUpperCase();
  const bare = up.replace(/^W(?=[A-Z]{3})/, '');
  const rows = await dsSearch(network, q);
  const isExact = (r) => [r.base, r.quote].some(sym => {
    const u = sym.toUpperCase();
    return u === up || u === 'W' + up || u === bare || u === 'W' + bare;
  });
  const exact = rows.filter(isExact);
  return exact.length > 0 ? exact : rows.filter(r => r.base.toUpperCase().startsWith(up) || r.quote.toUpperCase().startsWith(up));
}

// Разбор названия площадки на «семейство» и «версию»: "Uniswap V3 (Base)" → Uniswap + V3,
// "Raydium CLMM" → Raydium + CLMM, "Orca" → Orca + без версии.
const VERSION_WORDS = ['CLMM', 'CPMM', 'DLMM', 'DAMM', 'SLIPSTREAM', 'WHIRLPOOL', 'WHIRLPOOLS'];
export function parseDex(rawName, rawId) {
  let name = (rawName || '').replace(/[-_]+/g, ' ').replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (!name && rawId) {
    // только технический id: убираем названия сетей и делаем читаемым ("uniswap-v4-ethereum" → "Uniswap v4")
    const NETS = new Set(['eth', 'ethereum', 'bsc', 'base', 'arbitrum', 'solana', 'sol']);
    name = String(rawId).split(/[-_\s]+/).filter(w => !NETS.has(w.toLowerCase())).map(w => (/^v\d$/i.test(w) ? w : w[0].toUpperCase() + w.slice(1))).join(' ');
  }
  if (!name) return { dex: null, family: 'Другие', version: null };
  const parts = [];
  const v = name.match(/\bv([2-4])\b/i);
  if (v) name = name.replace(v[0], ' ');
  const w = name.split(/\s+/).find(x => VERSION_WORDS.includes(x.toUpperCase()));
  if (w) {
    parts.push(w.toUpperCase().startsWith('WHIRLPOOL') ? 'Whirlpool' : w.length <= 5 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase());
    name = name.replace(w, ' ');
  }
  if (v) parts.push(`V${v[1]}`);
  const version = parts.length ? parts.join(' ') : null;
  const family = name.replace(/\s+/g, ' ').trim() || 'Другие';
  const display = [family, version].filter(Boolean).join(' ');
  return { dex: display, family, version };
}

function parsePools(json, network) {
  const included = new Map((json.included || []).map(i => [`${i.type}:${i.id}`, i]));
  const list = Array.isArray(json.data) ? json.data : json.data ? [json.data] : [];
  return list.map(p => {
    const a = p.attributes || {};
    const rel = p.relationships || {};
    const dexId = rel.dex?.data?.id;
    const dexInfo = parseDex(dexId ? included.get(`dex:${dexId}`)?.attributes?.name : null, dexId);
    const baseTok = rel.base_token?.data?.id ? included.get(`token:${rel.base_token.data.id}`)?.attributes : null;
    const quoteTok = rel.quote_token?.data?.id ? included.get(`token:${rel.quote_token.data.id}`)?.attributes : null;

    const nameFull = a.name || '';
    const poolName = a.pool_name || nameFull.replace(/\s+\d+(\.\d+)?%\s*$/, '');
    const [bs, qs] = poolName.split(' / ').map(s => s.trim());
    const feeFromName = (nameFull.match(/(\d+(?:\.\d+)?)%\s*$/) || [])[1];
    const feePct = num(a.pool_fee_percentage) ?? num(feeFromName);
    const tx = a.transactions?.h24;
    const tvl = num(a.reserve_in_usd);
    const vol24 = num(a.volume_usd?.h24);
    const baseSym = baseTok?.symbol || bs || '?';
    const quoteSym = quoteTok?.symbol || qs || '?';

    return {
      network,
      address: a.address || String(p.id || '').split('_').slice(1).join('_'),
      poolName,
      base: baseSym,
      quote: quoteSym,
      hasStable: STABLES.has(baseSym.toUpperCase()) || STABLES.has(quoteSym.toUpperCase()),
      dex: dexInfo.dex,
      dexId: dexId || null,
      family: dexInfo.family,
      version: dexInfo.version,
      feePct,
      tvl,
      vol24,
      // годовая доходность от комиссий по данным за 24ч: объём × комиссия × 365 / TVL
      fees24: vol24 != null && feePct != null ? vol24 * feePct / 100 : null,
      apr: tvl > 0 && vol24 != null && feePct != null ? (vol24 * feePct / 100 * 365 / tvl) * 100 : null,
      change24: num(a.price_change_percentage?.h24),
      txns24: tx ? (tx.buys || 0) + (tx.sells || 0) : null,
      createdAt: a.pool_created_at || null,
    };
  });
}

// На Solana GeckoTerminal часто не знает комиссию пула (она динамическая) — тогда комиссия и APR пустые.
// Добираем их у самих площадок: Raydium, Orca, Meteora. Любой сбой молча оставляет прочерки.
async function jget(url, ms = 6000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(t); }
}
function fill(row, feePct, fees24, aprFromApi, extra = {}) {
  if (Number.isFinite(feePct)) row.feePct = feePct;
  // запасной вариант: площадка не отдала комиссию — берём фактическую (комиссии за 24ч / объём за 24ч)
  else if (row.feePct == null && Number.isFinite(fees24) && row.vol24 > 0) row.feePct = fees24 / row.vol24 * 100;
  if (row.tvl == null && Number.isFinite(extra.tvl)) row.tvl = extra.tvl;
  if (row.vol24 == null && Number.isFinite(extra.vol24)) row.vol24 = extra.vol24;
  if (Number.isFinite(fees24)) row.fees24 = fees24;
  else if (row.fees24 == null && row.vol24 != null && row.feePct != null) row.fees24 = row.vol24 * row.feePct / 100;
  if (row.fees24 != null && row.tvl > 0) row.apr = (row.fees24 * 365 / row.tvl) * 100;
  else if (Number.isFinite(aprFromApi)) row.apr = aprFromApi;
}
// PumpSwap: публичного API с комиссией отдельного пула нет. Комиссия фиксированная: 0,25% с обмена,
// из них 0,2% получают LP (0,05% — протокол). Для APR берём долю LP; значение примерное (feeApprox).
const PUMPSWAP_LP_FEE = 0.2;

// Meteora: три источника по очереди — новый DLMM API, DAMM v2 API, старый DLMM API.
// Каждый отдаёт данные в своей форме, поэтому приводим к общему виду { fee, fees24, apr, tvl, vol24 }.
async function meteoraInfo(address, isDamm) {
  const tryDlmm = async () => {
    const x = await jget(`https://dlmm.datapi.meteora.ag/pools/${address}`);
    if (!x || x.address == null) throw new Error('empty');
    return { fee: num(x.pool_config?.base_fee_pct), fees24: num(x.fees?.['24h']), apr: null, tvl: num(x.tvl), vol24: num(x.volume?.['24h']) };
  };
  const tryDamm = async () => {
    const j = await jget(`https://dammv2-api.meteora.ag/pools/${address}`);
    const x = j?.data;
    if (!x) throw new Error('empty');
    const fee = num(x.base_fee);
    return { fee: fee != null && fee > 0 && fee <= 25 ? fee : null, fees24: num(x.fee24h), apr: null, tvl: num(x.tvl), vol24: num(x.volume24h) };
  };
  const tryLegacy = async () => {
    const x = await jget(`https://dlmm-api.meteora.ag/pair/${address}`);
    if (!x || x.address == null) throw new Error('empty');
    return { fee: num(x.base_fee_percentage), fees24: num(x.fees_24h), apr: num(x.apr), tvl: num(x.liquidity), vol24: num(x.trade_volume_24h) };
  };
  const order = isDamm ? [tryDamm, tryDlmm, tryLegacy] : [tryDlmm, tryDamm, tryLegacy];
  for (const fn of order) {
    try { return await fn(); } catch {}
  }
  return null;
}

export async function enrichSolana(rows, cap = 25) {
  const fam = (r) => String(r.family || '').toLowerCase();
  // лимит считаем отдельно по каждой площадке: раньше пулы без комиссии (например PumpSwap)
  // занимали общие слоты и до Meteora очередь просто не доходила
  const need = rows.filter(r => r.network === 'solana' && r.feePct == null);
  if (need.length === 0) return rows;
  const tasks = [];

  const ps = need.filter(r => /pump\s*swap/.test(fam(r)));
  for (const r of ps) {
    fill(r, PUMPSWAP_LP_FEE, NaN, NaN);
    r.feeApprox = true;
  }

  const ray = need.filter(r => fam(r).includes('raydium')).slice(0, cap);
  for (let i = 0; i < ray.length; i += 20) {
    const chunk = ray.slice(i, i + 20);
    tasks.push(jget(`https://api-v3.raydium.io/pools/info/ids?ids=${chunk.map(r => r.address).join(',')}`).then(j => {
      const byId = new Map((j?.data || []).filter(Boolean).map(x => [x.id, x]));
      for (const r of chunk) {
        const x = byId.get(r.address);
        if (!x) continue;
        const rate = num(x.feeRate);
        fill(r, rate != null ? rate * 100 : NaN, num(x.day?.volumeFee) ?? NaN, num(x.day?.feeApr) ?? NaN);
      }
    }));
  }
  for (const r of need.filter(x => fam(x).includes('meteora')).slice(0, 20)) {
    tasks.push(meteoraInfo(r.address, /damm/i.test(r.version || '')).then(x => {
      if (!x) return;
      fill(r, x.fee ?? NaN, x.fees24 ?? NaN, x.apr ?? NaN, { tvl: x.tvl, vol24: x.vol24 });
    }));
  }
  for (const r of need.filter(x => fam(x).includes('orca')).slice(0, 12)) {
    tasks.push(jget(`https://api.orca.so/v2/solana/pools/${r.address}`).then(j => {
      const x = j?.data || j;
      const rate = num(x?.feeRate);                // в сотых долях базисного пункта: 400 = 0,04%
      fill(r, rate != null ? rate / 10000 : NaN, num(x?.stats?.['24h']?.fees) ?? NaN, NaN);
    }));
  }
  await Promise.allSettled(tasks);
  return rows;
}

// Uniswap V4: GeckoTerminal не отдаёт комиссию пула (она задаётся пулом и может быть динамической),
// поэтому читаем её из контракта StateView: getSlot0(poolId) → (sqrtPriceX96, tick, protocolFee, lpFee).
// lpFee в сотых долях базисного пункта: 3000 = 0,3%. Любой сбой молча оставляет прочерки.
const V4_STATE_VIEW = {
  eth: '0x7ffe42c4a5deea5b0fec41c94c136cf115597227',
  bsc: '0xd13dd3d6e93f276fafc9db9e6bb47c1180aee0c4',
  arbitrum: '0x76fd297e2d437cd7f76d50f01afe6160f86e9990',
  base: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71',
};
const V4_RPC = {
  eth: ['https://ethereum-rpc.publicnode.com', 'https://cloudflare-eth.com'],
  bsc: ['https://bsc-rpc.publicnode.com', 'https://bsc-dataseed.binance.org'],
  arbitrum: ['https://arbitrum-one-rpc.publicnode.com', 'https://arb1.arbitrum.io/rpc'],
  base: ['https://base-rpc.publicnode.com', 'https://mainnet.base.org'],
};
const V4_SELECTOR = '0xc815641c'; // getSlot0(bytes32)
const v4FeeCache = new Map();
const V4_FEE_TTL = 10 * 60 * 1000;

async function rpcCall(network, to, data) {
  let lastErr;
  for (const url of V4_RPC[network] || []) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    try {
      const r = await fetch(url, {
        method: 'POST', cache: 'no-store', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      if (j.error || typeof j.result !== 'string') throw new Error(j.error?.message || 'bad result');
      return j.result;
    } catch (e) { lastErr = e; } finally { clearTimeout(t); }
  }
  throw lastErr || new Error('no rpc');
}

async function v4LpFeePct(network, poolId) {
  const key = `${network}:${poolId.toLowerCase()}`;
  const hit = v4FeeCache.get(key);
  if (hit && Date.now() - hit.ts < V4_FEE_TTL) return hit.value;
  const res = await rpcCall(network, V4_STATE_VIEW[network], V4_SELECTOR + poolId.slice(2).toLowerCase());
  const hex = res.replace(/^0x/, '');
  if (hex.length < 64 * 4) throw new Error('short result');
  const lpFee = Number(BigInt('0x' + hex.slice(64 * 3, 64 * 4)) & 0xffffffn); // последнее слово, 24 бита
  const pct = lpFee / 10000;
  v4FeeCache.set(key, { value: pct, ts: Date.now() });
  return pct;
}

// V2-площадки с фиксированной комиссией: GeckoTerminal её часто не отдаёт.
// Берём долю поставщиков ликвидности (на неё считается APR): Uniswap V2 — 0,3%;
// PancakeSwap V2 — 0,17% из 0,25% (остальное — казна и сжигание), поэтому такое значение помечается «~».
function applyFixedFees(rows) {
  for (const r of rows) {
    if (r.network === 'solana' || r.feePct != null) continue;
    const fam = String(r.family || '');
    const ver = `${r.version || ''} ${r.dex || ''}`;
    if (/pancake/i.test(fam) && /v2/i.test(ver)) { fill(r, 0.17, NaN, NaN); r.feeApprox = true; }
    else if (/^uniswap$/i.test(fam.trim()) && /v2/i.test(ver)) fill(r, 0.3, NaN, NaN);
  }
}

export async function enrichEvmV4(rows, cap = 20) {
  applyFixedFees(rows);
  const need = rows.filter(r =>
    r.network !== 'solana' && r.feePct == null && V4_STATE_VIEW[r.network]
    && /uniswap/i.test(r.family || '') && /v4/i.test(`${r.version || ''} ${r.dex || ''}`)
    && /^0x[0-9a-fA-F]{64}$/.test(r.address || '')).slice(0, cap);
  // пулы из DexScreener (запасной источник) приходят без комиссии: у V3-подобных пулов читаем fee() из контракта
  const needV3 = rows.filter(r =>
    r.src === 'dexscreener' && r.network !== 'solana' && r.feePct == null && V4_RPC[r.network]
    && /v3|slipstream/i.test(`${r.version || ''} ${r.dex || ''}`)
    && /^0x[0-9a-fA-F]{40}$/.test(r.address || '')).slice(0, cap);
  await Promise.allSettled([
    ...need.map(async (r) => {
      const pct = await v4LpFeePct(r.network, r.address);
      fill(r, pct, NaN, NaN);
    }),
    ...needV3.map(async (r) => {
      const pct = await v3FeePct(r.network, r.address);
      fill(r, pct, NaN, NaN);
    }),
  ]);
  return rows;
}

// V3-подобные пулы: fee() → uint24 в сотых долях базисного пункта (3000 = 0,3%)
const V3_FEE_SELECTOR = '0xddca3f43';
async function v3FeePct(network, pool) {
  const key = `${network}:${pool.toLowerCase()}`;
  const hit = v4FeeCache.get(key);
  if (hit && Date.now() - hit.ts < V4_FEE_TTL) return hit.value;
  const res = await rpcCall(network, pool, V3_FEE_SELECTOR);
  const hex = res.replace(/^0x/, '');
  if (hex.length < 64) throw new Error('short result');
  const pct = Number(BigInt('0x' + hex.slice(-64)) & 0xffffffn) / 10000;
  if (!(pct > 0 && pct <= 10)) throw new Error('bad fee');
  v4FeeCache.set(key, { value: pct, ts: Date.now() });
  return pct;
}

function dedupe(rows) {
  const seen = new Set();
  return rows.filter(r => (seen.has(r.address) ? false : (seen.add(r.address), true)));
}

// Поиск пулов по монете (тикер или адрес токена) в выбранной сети
export async function searchPools(network, query) {
  const q = query.trim();
  if (!q) return [];
  const key = `${network}:${q.toLowerCase()}`;
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.ts < SEARCH_TTL) return hit.value;
  try {
    return await searchPoolsFresh(network, q, key);
  } catch (e) {
    if (hit && Date.now() - hit.ts < SEARCH_STALE) return hit.value; // источник отказал — отдаём прошлый результат
    throw e;
  }
}

async function searchPoolsFresh(network, q, key) {
  const up = q.toUpperCase();
  const looksLikeAddress = q.length >= 30;
  const known = looksLikeAddress ? q : KNOWN[network]?.[up];

  let rows = null;
  if (known) {
    try {
      const jsons = await gtPages(pg => `/networks/${network}/tokens/${encodeURIComponent(known)}/pools?include=base_token,quote_token,dex&page=${pg}`);
      rows = dedupe(jsons.flatMap(j => parsePools(j, network)));
    } catch (e) {
      if (looksLikeAddress) {
        // GeckoTerminal отказал — берём пулы токена из DexScreener
        try { rows = await dsRows(network, q, known); } catch { throw e; }
      } // для известных монет есть запасной путь через поиск
    }
  }
  if (!rows) {
    try {
      const jsons = await gtPages(pg => `/search/pools?query=${encodeURIComponent(q)}&network=${network}&include=base_token,quote_token,dex&page=${pg}`);
      rows = dedupe(jsons.flatMap(j => parsePools(j, network)));
      // ETH ↔ WETH, BNB ↔ WBNB, SOL ↔ wSOL: сначала точные совпадения, «похожие» — только если точных нет
      const bare = up.replace(/^W(?=[A-Z]{3})/, '');
      const isExact = (r) => [r.base, r.quote].some(sym => {
        const u = sym.toUpperCase();
        return u === up || u === 'W' + up || u === bare || u === 'W' + bare;
      });
      const exact = rows.filter(isExact);
      rows = exact.length > 0 ? exact : rows.filter(r => r.base.toUpperCase().startsWith(up) || r.quote.toUpperCase().startsWith(up));
    } catch (e) {
      try { rows = await dsRows(network, q, known); } catch { throw e; }
    }
  }
  rows = rows.filter(r => !isExcludedDex(r));
  rows.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
  if (network === 'solana') await enrichSolana(rows); else await enrichEvmV4(rows);
  searchCache.set(key, { value: rows, ts: Date.now() });
  return rows;
}

// Поиск конкретной пары: ищем пулы по каждому из двух активов (так редкий токен не теряется среди
// сотен пулов популярного) и оставляем те, где встречаются оба. Порядок активов не важен.
const isAddr = (t) => t.length >= 30;
const symOk = (sym, term) => {
  const u = String(sym || '').toUpperCase();
  const up = term.toUpperCase();
  const bare = up.replace(/^W(?=[A-Z]{3})/, '');
  return u === up || u === 'W' + up || u === bare || u === 'W' + bare;
};
export async function searchPair(network, a, b) {
  const t1 = a.trim(), t2 = (b || '').trim();
  if (!t2) return searchPools(network, t1);
  if (!t1) return searchPools(network, t2);
  const [ra, rb] = await Promise.allSettled([searchPools(network, t1), searchPools(network, t2)]);
  if (ra.status === 'rejected' && rb.status === 'rejected') throw ra.reason;
  // если один из двух запросов не прошёл, ищем по символам среди пулов второго (для двух адресов нужны оба)
  if ((ra.status === 'rejected' || rb.status === 'rejected') && isAddr(t1) && isAddr(t2)) throw (ra.reason || rb.reason);
  const A = ra.status === 'fulfilled' ? ra.value : [];
  const B = rb.status === 'fulfilled' ? rb.value : [];
  const inA = new Set(A.map(r => r.address)), inB = new Set(B.map(r => r.address));
  const ok = (r) => {
    if (isAddr(t1) && isAddr(t2)) return inA.has(r.address) && inB.has(r.address);
    if (isAddr(t1)) return inA.has(r.address) && (symOk(r.base, t2) || symOk(r.quote, t2));
    if (isAddr(t2)) return inB.has(r.address) && (symOk(r.base, t1) || symOk(r.quote, t1));
    return (symOk(r.base, t1) && symOk(r.quote, t2)) || (symOk(r.quote, t1) && symOk(r.base, t2));
  };
  const seen = new Set();
  return [...A, ...B].filter(r => ok(r) && !seen.has(r.address) && seen.add(r.address)).sort((x, y) => (y.tvl || 0) - (x.tvl || 0));
}

// Пары «по умолчанию» для каждой сети: сначала лучшая версия этой пары (по объёму за 24ч),
// затем пул с максимальным объёмом в сети (если это та же пара — следующий по объёму).
const DEFAULT_PAIRS = {
  eth: ['ETH', 'USDC'],
  bsc: ['BNB', 'USDT'],
  arbitrum: ['ETH', 'USDC'],
  base: ['ETH', 'USDC'],
  solana: ['SOL', 'USDC'],
};
const DEFAULTS_TTL = 5 * 60 * 1000;
const DEFAULT_MIN_TVL = 10000;
const defaultsCache = new Map();
const bareSym = (s) => String(s || '').toUpperCase().replace(/^W(?=[A-Z]{3})/, '');
const pairKey = (r) => [bareSym(r.base), bareSym(r.quote)].sort().join('/');

export async function getDefaultPools(network) {
  const def = DEFAULT_PAIRS[network];
  if (!def) return [];
  const hit = defaultsCache.get(network);
  if (hit && Date.now() - hit.ts < DEFAULTS_TTL) return hit.value;

  const [a, b] = def;
  const addr = KNOWN[network]?.[a];
  const inc = 'include=base_token,quote_token,dex';
  const [pairRes, topRes] = await Promise.all([
    addr
      ? Promise.allSettled([1, 2].map(pg => gt(`/networks/${network}/tokens/${encodeURIComponent(addr)}/pools?${inc}&page=${pg}`)))
      : Promise.resolve([]),
    Promise.allSettled([gt(`/networks/${network}/pools?${inc}&sort=h24_volume_usd_desc&page=1`)]),
  ]);
  const pairOk = pairRes.filter(r => r.status === 'fulfilled');
  const topOk = topRes.filter(r => r.status === 'fulfilled');
  if (pairOk.length === 0 && topOk.length === 0) {
    // GeckoTerminal недоступен: берём пулы основной монеты из DexScreener — лучший по объёму
    // для пары по умолчанию и следующий по объёму с другой парой
    const all = (await dsByToken(network, addr)).filter(r => !isExcludedDex(r) && (r.tvl || 0) >= DEFAULT_MIN_TVL)
      .sort((x, y) => (y.vol24 || 0) - (x.vol24 || 0));
    const pair = all.find(r => (symOk(r.base, a) && symOk(r.quote, b)) || (symOk(r.base, b) && symOk(r.quote, a))) || null;
    const top = all.find(r => !pair || (r.address !== pair.address && pairKey(r) !== pairKey(pair))) || null;
    const rowsDs = [pair, top].filter(Boolean);
    if (rowsDs.length === 0) throw new Error('Источники недоступны');
    if (network === 'solana') await enrichSolana(rowsDs, 30); else await enrichEvmV4(rowsDs, 30);
    return rowsDs; // в кэш не кладём: при следующем запросе снова попробуем GeckoTerminal
  }

  const pairRows = dedupe(pairOk.flatMap(r => parsePools(r.value, network)))
    .filter(r => !isExcludedDex(r))
    .filter(r => (symOk(r.base, a) && symOk(r.quote, b)) || (symOk(r.base, b) && symOk(r.quote, a)))
    .sort((x, y) => (y.vol24 || 0) - (x.vol24 || 0) || (y.tvl || 0) - (x.tvl || 0));
  const pair = pairRows[0] || null;

  const topRows = dedupe(topOk.flatMap(r => parsePools(r.value, network)))
    .filter(r => !isExcludedDex(r) && (r.tvl || 0) >= DEFAULT_MIN_TVL)
    .sort((x, y) => (y.vol24 || 0) - (x.vol24 || 0));
  const top = topRows.find(r => !pair || (r.address !== pair.address && pairKey(r) !== pairKey(pair))) || null;

  const rows = [pair, top].filter(Boolean);
  if (network === 'solana') await enrichSolana(rows, 30); else await enrichEvmV4(rows, 30);
  defaultsCache.set(network, { value: rows, ts: Date.now() });
  return rows;
}

// Свежая статистика по набору пулов одной сети (до 30 за запрос)
export async function getPoolsStats(network, addresses) {
  const out = new Map();
  const need = [];
  for (const addr of addresses) {
    const hit = statsCache.get(`${network}:${addr}`);
    if (hit && Date.now() - hit.ts < STATS_TTL) out.set(addr, hit.value);
    else need.push(addr);
  }
  for (let i = 0; i < need.length; i += 30) {
    const chunk = need.slice(i, i + 30);
    let json;
    try {
      json = await gt(`/networks/${network}/pools/multi/${chunk.join(',')}?include=base_token,quote_token,dex`);
    } catch (e) {
      // GeckoTerminal отказал: пробуем DexScreener, затем прежние данные этих пулов (до 30 минут)
      let ds = new Map();
      try {
        const rowsDs = await dsByAddresses(network, chunk);
        if (network === 'solana') await enrichSolana(rowsDs, 30); else await enrichEvmV4(rowsDs, 30);
        ds = new Map(rowsDs.map(r => [r.address.toLowerCase(), r]));
      } catch {}
      for (const addr of chunk) {
        const old = statsCache.get(`${network}:${addr}`);
        const oldOk = old && Date.now() - old.ts < SEARCH_STALE;
        const row = ds.get(addr.toLowerCase());
        if (row) {
          row.address = addr; // ключ как в избранном
          // DexScreener не знает комиссию: берём прежнюю, если она была, и пересчитываем APR
          if (row.feePct == null && oldOk && old.value.feePct != null) {
            fill(row, old.value.feePct, NaN, NaN);
            row.feeApprox = !!old.value.feeApprox;
          }
          statsCache.set(`${network}:${addr}`, { value: row, ts: Date.now() });
          out.set(addr, row);
        } else if (oldOk) out.set(addr, old.value);
        else out.failed = true;
      }
      continue;
    }
    const parsed = parsePools(json, network);
    if (network === 'solana') await enrichSolana(parsed, 30); else await enrichEvmV4(parsed, 30);
    for (const row of parsed) {
      statsCache.set(`${network}:${row.address}`, { value: row, ts: Date.now() });
      out.set(row.address, row);
    }
  }
  return out;
}
