'use client';
import { useState } from 'react';

// Значок монеты: CoinCap → логотип из DexScreener/CoinGecko (через /api/coin-icon) → цветной кружок с буквами
const hue = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

export default function CoinIcon({ symbol, size = 24, className }) {
  const sym = String(symbol || '');
  const [stage, setStage] = useState(0);
  const srcs = [
    `https://assets.coincap.io/assets/icons/${sym.toLowerCase()}@2x.png`,
    `/api/coin-icon?s=${encodeURIComponent(sym)}`,
  ];
  if (stage < srcs.length) {
    return (
      <img
        className={className}
        src={srcs[stage]}
        width={size}
        height={size}
        alt=""
        loading="lazy"
        onError={() => setStage(s => s + 1)}
        style={{ borderRadius: '50%', objectFit: 'cover', flex: 'none' }}
      />
    );
  }
  return (
    <span
      className={className}
      title={sym}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
        width: size, height: size, borderRadius: '50%',
        background: `hsl(${hue(sym)} 45% 32%)`, color: '#fff',
        fontSize: Math.max(8, Math.round(size * 0.36)), fontWeight: 700, lineHeight: 1,
      }}
    >{sym.slice(0, 3).toUpperCase()}</span>
  );
}
