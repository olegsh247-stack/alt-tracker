// Данные о пулах ликвидности — GeckoTerminal (бесплатно, без ключа, лимит ~30 запросов/мин → кэшируем).
const BASE = 'https://api.geckoterminal.com/api/v2';
const SEARCH_TTL = 60 * 1000;
const STATS_TTL = 45 * 1000;
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

    return {
      network,
      address: a.address || String(p.id || '').split('_').slice(1).join('_'),
      poolName,
      base: baseTok?.symbol || bs || '?',
      quote: quoteTok?.symbol || qs || '?',
      dex: dexName,
      feePct,
      tvl: num(a.reserve_in_usd),
      vol24: num(a.volume_usd?.h24),
      change24: num(a.price_change_percentage?.h24),
      txns24: tx ? (tx.buys || 0) + (tx.sells || 0) : null,
      createdAt: a.pool_created_at || null,
    };
  });
}

// Поиск пулов по тикеру (или адресу токена) в выбранной сети
export async function searchPools(network, query) {
  const q = query.trim();
  if (!q) return [];
  const key = `${network}:${q.toLowerCase()}`;
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.ts < SEARCH_TTL) return hit.value;

  const looksLikeAddress = q.length >= 30;
  const path = looksLikeAddress
    ? `/networks/${network}/tokens/${encodeURIComponent(q)}/pools?include=base_token,quote_token,dex&page=1`
    : `/search/pools?query=${encodeURIComponent(q)}&network=${network}&include=base_token,quote_token,dex&page=1`;
  const json = await gt(path);
  let rows = parsePools(json, network);

  if (!looksLikeAddress) {
    const up = q.toUpperCase();
    rows = rows.filter(r => r.base.toUpperCase().startsWith(up) || r.quote.toUpperCase().startsWith(up));
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
