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

  // адреса контрактов: из данных пула, а если их нет (старый выбор) — запрашиваем отдельно
  const [fetched, setFetched] = useState(null);
  const [copied, setCopied] = useState(null);
  const hasAddr = !!(pool?.baseAddress || pool?.quoteAddress);
  useEffect(() => {
    setFetched(null);
    if (!pool || hasAddr) return;
    let alive = true;
    fetch(`/api/pool-tokens?network=${encodeURIComponent(pool.network)}&address=${encodeURIComponent(pool.address)}`)
      .then(r => r.json()).then(j => { if (alive) setFetched(j.tokens || null); }).catch(() => {});
    return () => { alive = false; };
  }, [pool?.network, pool?.address, hasAddr]);
  const baseAddr = pool?.baseAddress || fetched?.baseAddress || null;
  const quoteAddr = pool?.quoteAddress || fetched?.quoteAddress || null;
  const short = (a) => (a && a.length > 14 ? `${a.slice(0, a.startsWith('0x') ? 6 : 4)}…${a.slice(-4)}` : a);
  async function copy(a, key) {
    try { await navigator.clipboard.writeText(a); setCopied(key); setTimeout(() => setCopied(null), 1200); } catch {}
  }

  if (!pool) {
    return <div className="pool-chart pool-chart-empty">Выберите пул в списке, чтобы увидеть график</div>;
  }
  const src = `https://www.geckoterminal.com/${pool.network}/pools/${pool.address}?embed=1&info=0&swaps=0&grayscale=0&light_chart=${light ? 1 : 0}&chart_type=price&resolution=4h`;
  const ch = pool.change24;
  return (
    <div className="pool-chart">
      <div className="pool-chart-head">
        <NetworkBadge network={pool.network} />
        <span className="pool-chart-name">{pool.base}/{pool.quote}</span>
        <span className="pool-chart-sub">{[pool.feePct != null ? fmtFee(pool.feePct, pool.feeApprox) : null, pool.dex].filter(Boolean).join(' ')}</span>
        {ch != null && <span className="pool-chart-chg" style={{ color: ch >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtPct(ch)}</span>}
      </div>
      {(baseAddr || quoteAddr) && (
        <div className="pool-chart-addrs">
          {[[baseAddr, pool.base, 'b'], [quoteAddr, pool.quote, 'q']].map(([a, sym, k]) => (
            <button key={k} type="button" className={`pc-addr ${k}`} onClick={() => a && copy(a, k)} disabled={!a} title={a ? `${sym}: ${a} (нажмите, чтобы скопировать)` : ''}>
              <span className="pc-sym">{sym}</span>
              <span className="pc-hex">{a ? (copied === k ? 'скопировано ✓' : short(a)) : '—'}</span>
            </button>
          ))}
        </div>
      )}
      <iframe key={`${pool.network}:${pool.address}:${light}`} title={`${pool.base}/${pool.quote}`} src={src} className="pool-chart-frame" loading="lazy" allow="clipboard-write" />
    </div>
  );
}
