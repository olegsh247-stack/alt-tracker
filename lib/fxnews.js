import { loadSource } from './news';
import { addRussian } from './translate';

// Новости для вкладки Forex: только то, что влияет на валюты — центробанки, международные организации,
// официальная статистика и форекс-издания. Крипта отсеивается. Лента обновляется раз в час.
// official: true — первичный источник, его новости считаем важными по умолчанию (defCat — метка по умолчанию).
const SOURCES = [
  { id: 'fed', name: 'ФРС США', official: true, defCat: 'cb', urls: ['https://www.federalreserve.gov/feeds/press_all.xml'] },
  { id: 'ecb', name: 'ЕЦБ', official: true, defCat: 'cb', urls: ['https://www.ecb.europa.eu/rss/press.xml'] },
  { id: 'boe', name: 'Банк Англии', official: true, defCat: 'cb', urls: ['https://www.bankofengland.co.uk/rss/news'] },
  { id: 'boj', name: 'Банк Японии', official: true, defCat: 'cb', urls: ['https://www.boj.or.jp/en/rss/whatsnew.xml', 'https://www.boj.or.jp/en/rss/release.xml'] },
  { id: 'snb', name: 'Нацбанк Швейцарии', official: true, defCat: 'cb', urls: ['https://www.snb.ch/public/en/rss/pressrel'] },
  { id: 'boc', name: 'Банк Канады', official: true, defCat: 'cb', urls: ['https://www.bankofcanada.ca/content_type/press-releases/feed/', 'https://www.bankofcanada.ca/feed/'] },
  { id: 'rba', name: 'РБА (Австралия)', official: true, defCat: 'cb', urls: ['https://www.rba.gov.au/rss/rss-cb-media-releases.xml'] },
  { id: 'cbr', name: 'ЦБ РФ', official: true, defCat: 'cb', urls: ['https://www.cbr.ru/rss/RssPress', 'https://www.cbr.ru/rss/eventrss'] },
  { id: 'imf', name: 'МВФ', official: true, defCat: 'macro', urls: ['https://www.imf.org/en/News/rss?language=eng', 'https://www.imf.org/en/rss-list/feed?category=WHATSNEW'] },
  { id: 'bis', name: 'BIS', official: true, defCat: 'macro', urls: ['https://www.bis.org/doclist/all_pressrels.rss', 'https://www.bis.org/rss/index.htm'] },
  { id: 'treasury', name: 'Минфин США', official: true, defCat: 'geo', urls: ['https://home.treasury.gov/news/press-releases/rss', 'https://home.treasury.gov/system/files/136/treasury-press-releases.xml'] },
  { id: 'bls', name: 'BLS (США)', official: true, defCat: 'macro', urls: ['https://www.bls.gov/feed/bls_latest.rss'] },
  { id: 'forexlive', name: 'InvestingLive', urls: ['https://investinglive.com/feed', 'https://www.forexlive.com/feed'] },
  { id: 'fxstreet', name: 'FXStreet', urls: ['https://www.fxstreet.com/rss/news', 'https://www.fxstreet.com/rss'] },
  { id: 'dailyfx', name: 'DailyFX', urls: ['https://www.dailyfx.com/feeds/market-news'] },
];

const FRESH = 60 * 60 * 1000;
const STALE = 24 * 60 * 60 * 1000;
const MAX_AGE = 10 * 24 * 60 * 60 * 1000;
const MAX_ITEMS = 120;

// Крипта и всё, что к валютам не относится
const CRYPTO = /\b(bitcoin|btc|ethereum|ether|eth|crypto\w*|token(s|ized|ization)?|defi|nft|altcoins?|solana|xrp|ripple|dogecoin|binance|coinbase|blockchain|memecoin|web3|dao|airdrop)\b/i;

const CATS = [
  { key: 'cb', label: 'Центробанки', re: /\b(fed|federal reserve|fomc|ecb|european central bank|boe|bank of england|boj|bank of japan|snb|swiss national bank|rba|reserve bank|rbnz|bank of canada|boc|central bank(s)?|monetary policy|policy rate|interest rate(s)?|rate (cut|cuts|hike|hikes|decision)|key rate|powell|lagarde|bailey|ueda|macklem|bullock|qe|quantitative (easing|tightening)|minutes|dot plot)\b|ставк|центробанк|банк россии|ключев|денежно-кредитн|заседани|курс (рубл|доллар|евро)|инфляц/i },
  { key: 'macro', label: 'Макроданные', re: /\b(inflation|cpi|ppi|pce|gdp|non-?farm|payrolls?|unemployment|jobless|employment|jobs|pmi|retail sales|trade balance|current account|industrial production|consumer (confidence|sentiment)|wages?)\b/i },
  { key: 'geo', label: 'Геополитика', re: /\b(sanction(s|ed)?|tariff(s)?|trade war|trade deal|embargo|intervention|currency intervention|oil|opec|war|ceasefire|default|downgrade|rating|budget|debt ceiling|shutdown|election)\b/i },
];
const NOISE = /\b(price forecast|technical analysis|price analysis|elliott|support|resistance|pips?|signal|weekly forecast|forecast:|outlook:|chart|trade idea|bullish|bearish)\b/i;

export function classifyFx(it, src) {
  for (const c of CATS) if (c.re.test(it.title)) return { cat: c.key, label: c.label };
  if (src?.official) {
    const d = { cb: 'Центробанки', macro: 'Макроданные', geo: 'Геополитика' }[src.defCat] || 'Макроданные';
    return { cat: src.defCat, label: d };
  }
  return { cat: 'other', label: '' };
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
    .filter(it => !CRYPTO.test(it.title))
    .filter(it => (seen.has(it.link) ? false : (seen.add(it.link), true)))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, MAX_ITEMS)
    .map(it => {
      const c = classifyFx(it, it._src);
      const noise = !it._src.official && NOISE.test(it.title) && c.cat === 'other';
      return { id: it.id, source: it._src.name, title: it.title, link: it.link, ts: it.ts, cat: c.cat, label: c.label, noise };
    });
  if (items.length === 0) throw new Error('новости недоступны');
  const pending = await addRussian(items).catch(() => 0);
  return { items, failed, updatedAt: now, pending };
}

export async function getFxNews() {
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
