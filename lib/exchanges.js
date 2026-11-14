// Все три биржи дают публичные данные без ключей и регистрации.

// --- Простой кэш в памяти процесса (живёт, пока Vercel переиспользует контейнер функции) ---
const priceCache = new Map(); // key -> { value, ts }
const PRICE_TTL_MS = 15 * 1000;

function symbolFor(exchange, asset) {
  const a = asset.toUpperCase();
  if (exchange === 'OKX') return `${a}-USDT`;
  if (exchange === 'GATE') return `${a}_USDT`;
  return `${a}USDT`; // BINANCE, BYBIT, MEXC
}

export async function getPriceRaw(exchange, asset) {
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

  if (exchange === 'GATE') {
    const r = await fetch(`https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${symbol}`);
    const d = await r.json();
    const p = parseFloat(Array.isArray(d) ? d[0]?.last : NaN);
    if (!p || Number.isNaN(p)) throw new Error('GATE: нет цены');
    return p;
  }

  throw new Error(`Неизвестная биржа: ${exchange}`);
}
// Текущая цена с кэшем (15 сек) и резервными биржами, если основная недоступна
export async function getPrice(exchange, asset) {
  const key = `${exchange}:${asset.toUpperCase()}`;
  const cached = priceCache.get(key);
  if (cached && Date.now() - cached.ts < PRICE_TTL_MS) return cached.value;

  const allExchanges = ['BINANCE', 'BYBIT', 'OKX', 'MEXC', 'GATE'];
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
// range: 'all' | '1y' | '1m' | '1w' (часовые) | '1d' (15 мин) | '4h' (минутные)
export async function getKlines(exchange, asset, range) {
  const out = await getKlinesRaw(exchange, asset, range);
  if (['1w', '1d', '4h'].includes(range)) {
    const from = Math.floor((Date.now() - KLINE_SPAN[range]) / 1000);
    return out.filter(c => c.time >= from);
  }
  return out;
}

const H = 3600 * 1000;
const KLINE_SPAN = { '1w': 7 * 24 * H, '1d': 24 * H, '4h': 4 * H };
// интервал свечи для каждой биржи: [Binance, Bybit, OKX, MEXC, Gate]
const IV = { '1d': ['1d', 'D', '1D', '1d', '1d'], '1h': ['1h', '60', '1H', '60m', '1h'], '15m': ['15m', '15', '15m', '15m', '15m'], '1m': ['1m', '1', '1m', '1m', '1m'] };
const IV_SEC = { '1d': 86400, '1h': 3600, '15m': 900, '1m': 60 };

async function getKlinesRaw(exchange, asset, range) {
  const symbol = symbolFor(exchange, asset);

  const now = Date.now();
  const rangeMs = { all: 5 * 365 * 24 * 3600 * 1000, '1y': 365 * 24 * 3600 * 1000, '1m': 30 * 24 * 3600 * 1000, '1w': 7 * 24 * H, '1d': 24 * H, '4h': 4 * H }[range] || 365 * 24 * 3600 * 1000;
  const startTime = now - rangeMs;
  // Дневные свечи для all/1y, часовые для 1m — баланс точности и объёма данных
  const interval = { '1m': '1h', '1w': '1h', '1d': '15m', '4h': '1m' }[range] || '1d';
  const ix = (n) => IV[interval][n];

  if (exchange === 'BINANCE') {
    const binInterval = ix(0);
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binInterval}&startTime=${startTime}&limit=1000`);
    const d = await r.json();
    return d.map(k => ({ time: Math.floor(k[0] / 1000), open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]) }));
  }

  if (exchange === 'BYBIT') {
    const byInterval = ix(1);
    const r = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${byInterval}&start=${startTime}&limit=1000`);
    const d = await r.json();
    return d.result.list
      .map(k => ({ time: Math.floor(Number(k[0]) / 1000), open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]) }))
      .sort((a, b) => a.time - b.time);
  }

  if (exchange === 'OKX') {
    const okInterval = ix(2);
    const r = await fetch(`https://www.okx.com/api/v5/market/history-candles?instId=${symbol}&bar=${okInterval}&limit=300`);
    const d = await r.json();
    return d.data
      .map(k => ({ time: Math.floor(Number(k[0]) / 1000), open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]) }))
      .sort((a, b) => a.time - b.time);
  }

  if (exchange === 'MEXC') {
    const mexcInterval = ix(3);
    const r = await fetch(`https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=${mexcInterval}&startTime=${startTime}&limit=1000`);
    const d = await r.json();
    return d.map(k => ({ time: Math.floor(k[0] / 1000), open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]) }));
  }

  if (exchange === 'GATE') {
    // Gate отдаёт максимум 1000 свечей за запрос — ограничиваем окно
    const step = IV_SEC[interval];
    const toSec = Math.floor(now / 1000);
    const fromSec = Math.max(Math.floor(startTime / 1000), toSec - 999 * step);
    const r = await fetch(`https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${symbol}&interval=${ix(4)}&from=${fromSec}&to=${toSec}`);
    const d = await r.json();
    if (!Array.isArray(d)) throw new Error('GATE: нет свечей');
    // формат строки: [время, объём, close, high, low, open, ...]
    return d
      .map(k => ({ time: Number(k[0]), open: parseFloat(k[5]), high: parseFloat(k[3]), low: parseFloat(k[4]), close: parseFloat(k[2]) }))
      .sort((a, b) => a.time - b.time);
  }

  throw new Error(`Неизвестная биржа: ${exchange}`);
}


