'use client';
import { useEffect, useState } from 'react';
import NetworkBadge from './NetworkBadge';
import { fmtFee, fmtPct } from '../lib/format';

// График выбранного пула — официальный встраиваемый график GeckoTerminal (загружается в браузере, без ключей)
export default function PoolChart({ pool }) {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const read = () => setLight(document.documentElement.getAttribute('data-theme') === 'light');
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);

  if (!pool) {
    return <div className="pool-chart pool-chart-empty">Выберите пул в списке, чтобы увидеть график</div>;
  }
  const src = `https://www.geckoterminal.com/${pool.network}/pools/${pool.address}?embed=1&info=0&swaps=0&grayscale=0&light_chart=${light ? 1 : 0}&chart_type=price&resolution=15m`;
  const ch = pool.change24;
  return (
    <div className="pool-chart">
      <div className="pool-chart-head">
        <NetworkBadge network={pool.network} />
        <span className="pool-chart-name">{pool.base}/{pool.quote}</span>
        <span className="pool-chart-sub">{[pool.feePct != null ? fmtFee(pool.feePct, pool.feeApprox) : null, pool.dex].filter(Boolean).join(' ')}</span>
        {ch != null && <span className="pool-chart-chg" style={{ color: ch >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtPct(ch)}</span>}
      </div>
      <iframe key={`${pool.network}:${pool.address}:${light}`} title={`${pool.base}/${pool.quote}`} src={src} className="pool-chart-frame" loading="lazy" allow="clipboard-write" />
    </div>
  );
}
