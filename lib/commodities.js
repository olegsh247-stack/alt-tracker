export const COMMODITIES = [
  { key: 'gold', label: 'Золото', ticker: 'GC=F', emoji: '🥇' },
  { key: 'silver', label: 'Серебро', ticker: 'SI=F', emoji: '🥈' },
  { key: 'platinum', label: 'Платина', ticker: 'PL=F', emoji: '⚪' },
  { key: 'palladium', label: 'Палладий', ticker: 'PA=F', emoji: '⬜' },
  { key: 'crude-wti', label: 'Нефть WTI', ticker: 'CL=F', emoji: '🛢️' },
  { key: 'crude-brent', label: 'Нефть Brent', ticker: 'BZ=F', emoji: '🛢️' },
  { key: 'natgas', label: 'Природный газ', ticker: 'NG=F', emoji: '🔥' },
  { key: 'copper', label: 'Медь', ticker: 'HG=F', emoji: '🟠' },
  { key: 'aluminum', label: 'Алюминий', ticker: 'ALI=F', emoji: '⚙️' },
  { key: 'wheat', label: 'Пшеница', ticker: 'ZW=F', emoji: '🌾' },
  { key: 'corn', label: 'Кукуруза', ticker: 'ZC=F', emoji: '🌽' },
  { key: 'soybeans', label: 'Соя', ticker: 'ZS=F', emoji: '🫘' },
  { key: 'coffee', label: 'Кофе', ticker: 'KC=F', emoji: '☕' },
  { key: 'cocoa', label: 'Какао', ticker: 'CC=F', emoji: '🍫' },
  { key: 'sugar', label: 'Сахар', ticker: 'SB=F', emoji: '🍬' },
  { key: 'cotton', label: 'Хлопок', ticker: 'CT=F', emoji: '🧵' },
];

export function labelFor(key) {
  return COMMODITIES.find(c => c.key === key)?.label || key;
}
export function emojiFor(key) {
  return COMMODITIES.find(c => c.key === key)?.emoji || '◆';
}
function tickerFor(key) {
  const c = COMMODITIES.find(c => c.key === key);
  if (!c) throw new Error(`Неизвестный актив: ${key}`);
  return c.ticker;
}

// --- Кэш: цена (15 сек) и история (5 мин) — так же, как для крипто-бирж ---
const priceCache = new Map();
const PRICE_TTL_MS = 15 * 1000;
const chartCache = new Map();
const CHART_TTL_MS = 5 * 60 * 1000;

async function fetchYahooChart(ticker, rangeParam, intervalParam) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${rangeParam}&interval=${intervalParam}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AltTracker/1.0)' } });
  const d = await r.json();
  const result = d?.chart?.result?.[0];
  if (!result) throw new Error('Yahoo Finance: нет данных');

  const timestamps = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const candles = timestamps
    .map((t, i) => ({ time: t, open: q.open?.[i], high: q.high?.[i], low: q.low?.[i], close: q.close?.[i] }))
    .filter(c => c.close != null && c.open != null);

  const price = result.meta?.regularMarketPrice ?? candles[candles.length - 1]?.close;
  return { price, candles };
}

// Текущая цена (кэш 15 сек)
export async function getCommodityPrice(key) {
  const cached = priceCache.get(key);
  if (cached && Date.now() - cached.ts < PRICE_TTL_MS) return cached.value;

  const ticker = tickerFor(key);
  const { price } = await fetchYahooChart(ticker, '5d', '1d');
  if (price == null) throw new Error(`${key}: нет цены`);

  priceCache.set(key, { value: price, ts: Date.now() });
  return price;
}

// Исторические свечи для графика: range = 'all' | '1y' | '1m'
export async function getCommodityKlines(key, range) {
  const cacheKey = `${key}:${range}`;
  const cached = chartCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CHART_TTL_MS) return cached.value;

  const ticker = tickerFor(key);
  const map = { all: ['5y', '1wk'], '1y': ['1y', '1d'], '1m': ['1mo', '1d'] };
  const [rangeParam, intervalParam] = map[range] || map['1y'];
  const { candles } = await fetchYahooChart(ticker, rangeParam, intervalParam);

  chartCache.set(cacheKey, { value: candles, ts: Date.now() });
  return candles;
}

// Последние ~24ч для мини-истории и % изменения (переиспользуем 1-месячный кэш, берём хвост)
export async function getCommoditySparkline(key) {
  const candles = await getCommodityKlines(key, '1m');
  return candles.slice(-2).map(c => c.close); // дневные свечи — 2 последние точки как минимальная база для %
}
