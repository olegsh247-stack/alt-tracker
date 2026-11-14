// Cross: пары из любых активов — крипта (биржи), товары (Yahoo), валюты (Yahoo / open.er-api).
// Сторона пары хранится в таблице pairs парой (asset, exchange):
//   крипта: ('BTC', 'BINANCE'), товар: ('cocoa', 'COM'), валюта: ('KZT', 'FX').
// Всё приводим к цене в USD, цена пары = USD-цена актива 1 / USD-цена актива 2.
import { getPrice, getKlines, getKlinesTF, buildRatioCandles } from './exchanges';
import { COMMODITIES, getCommodityPrice, getCommodityQuote, getCommodityKlines, getCommodityKlinesTF } from './commodities';
import { getRates } from './forex';
import { CURRENCY_CODES } from './currencies';

export const CRYPTO_EXCHANGES = ['BINANCE', 'BYBIT', 'OKX', 'MEXC', 'GATE'];
export const CROSS_COMMODITIES = COMMODITIES.filter(c => c.ticker); // USD берём из валют

export function legOf(asset, exchange) {
  if (exchange === 'COM') return { type: 'com', id: asset };
  if (exchange === 'FX') return { type: 'fx', id: asset };
  return { type: 'crypto', id: asset, exchange };
}

// Проверка и нормализация стороны, пришедшей от клиента. Возвращает { asset, exchange } или null.
export function normalizeSide(asset, exchange) {
  if (!asset || !exchange) return null;
  if (exchange === 'COM') {
    const k = String(asset).toLowerCase();
    return CROSS_COMMODITIES.some(c => c.key === k) ? { asset: k, exchange } : null;
  }
  if (exchange === 'FX') {
    const c = String(asset).toUpperCase();
    return CURRENCY_CODES.has(c) ? { asset: c, exchange } : null;
  }
  if (CRYPTO_EXCHANGES.includes(exchange)) {
    const a = String(asset).toUpperCase();
    return /^[A-Z0-9]{1,20}$/.test(a) ? { asset: a, exchange } : null;
  }
  return null;
}

// --- Текущая цена в USD и изменение за 24ч (%) ---
const changeCache = new Map(); // ключ ноги -> { v, ts }
const CHANGE_TTL = 5 * 60 * 1000;

async function cryptoChange(leg) {
  const key = `${leg.exchange}:${leg.id}`;
  const hit = changeCache.get(key);
  if (hit && Date.now() - hit.ts < CHANGE_TTL) return hit.v;
  let v = null;
  try {
    const s = (await getKlines(leg.exchange, leg.id, '1m')).slice(-24); // часовые свечи
    if (s.length >= 2 && s[0].close > 0) v = (s[s.length - 1].close / s[0].close - 1) * 100;
  } catch {}
  changeCache.set(key, { v, ts: Date.now() });
  return v;
}

export async function legQuote(leg) {
  if (leg.type === 'crypto') {
    const [price, change] = await Promise.all([getPrice(leg.exchange, leg.id), cryptoChange(leg)]);
    return { price, change };
  }
  if (leg.type === 'com') {
    try {
      const q = await getCommodityQuote(leg.id);
      return { price: q.price, change: q.change };
    } catch {
      return { price: await getCommodityPrice(leg.id), change: null };
    }
  }
  // валюта: цена 1 единицы в USD
  if (leg.id === 'USD') return { price: 1, change: 0 };
  const r = (await getRates('USD', [leg.id]))[leg.id];
  if (!r || !(r.price > 0)) throw new Error(`${leg.id}: нет курса`);
  return { price: r.price, change: r.change };
}

// --- История в USD ---
const fxCache = new Map();
const FX_TTL = 5 * 60 * 1000;
async function fxCandles(code, range) {
  const key = `${code}:${range}`;
  const hit = fxCache.get(key);
  if (hit && Date.now() - hit.ts < FX_TTL) return hit.v;
  const map = { all: ['5y', '1wk'], '1y': ['1y', '1d'], '1m': ['1mo', '1d'], '1w': ['5d', '1h'], d1: ['2y', '1d'], w1: ['10y', '1wk'], mo1: ['max', '1mo'] };
  const [rg, iv] = map[range] || map['1y'];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${code}=X?range=${rg}&interval=${iv}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AltTracker/1.0)' } });
  const d = await r.json();
  const res = d?.chart?.result?.[0];
  if (!res) throw new Error('Нет истории курса');
  const q = res.indicators?.quote?.[0] || {};
  // Yahoo даёт «сколько валюты за 1 USD» — переворачиваем в «сколько USD за 1 единицу»
  const out = (res.timestamp || []).map((t, i) => ({ time: t, open: q.open?.[i], high: q.high?.[i], low: q.low?.[i], close: q.close?.[i] }))
    .filter(c => c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)
    .map(c => ({ time: c.time, open: 1 / c.open, high: 1 / c.low, low: 1 / c.high, close: 1 / c.close }));
  fxCache.set(key, { v: out, ts: Date.now() });
  return out;
}
const TF_FX = { '1d': 'd1', '1w': 'w1', '1mo': 'mo1' };

// Свечи таймфрейма (4h доступен только у крипты). null — USD (константа 1).
export async function legCandlesTF(leg, tf) {
  if (leg.type === 'crypto') return getKlinesTF(leg.exchange, leg.id, tf);
  if (!TF_FX[tf]) throw new Error('Этот таймфрейм доступен только для крипты');
  if (leg.type === 'com') return getCommodityKlinesTF(leg.id, tf);
  if (leg.id === 'USD') return null;
  return (await fxCandles(leg.id, TF_FX[tf])).slice(-300);
}

// null — актив-константа (USD): его цена всегда 1
export async function legCandles(leg, range) {
  if (leg.type === 'crypto') return getKlines(leg.exchange, leg.id, range);
  if (leg.type === 'com') return getCommodityKlines(leg.id, range);
  if (leg.id === 'USD') return null;
  return fxCandles(leg.id, range);
}

const invert = (c) => ({ time: c.time, open: 1 / c.open, high: 1 / c.low, low: 1 / c.high, close: 1 / c.close });

// Свечи пары s1/s2. Опорная ось — более редкий ряд (иначе сильно разные шаги дают «лесенку»).
export function crossRatio(s1, s2) {
  if (!s1 && !s2) return [];
  if (!s2) return s1.map(c => ({ ...c }));
  if (!s1) return s2.map(invert);
  const clean = (arr) => arr.filter(c => c && c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0);
  const a = clean(s1), b = clean(s2);
  const res = a.length <= b.length ? buildRatioCandles(a, b) : buildRatioCandles(b, a).map(invert);
  // строго по возрастанию времени, без повторов (требование графика)
  const seen = new Set();
  return res.filter(c => !seen.has(c.time) && seen.add(c.time) && [c.open, c.high, c.low, c.close].every(Number.isFinite)).sort((x, y) => x.time - y.time);
}

export const SOURCE_NOTE = {
  crypto: (leg) => leg.exchange,
  com: () => 'Yahoo Finance',
  fx: () => 'Yahoo Finance',
};
