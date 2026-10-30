'use client';
import { useEffect, useRef, useState } from 'react';

// Шапка (цена, изменение) и график — бесплатные встраиваемые виджеты TradingView, без ключей.
// Тема следует за переключателем сайта (data-theme на <html>).
function useTheme() {
  const [theme, setTheme] = useState('dark');
  useEffect(() => {
    const read = () => setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

function Widget({ src, config, className, style }) {
  const ref = useRef(null);
  const json = JSON.stringify(config);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.height = '100%';
    inner.style.width = '100%';
    host.appendChild(inner);
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.type = 'text/javascript';
    s.innerHTML = json;
    host.appendChild(s);
    return () => { host.innerHTML = ''; };
  }, [src, json]);
  return <div ref={ref} className={`tradingview-widget-container ${className || ''}`} style={style} />;
}

export default function TvChart({ symbols = ['BINANCE:BTCUSDT', 'BINANCE:ETHUSDT'] }) {
  const theme = useTheme();
  const bg = theme === 'light' ? '#ffffff' : '#0b0e11';
  return (
    <div className="tv-pair">
      {symbols.map(symbol => (
        <div className="tv-box" key={symbol}>
          <Widget
            className="tv-head"
            src="https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js"
            config={{ symbol, width: '100%', locale: 'ru', colorTheme: theme, isTransparent: true }}
          />
          <Widget
            className="tv-chart"
            src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
            config={{
              autosize: true, symbol, interval: '60', timezone: 'Europe/Moscow', theme, style: '1', locale: 'ru',
              backgroundColor: bg, gridColor: theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)',
              allow_symbol_change: false, hide_side_toolbar: true, hide_top_toolbar: false, hide_legend: false,
              save_image: false, withdateranges: true, calendar: false, support_host: 'https://www.tradingview.com',
            }}
          />
        </div>
      ))}
    </div>
  );
}
