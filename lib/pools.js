// Данные о пулах ликвидности — GeckoTerminal (бесплатно, без ключа, лимит ~30 запросов/мин → кэшируем).
const BASE = 'https://api.geckoterminal.com/api/v2';
const SEARCH_TTL = 60 * 1000;
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
  /biswap/i, /ape\s*swap/i, /bakery/i,  // BNB: минимальный объём
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

async function gt(path) {
  const r = await fetch(BASE + path, { headers: { Accept: 'application/json;version=20230302' }, cache: 'no-store' });
  if (!r.ok) throw new Error(`GeckoTerminal ${r.status}`);
  return r.json();
}

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

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

  const up = q.toUpperCase();
  const looksLikeAddress = q.length >= 30;
  const known = looksLikeAddress ? q : KNOWN[network]?.[up];

  let rows = null;
  if (known) {
    try {
      const jsons = await gtPages(pg => `/networks/${network}/tokens/${encodeURIComponent(known)}/pools?include=base_token,quote_token,dex&page=${pg}`);
      rows = dedupe(jsons.flatMap(j => parsePools(j, network)));
    } catch (e) {
      if (looksLikeAddress) throw e; // для известных монет есть запасной путь через поиск
    }
  }
  if (!rows) {
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
  }
  rows = rows.filter(r => !isExcludedDex(r));
  rows.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
  if (network === 'solana') await enrichSolana(rows);
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
  const [A, B] = await Promise.all([searchPools(network, t1), searchPools(network, t2)]);
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
    const json = await gt(`/networks/${network}/pools/multi/${chunk.join(',')}?include=base_token,quote_token,dex`);
    const parsed = parsePools(json, network);
    if (network === 'solana') await enrichSolana(parsed, 30);
    for (const row of parsed) {
      statsCache.set(`${network}:${row.address}`, { value: row, ts: Date.now() });
      out.set(row.address, row);
    }
  }
  return out;
}
