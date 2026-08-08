// Все три биржи дают публичные данные без ключей и регистрации.

function symbolFor(exchange, asset) {
  const a = asset.toUpperCase();
  if (exchange === 'OKX') return `${a}-USDT`;
  return `${a}USDT`; // BINANCE, BYBIT
}

// Текущая цена актива в USDT
export async function getPrice(exchange, asset) {
  const symbol = symbolFor(exchange, asset);

  if (exchange === 'BINANCE') {
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    const d = await r.json();
    return parseFloat(d.price);
  }

  if (exchange === 'BYBIT') {
    const r = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`);
    const d = await r.json();
    return parseFloat(d.result.list[0].lastPrice);
  }

  if (exchange === 'OKX') {
    const r = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${symbol}`);
    const d = await r.json();
    return parseFloat(d.data[0].last);
  }

  throw new Error(`Неизвестная биржа: ${exchange}`);
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

  throw new Error(`Неизвестная биржа: ${exchange}`);
}

// Совмещает две серии свечей по ближайшему совпадающему времени и делит цену1/цена2
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
