// Новости: RSS профильных изданий (бесплатно, без ключей). Обновляем раз в час.
// Показываем прежде всего события, которые влияют на стоимость активов (релизы, разблокировки, голосования,
// взломы, регуляторика, ETF, аналитика), а чисто ценовой шум («биткоин может вырасти до…») отсеиваем.

const SOURCES = [
  { id: 'theblock', name: 'The Block', urls: ['https://www.theblock.co/rss.xml'] },
  { id: 'coindesk', name: 'CoinDesk', urls: ['https://www.coindesk.com/arc/outboundfeeds/rss/', 'https://www.coindesk.com/arc/outboundfeeds/rss?outputType=xml'] },
  { id: 'blockworks', name: 'Blockworks', urls: ['https://blockworks.co/feed', 'https://blockworks.co/feed/'] },
  { id: 'defiant', name: 'The Defiant', urls: ['https://thedefiant.io/api/feed', 'https://thedefiant.io/feed', 'https://thedefiant.io/rss'] },
  { id: 'decrypt', name: 'Decrypt', urls: ['https://decrypt.co/feed'] },
];

const FRESH = 60 * 60 * 1000;           // раз в час
const STALE = 24 * 60 * 60 * 1000;      // при сбое показываем прошлое до суток
const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // новости старше недели не показываем
const MAX_ITEMS = 120;

// ───── разбор XML без зависимостей ─────
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
const stripTags = (s) => decode(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
}
function linkOf(block) {
  const rss = decode(tag(block, 'link')).trim();
  if (rss) return rss;
  const atom = block.match(/<link\b[^>]*?href=["']([^"']+)["'][^>]*>/i); // Atom: <link href="…"/>
  return atom ? decode(atom[1]).trim() : '';
}
export function parseFeed(xml, source) {
  const out = [];
  const blocks = String(xml || '').match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  for (const b of blocks) {
    const title = stripTags(tag(b, 'title'));
    const link = linkOf(b);
    const when = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date');
    const ts = Date.parse(decode(when).trim());
    if (!title || !/^https?:\/\//i.test(link) || !Number.isFinite(ts)) continue;
    out.push({
      id: `${source.id}:${link}`,
      source: source.name,
      title,
      link,
      ts,
      summary: stripTags(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content:encoded')).slice(0, 260),
    });
  }
  return out;
}

// ───── классификация ─────
// Порядок важен: первая подходящая категория становится меткой.
const CATS = [
  { key: 'security', label: 'Безопасность', re: /\b(hack(ed|er|s)?|exploit(ed|s)?|breach|drain(ed|s)?|stolen|theft|rug ?pull|phishing|vulnerabilit(y|ies)|attack(ed|er)?|security incident|frozen|freez(e|es)|sanction(ed|s)?)\b/i },
  { key: 'tech', label: 'Протокол', re: /\b(upgrade|hard ?fork|soft ?fork|mainnet|testnet|launch(es|ed)?|release(s|d)?|roadmap|eip-?\d+|bip-?\d+|v\d(\.\d+)?|layer[- ]?2|rollup|validator|staking|restaking|outage|downtime|halving|burn(s|ed)?)\b/i },
  { key: 'gov', label: 'Голосование', re: /\b(governance|proposal|vote(s|d)?|voting|dao|snapshot|referendum)\b/i },
  { key: 'tokenomics', label: 'Токеномика', re: /\b(unlock(s|ed|ing)?|vesting|token supply|emission(s)?|airdrop|buyback|tokenomics|treasury|mint(s|ed|ing)?)\b/i },
  { key: 'reg', label: 'Регуляторика', re: /\b(sec|cftc|regulat(ion|ory|ors|e|ed)|lawsuit|court|ruling|bill|congress|senate|etf(s)?|approval|approves?|approved|license|mica|stablecoin law|ban(s|ned)?|fine(d|s)?|settlement|doj)\b/i },
  { key: 'flows', label: 'Потоки', re: /\b(inflow(s)?|outflow(s)?|etf flows?|institutional|funding round|raises?|raised|acquires?|acquisition|acquired|merger|ipo|treasury purchase|buys? \$?\d)\b/i },
  { key: 'research', label: 'Аналитика', re: /\b(report|research|analysis|analyst(s)?|study|survey|data shows?|on-?chain data|dune|messari|galaxy|a16z|index)\b/i },
];
// Чисто ценовой шум: прогнозы и «сколько осталось до…» — отсеиваем из режима «Важное»
const NOISE = /\b(price prediction|could (hit|reach|surge|soar|rally)|will (hit|reach)|to the moon|technical analysis|bulls?|bears?|rally|rallies|surges?|soars?|plunges?|dips?|slides?|tumbles?|jumps?|breakout|resistance|support level|what to expect|here'?s why|should you buy|best crypto|top \d+)\b/i;

export function classify(it) {
  const text = `${it.title} ${it.summary.slice(0, 120)}`;
  for (const c of CATS) if (c.re.test(it.title) || c.re.test(text)) return { cat: c.key, label: c.label };
  return { cat: 'other', label: '' };
}
export function isNoise(it) {
  // ценовой шум отсеиваем, если нет признаков реального события (взлом, релиз, голосование, регуляция)
  return NOISE.test(it.title) && !['security', 'tech', 'tokenomics', 'gov', 'reg'].includes(classify(it).cat);
}

// ───── загрузка ─────
async function fetchXml(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, {
      cache: 'no-store', signal: ctl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AltTracker/1.0)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
    });
    if (!r.ok) throw new Error(String(r.status));
    return await r.text();
  } finally { clearTimeout(t); }
}
async function loadSource(src) {
  let lastErr;
  for (const url of src.urls) {
    try {
      const items = parseFeed(await fetchXml(url), src);
      if (items.length > 0) return items;
      lastErr = new Error('пустая лента');
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('недоступно');
}

let cache = null;      // { ts, value: { items, failed } }
let inflight = null;
const perSource = new Map(); // id -> { ts, items } — прошлые ленты на случай сбоя одного источника

async function loadAll() {
  const res = await Promise.allSettled(SOURCES.map(loadSource));
  const failed = [];
  const all = [];
  res.forEach((r, i) => {
    const s = SOURCES[i];
    if (r.status === 'fulfilled') { perSource.set(s.id, { ts: Date.now(), items: r.value }); all.push(...r.value); return; }
    const old = perSource.get(s.id);
    if (old && Date.now() - old.ts < STALE) all.push(...old.items); else failed.push(s.name);
  });
  const now = Date.now();
  const seen = new Set();
  const items = all
    .filter(it => it.ts <= now + 3600 * 1000 && now - it.ts < MAX_AGE)
    .filter(it => (seen.has(it.link) ? false : (seen.add(it.link), true)))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, MAX_ITEMS)
    .map(it => { const c = classify(it); return { id: it.id, source: it.source, title: it.title, link: it.link, ts: it.ts, cat: c.cat, label: c.label, noise: isNoise(it) }; });
  if (items.length === 0) throw new Error('новости недоступны');
  return { items, failed, updatedAt: now };
}

export async function getNews() {
  if (cache && Date.now() - cache.ts < FRESH) return cache.value;
  if (!inflight) {
    inflight = loadAll()
      .then(value => { cache = { ts: Date.now(), value }; return value; })
      .finally(() => { inflight = null; });
  }
  try {
    return await inflight;
  } catch (e) {
    if (cache && Date.now() - cache.ts < STALE) return cache.value;
    throw e;
  }
}
