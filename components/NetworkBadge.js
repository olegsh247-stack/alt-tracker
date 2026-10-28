'use client';
import { useState } from 'react';
import { networkFor } from '../lib/networks';

// Значок сети (картинка из /public/networks/<key>.png). size: 'sm' (в строках) или 'md' (в выборе сети).
// Если картинки нет — цветной кружок с короткой подписью.
export default function NetworkBadge({ network, size = 'sm' }) {
  const n = networkFor(network);
  const d = size === 'md' ? 22 : 18;
  const [broken, setBroken] = useState(false);
  if (!broken) {
    return (
      <img
        src={`/networks/${n.key}.png`}
        alt={n.label}
        title={n.label}
        width={d}
        height={d}
        onError={() => setBroken(true)}
        style={{ flex: 'none', width: d, height: d, borderRadius: '50%', objectFit: 'contain', display: 'inline-block' }}
      />
    );
  }
  return (
    <span
      title={n.label}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
        width: d, height: d, borderRadius: '50%', background: n.color, color: '#fff',
        fontSize: size === 'md' ? 8 : 6, fontWeight: 800, letterSpacing: 0, lineHeight: 1, overflow: 'hidden',
      }}
    >{n.short.slice(0, 4)}</span>
  );
}
