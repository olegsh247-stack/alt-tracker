'use client';
import { useT } from './LangProvider';
import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

const LABEL = { '4h': '4H', '1d': '1D', '1w': '1W', '1y': '1Y', all: 'All' };
const DEFAULT_RANGES = ['1w', '1y', 'all'];
const memo = new Map(); // pairId:range -> свечи (мгновенное повторное открытие)

// Наш график пары Cross: линия (по умолчанию) или свечи, период 1M / 1Y / All.
export default function CrossChart({ pairId, sig = '', title, sub, endpoint = '/api/cross-klines', ranges = DEFAULT_RANGES }) {
  const t = useT();
  const boxRef = useRef(null);
  const [range, setRange] = useState(ranges[0]);
  const [mode, setMode] = useState('line');
  const [candles, setCandles] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    try {
      const m = localStorage.getItem('crossMode'); if (m === 'line' || m === 'candle') setMode(m);
    } catch {}
  }, []);

  useEffect(() => {
    if (!pairId) { setCandles(null); return; }
    const key = `${endpoint}:${pairId}:${sig}:${range}`;
    let alive = true;
    setErr('');
    if (memo.has(key)) setCandles(memo.get(key)); else setCandles(null);
    fetch(`${endpoint}?pairId=${pairId}&range=${range}`)
      .then(r => r.json())
      .then(d => {
        if (!alive) return;
        if (d.error) { setErr(d.error); return; }
        memo.set(key, d.candles || []);
        setCandles(d.candles || []);
      })
      .catch(() => { if (alive) setErr('Не удалось получить историю цен'); });
    return () => { alive = false; };
  }, [endpoint, pairId, sig, range]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !candles || candles.length === 0) return;
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    const up = light ? '#1a7f37' : '#00e676', down = light ? '#cf222e' : '#ff5252';
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { color: light ? '#ffffff' : '#060f11' }, textColor: light ? '#333' : '#ccc' },
      grid: { vertLines: { color: light ? '#eee' : '#102224' }, horzLines: { color: light ? '#eee' : '#102224' } },
      timeScale: { timeVisible: ['1w', '1d', '4h'].includes(range), borderVisible: false, rightOffset: 0, fixRightEdge: true, fixLeftEdge: true, rightBarStaysOnScroll: true },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      rightPriceScale: { borderVisible: false },
      localization: { priceFormatter: (p) => (Math.abs(p) >= 100 ? p.toFixed(2) : Math.abs(p) >= 1 ? p.toFixed(4) : p.toPrecision(4)) },
    });
    if (mode === 'candle') {
      const s = chart.addCandlestickSeries({ upColor: up, downColor: down, borderVisible: false, wickUpColor: up, wickDownColor: down, priceFormat: { type: 'price', precision: 6, minMove: 0.000001 } });
      s.setData(candles);
    } else {
      const first = candles[0].close, last = candles[candles.length - 1].close;
      const s = chart.addLineSeries({ color: last >= first ? up : down, lineWidth: 2, priceFormat: { type: 'price', precision: 6, minMove: 0.000001 } });
      s.setData(candles.map(c => ({ time: c.time, value: c.close })));
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [candles, mode, range]);

  function pickRange(r) { setRange(r); }
  function pickMode(m) { setMode(m); try { localStorage.setItem('crossMode', m); } catch {} }

  return (
    <div className="cross-chart">
      <div className="cc-head">
        <div className="cc-title"><b>{title || ''}</b>{sub && <span>{sub}</span>}</div>
        <div className="cc-ctrl">
          {ranges.map((k) => <button key={k} className={`cc-btn${range === k ? ' on' : ''}`} onClick={() => pickRange(k)}>{LABEL[k]}</button>)}
          <span className="cc-sep" />
          <button className={`cc-btn${mode === 'line' ? ' on' : ''}`} onClick={() => pickMode('line')} title={t('Линия')}>{t('Линия')}</button>
          <button className={`cc-btn${mode === 'candle' ? ' on' : ''}`} onClick={() => pickMode('candle')} title={t('Свечи')}>{t('Свечи')}</button>
        </div>
      </div>
      <div className="cc-body">
        {!pairId && <div className="cc-msg">{t('Выберите пару в списке, чтобы увидеть график')}</div>}
        {pairId && err && <div className="cc-msg" style={{ color: 'var(--danger)' }}>{t(err)}</div>}
        {pairId && !err && !candles && <div className="cc-msg">{t('Загрузка графика…')}</div>}
        {pairId && !err && candles && candles.length === 0 && <div className="cc-msg">{t('Нет данных за этот период.')}</div>}
        <div ref={boxRef} className="cc-canvas" style={{ display: candles && candles.length ? 'block' : 'none' }} />
      </div>
    </div>
  );
}
