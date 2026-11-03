import { loadSource } from './news';
import { addRussian } from './translate';

// Новости для вкладки Pool: только про пулы ликвидности и стейкинг.
// Профильные издания и блоги протоколов плюс жёсткий фильтр по ключевым словам.
const SOURCES = [
  { id: 'defiant', name: 'The Defiant', urls: ['https://thedefiant.io/api/feed', 'https://thedefiant.io/feed'] },
  { id: 'bankless', name: 'Bankless', urls: ['https://www.bankless.com/rss/feed'] },
  { id: 'ctdefi', name: 'Cointelegraph DeFi', urls: ['https://cointelegraph.com/rss/tag/defi'] },
  { id: 'uniswap', name: 'Uniswap', urls: ['https://blog.uniswap.org/rss.xml'] },
  { id: 'raydium', name: 'Raydium', urls: ['https://medium.com/feed/raydium'] },
  { id: 'pancake', name: 'PancakeSwap', urls: ['https://blog.pancakeswap.finance/rss.xml', 'https://medium.com/feed/pancakeswap'] },
  { id: 'orca', name: 'Orca', urls: ['https://medium.com/feed/orca-so'] },
  { id: 'lido', name: 'Lido', urls: ['https://blog.lido.fi/rss/'] },
  { id: 'curve', name: 'Curve', urls: ['https://news.curve.fi/rss/'] },
];

const FRESH = 60 * 60 * 1000;
const STALE = 24 * 60 * 60 * 1000;
const MAX_AGE = 10 * 24 * 60 * 60 * 1000;
const MAX_ITEMS = 120;

// Берём только заголовки про пулы ликвидности и стейкинг. Общие крипто-новости (цены, ETF, регуляторика) не проходят.
const POOLISH = /\b(liquidity|pools?|tvl|amm|impermanent loss|lp|lps|clmm|yield farming|farming|vaults?|dex(es)?|decentrali[sz]ed exchanges?)\b/i;
const STAKING = /\b(staking|staked|stake|unstak\w*|restaking|restaked|liquid staking|lsts?|lsds?|validators?|slashing|eigenlayer|lido|rocket pool|jito|marinade|ether\.fi|etherfi|staking (rewards?|yield|apr|apy))\b/i;
const RISK = /\b(exploit(ed|s)?|hack(ed|s)?|drain(ed)?|rug ?pull|depeg(ged)?|stolen|vulnerabilit\w*|paused|insolven\w*)\b/i;
const OFFTOPIC = /\b(etf|price (prediction|analysis)|technical analysis|memecoin price|sec |lawsuit)\b/i;

export function classifyCom(it) {
  const t = it.title;
  if (OFFTOPIC.test(t)) return null;
  const pool = POOLISH.test(t), stk = STAKING.test(t);
  if (!pool && !stk) return null;
  if (RISK.test(t)) return { cat: 'risk', label: 'Риски' };
  if (stk && !pool) return { cat: 'stake', label: 'Стейкинг' };
  return { cat: 'liq', label: 'Ликвидность' };
}

let cache = null;
let inflight = null;
const perSource = new Map();

async function loadAll() {
  const res = await Promise.allSettled(SOURCES.map(s => loadSource(s)));
  const failed = [];
  const all = [];
  res.forEach((r, i) => {
    const s = SOURCES[i];
    if (r.status === 'fulfilled') { perSource.set(s.id, { ts: Date.now(), items: r.value }); all.push(...r.value.map(it => ({ ...it, _src: s }))); return; }
    const old = perSource.get(s.id);
    if (old && Date.now() - old.ts < STALE) all.push(...old.items.map(it => ({ ...it, _src: s }))); else failed.push(s.name);
  });
  const now = Date.now();
  const seen = new Set();
  const items = all
    .filter(it => it.ts <= now + 3600 * 1000 && now - it.ts < MAX_AGE)
    .filter(it => (seen.has(it.link) ? false : (seen.add(it.link), true)))
    .map(it => ({ it, c: classifyCom(it) }))
    .filter(x => x.c)
    .sort((a, b) => b.it.ts - a.it.ts)
    .slice(0, MAX_ITEMS)
    .map(({ it, c }) => ({ id: it.id, source: it._src.name, title: it.title, link: it.link, ts: it.ts, cat: c.cat, label: c.label }));
  if (items.length === 0) throw new Error('новости недоступны');
  const pending = await addRussian(items).catch(() => 0);
  return { items, failed, updatedAt: now, pending };
}

export async function getPoolNews() {
  const ttl = cache && cache.value.pending > 0 ? 5 * 60 * 1000 : FRESH;
  if (cache && Date.now() - cache.ts < ttl) return cache.value;
  if (!inflight) {
    inflight = loadAll().then(value => { cache = { ts: Date.now(), value }; return value; }).finally(() => { inflight = null; });
  }
  try { return await inflight; } catch (e) {
    if (cache && Date.now() - cache.ts < STALE) return cache.value;
    throw e;
  }
}
