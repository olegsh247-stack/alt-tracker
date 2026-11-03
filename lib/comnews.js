import { loadSource } from './news';
import { addRussian } from './translate';

// Новости для вкладки Commodities: только про сырьё — энергоносители, металлы, сельхоз.
// Профильные издания плюс жёсткий фильтр по ключевым словам: если заголовок не про товар, он отсеивается.
const SOURCES = [
  { id: 'kitco', name: 'Kitco', urls: ['https://www.kitco.com/rss/kitconews.xml', 'https://www.kitco.com/rss/'] },
  { id: 'oilprice', name: 'OilPrice', urls: ['https://oilprice.com/rss/main'] },
  { id: 'eia', name: 'EIA (США)', urls: ['https://www.eia.gov/rss/todayinenergy.xml'] },
  { id: 'mining', name: 'Mining.com', urls: ['https://www.mining.com/feed/'] },
  { id: 'agri', name: 'Successful Farming', urls: ['https://www.agriculture.com/feed'] },
  { id: 'farmprogress', name: 'Farm Progress', urls: ['https://www.farmprogress.com/rss.xml'] },
];

const FRESH = 60 * 60 * 1000;
const STALE = 24 * 60 * 60 * 1000;
const MAX_AGE = 10 * 24 * 60 * 60 * 1000;
const MAX_ITEMS = 120;

const CATS = [
  { key: 'energy', label: 'Энергия', re: /\b(oil|crude|brent|wti|opec\+?|natural gas|nat-?gas|lng|gasoline|diesel|refiner\w*|pipeline|barrels?|bpd|petroleum|shale|energy)\b/i },
  { key: 'metals', label: 'Металлы', re: /\b(gold|silver|platinum|palladium|copper|aluminum|aluminium|nickel|zinc|lithium|iron ore|steel|uranium|cobalt|metals?|bullion|lme|comex|mining|miners?)\b/i },
  { key: 'agro', label: 'Агро', re: /\b(wheat|corn|soy\w*|coffee|cocoa|sugar|cotton|grain(s)?|crop(s)?|harvest|usda|rice|barley|canola|palm oil|livestock|cattle|hogs?|fertili[sz]er|farm\w*|agricultur\w*)\b/i },
];
// Всё, что про валюты, акции и крипту без привязки к товарам, — мимо
const OFFTOPIC = /\b(bitcoin|btc|ethereum|crypto\w*|nft|memecoin|blockchain|forex|eur\/usd|gbp\/usd|usd\/jpy)\b/i;

export function classifyCom(it) {
  if (OFFTOPIC.test(it.title)) return null;
  for (const c of CATS) if (c.re.test(it.title)) return { cat: c.key, label: c.label };
  return null;
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

export async function getComNews() {
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
