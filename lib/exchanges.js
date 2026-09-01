// Все три биржи дают публичные данные без ключей и регистрации.

// --- Простой кэш в памяти процесса (живёт, пока Vercel переиспользует контейнер функции) ---
const priceCache = new Map(); // key -> { value, ts }
const PRICE_TTL_MS = 15 * 1000;

function symbolFor(exchange, asset) {
  const a = asset.toUpperCase();
  if (exchange === 'OKX') return `${a}-USDT`;
  return `${a}USDT`; // BINANCE, BYBIT, MEXC
}

async function getPriceRaw(exchange, asset) {
  const symbol = symbolFor(exchange, asset);

  if (exchange === 'BINANCE') {
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    const d = await r.json();
    const p = parseFloat(d.price);
    if (!p || Number.isNaN(p)) throw new Error('BINANCE: нет цены');
    return p;
  }

  if (exchange === 'BYBIT') {
    const r = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`);
    const d = await r.json();
    const p = parseFloat(d?.result?.list?.[0]?.lastPrice);
    if (!p || Number.isNaN(p)) throw new Error('BYBIT: нет цены');
    return p;
  }

  if (exchange === 'OKX') {
    const r = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${symbol}`);
    const d = await r.json();
    const p = parseFloat(d?.data?.[0]?.last);
    if (!p || Number.isNaN(p)) throw new Error('OKX: нет цены');
    return p;
  }

  if (exchange === 'MEXC') {
    const r = await fetch(`https://api.mexc.com/api/v3/ticker/price?symbol=${symbol}`);
    const d = await r.json();
    const p = parseFloat(d.price);
    if (!p || Number.isNaN(p)) throw new Error('MEXC: нет цены');
    return p;
  }

  throw new Error(`Неизвестная биржа: ${exchange}`);
}
// Текущая цена с кэшем (15 сек) и резервными биржами, если основная недоступна
export async function getPrice(exchange, asset) {
  const key = `${exchange}:${asset.toUpperCase()}`;
  const cached = priceCache.get(key);
  if (cached && Date.now() - cached.ts < PRICE_TTL_MS) return cached.value;

  const allExchanges = ['BINANCE', 'BYBIT', 'OKX', 'MEXC'];
  const order = [exchange, ...allExchanges.filter(e => e !== exchange)];

  let lastError;
  for (const ex of order) {
    try {
      const price = await getPriceRaw(ex, asset);
      priceCache.set(key, { value: price, ts: Date.now() });
      return price;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('Цена недоступна ни на одной бирже');
}

// Исторические свечи: возвращает массив { time (unix сек), open, high, low, close }
// range: 'all' | '1y' | '1m'
export async function getKlines(exchange, asset, range) {
  const symbol = symbolFor(exchange, asset);

  const now = Date.now();
  const rangeMs = { all: 5 * 365 * 24 * 3600 * 1000, '1y': 365 * 24 * 3600 * 1000, '1m': 30 * 24 * 3600 * 1000 }[range] || 365 * 24 * 3600 * 1000;
  const startTime = now - rangeMs;
  // Дневные свечи для all/1y, часовые для 1m — баланс точности и объёма данных
  const interval = range === '1m' ? '1h' : '1d';

  if (exchange === 'BINANCE') {
    const binInterval = interval === '1h' ? '1h' : '1d';
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binInterval}&startTime=${startTime}&limit=1000`);
    const d = await r.json();
    return d.map(k => ({ time: Math.floor(k[0] / 1000), open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]) }));
  }

  if (exchange === 'BYBIT') {
    const byInterval = interval === '1h' ? '60' : 'D';
    const r = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${byInterval}&start=${startTime}&limit=1000`);
    const d = await r.json();
    return d.result.list
      .map(k => ({ time: Math.floor(Number(k[0]) / 1000), open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]) }))
      .sort((a, b) => a.time - b.time);
  }

  if (exchange === 'OKX') {
    const okInterval = interval === '1h' ? '1H' : '1D';
    const r = await fetch(`https://www.okx.com/api/v5/market/history-candles?instId=${symbol}&bar=${okInterval}&limit=300`);
    const d = await r.json();
    return d.data
      .map(k => ({ time: Math.floor(Number(k[0]) / 1000), open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]) }))
      .sort((a, b) => a.time - b.time);
  }

  if (exchange === 'MEXC') {
    const mexcInterval = interval === '1h' ? '60m' : '1d';
    const r = await fetch(`https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=${mexcInterval}&startTime=${startTime}&limit=1000`);
    const d = await r.json();
    return d.map(k => ({ time: Math.floor(k[0] / 1000), open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]) }));
  }

  throw new Error(`Неизвестная биржа: ${exchange}`);
}

// Совмещает две серии свечей по ближайшему совпадающему времени и делит цену1/цена2
// Компактная 24-часовая история соотношения (для мини-графика в списке) — кэшируется на 5 минут
const sparkCache = new Map();
const SPARK_TTL_MS = 5 * 60 * 1000;

export async function getSparkline(pair) {
  const key = `spark:${pair.id}`;
  const cached = sparkCache.get(key);
  if (cached && Date.now() - cached.ts < SPARK_TTL_MS) return cached.value;

  const [s1, s2] = await Promise.all([
    getKlines(pair.exchange1, pair.asset1, '1m'), // часовые свечи, берём последние 24
    getKlines(pair.exchange2, pair.asset2, '1m'),
  ]);
  const ratioCandles = buildRatioCandles(s1.slice(-24), s2.slice(-24));
  const closes = ratioCandles.map(c => c.close);

  sparkCache.set(key, { value: closes, ts: Date.now() });
  return closes;
}

export function buildRatioCandles(series1, series2) {
  const map2 = new Map(series2.map(c => [c.time, c]));
  const times2 = series2.map(c => c.time);

  function closest(t) {
    if (map2.has(t)) return map2.get(t);
    let best = null, bestDiff = Infinity;
    for (const c of series2) {
      const diff = Math.abs(c.time - t);
      if (diff < bestDiff) { bestDiff = diff; best = c; }
    }
    return best;
  }

  return series1.map(c1 => {
    const c2 = closest(c1.time);
    if (!c2 || c2.close === 0) return null;
    return {
      time: c1.time,
      open: c1.open / c2.open,
      high: c1.high / c2.low,
      low: c1.low / c2.high,
      close: c1.close / c2.close,
    };
  }).filter(Boolean);
}