// Свечи заданного таймфрейма (последние ~300): tf = '4h' | '1d' | '1w' | '1mo'
// интервал для каждой биржи: [Binance, Bybit, OKX, MEXC, Gate]
const TF = {
  '4h': ['4h', '240', '4H', '4h', '4h'],
  '1d': ['1d', 'D', '1D', '1d', '1d'],
  '1w': ['1w', 'W', '1W', '1W', '7d'],
  '1mo': ['1M', 'M', '1M', '1M', '30d'],
};
export const TF_LIMIT = 300;
export async function getKlinesTF(exchange, asset, tf) {
  const iv = TF[tf];
  if (!iv) throw new Error('Неизвестный таймфрейм');
  const symbol = symbolFor(exchange, asset);
  const row = (k) => ({ time: Math.floor(Number(k[0]) / 1000), open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]) });
  let out;
  if (exchange === 'BINANCE') {
    const d = await (await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${iv[0]}&limit=${TF_LIMIT}`)).json();
    out = d.map(row);
  } else if (exchange === 'BYBIT') {
    const d = await (await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${iv[1]}&limit=${TF_LIMIT}`)).json();
    out = d.result.list.map(row);
  } else if (exchange === 'OKX') {
    const d = await (await fetch(`https://www.okx.com/api/v5/market/candles?instId=${symbol}&bar=${iv[2]}&limit=${TF_LIMIT}`)).json();
    out = d.data.map(row);
  } else if (exchange === 'MEXC') {
    const d = await (await fetch(`https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=${iv[3]}&limit=${TF_LIMIT}`)).json();
    out = d.map(row);
  } else if (exchange === 'GATE') {
    const d = await (await fetch(`https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${symbol}&interval=${iv[4]}&limit=${TF_LIMIT}`)).json();
    if (!Array.isArray(d)) throw new Error('GATE: нет свечей');
    // формат строки: [время, объём, close, high, low, open, ...]
    out = d.map(k => ({ time: Number(k[0]), open: parseFloat(k[5]), high: parseFloat(k[3]), low: parseFloat(k[4]), close: parseFloat(k[2]) }));
  } else throw new Error(`Неизвестная биржа: ${exchange}`);
  return out.filter(c => [c.open, c.high, c.low, c.close].every(Number.isFinite)).sort((a, b) => a.time - b.time).slice(-TF_LIMIT);
}

// Совмещает две серии свечей по ближайшему совпадающему времени и делит цену1/цена2
// Компактная 24-часовая история соотношения (для мини-графика в списке) — кэшируется на 5 минут
const sparkCache = new Map();
const SPARK_TTL_MS = 5 * 60 * 1000;

export async function getSparkline(pair) {
  const key = `spark:${pair.id}:${pair.exchange1}:${pair.asset1}:${pair.exchange2}:${pair.asset2}`;
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
