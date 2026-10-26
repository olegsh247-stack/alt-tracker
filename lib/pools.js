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
const searchCache = new Map();
const statsCache = new Map();

async function gt(path) {
  const r = await fetch(BASE + path, { headers: { Accept: 'application/json;version=20230302' }, cache: 'no-store' });
  if (!r.ok) throw new Error(`GeckoTerminal ${r.status}`);
  return r.json();
}

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

function parsePools(json, network) {
  const included = new Map((json.included || []).map(i => [`${i.type}:${i.id}`, i]));
  const list = Array.isArray(json.data) ? json.data : json.data ? [json.data] : [];
  return list.map(p => {
    const a = p.attributes || {};
    const rel = p.relationships || {};
    const dexId = rel.dex?.data?.id;
    const dexName = dexId ? (included.get(`dex:${dexId}`)?.attributes?.name || dexId) : null;
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
      dex: dexName,
      feePct,
      tvl,
      vol24,
      // годовая доходность от комиссий по данным за 24ч: объём × комиссия × 365 / TVL
      apr: tvl > 0 && vol24 != null && feePct != null ? (vol24 * feePct / 100 * 365 / tvl) * 100 : null,
      change24: num(a.price_change_percentage?.h24),
      txns24: tx ? (tx.buys || 0) + (tx.sells || 0) : null,
      createdAt: a.pool_created_at || null,
    };
  });
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
      const json = await gt(`/networks/${network}/tokens/${encodeURIComponent(known)}/pools?include=base_token,quote_token,dex&page=1`);
      rows = parsePools(json, network);
    } catch (e) {
      if (looksLikeAddress) throw e; // для известных монет есть запасной путь через поиск
    }
  }
  if (!rows) {
    const json = await gt(`/search/pools?query=${encodeURIComponent(q)}&network=${network}&include=base_token,quote_token,dex&page=1`);
    rows = parsePools(json, network);
    // ETH ↔ WETH, BNB ↔ WBNB, SOL ↔ wSOL: сначала точные совпадения, «похожие» — только если точных нет
    const bare = up.replace(/^W(?=[A-Z]{3})/, '');
    const isExact = (r) => [r.base, r.quote].some(sym => {
      const u = sym.toUpperCase();
      return u === up || u === 'W' + up || u === bare || u === 'W' + bare;
    });
    const exact = rows.filter(isExact);
    rows = exact.length > 0 ? exact : rows.filter(r => r.base.toUpperCase().startsWith(up) || r.quote.toUpperCase().startsWith(up));
  }
  rows.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
  searchCache.set(key, { value: rows, ts: Date.now() });
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
    const json = await gt(`/networks/${network}/pools/multi/${chunk.join(',')}?include=base_token,quote_token,dex`);
    for (const row of parsePools(json, network)) {
      statsCache.set(`${network}:${row.address}`, { value: row, ts: Date.now() });
      out.set(row.address, row);
    }
  }
  return out;
}
