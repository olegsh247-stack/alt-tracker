'use client';
import { useEffect, useState } from 'react';
import TvChart from './TvChart';

// График выбранной монеты: TradingView (если она торгуется на крупной бирже), иначе главный DEX-пул (DexScreener).
const memo = new Map(); // SYMBOL -> ответ сервера: повторный выбор монеты открывается мгновенно

export default function AssetChart({ symbol, name }) {
  const [res, setRes] = useState(null);
  const [light, setLight] = useState(false);

  useEffect(() => {
    const read = () => setLight(document.documentElement.getAttribute('data-theme') === 'light');
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    if (!symbol) { setRes(null); return; }
    let alive = true;
    const cached = memo.get(symbol);
    if (cached) { setRes(cached); return () => { alive = false; }; }
    setRes(null);
    fetch(`/api/chart-symbol?s=${encodeURIComponent(symbol)}`)
      .then(r => r.json()).then(j => { if (j && j.kind && j.kind !== 'none') memo.set(symbol, j); if (alive) setRes(j); })
      .catch(() => { if (alive) setRes({ kind: 'none' }); });
    return () => { alive = false; };
  }, [symbol]);

  if (!symbol) return <div className="pool-chart pool-chart-empty">Выберите монету в списке, чтобы увидеть график</div>;
  if (!res) return <div className="pool-chart pool-chart-empty">Загрузка графика…</div>;
  if (res.kind === 'stable') return <div className="pool-chart pool-chart-empty">{symbol} — стейблкоин, его цена держится у $1, график не показываем.</div>;
  if (res.kind === 'tv') return (
    <div className="asset-chart">
      <div className="asset-chart-title"><b>{symbol}</b></div>
      <TvChart key={res.symbol} symbols={[res.symbol]} />
    </div>
  );
  if (res.kind === 'dex') {
    const src = `https://dexscreener.com/${res.chain}/${res.pair}?embed=1&theme=${light ? 'light' : 'dark'}&trades=0&info=0&interval=240`;
    return (
      <div className="pool-chart">
        <div className="pool-chart-head">
          <span className="pool-chart-name">{res.name}</span>
          <span className="pool-chart-sub">{[res.chain, res.dex].filter(Boolean).join(' · ')} · главный DEX-пул</span>
        </div>
        <iframe key={`${src}`} title={res.name} src={src} className="pool-chart-frame" loading="lazy" />
      </div>
    );
  }
  return <div className="pool-chart pool-chart-empty">Для {symbol} график не нашёлся: монета не торгуется на крупных биржах и DEX.</div>;
}
