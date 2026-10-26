import { networkFor } from '../lib/networks';

// Значок сети: цветной кружок с короткой подписью. size: 'sm' (в строках) или 'md' (в выборе сети)
export default function NetworkBadge({ network, size = 'sm' }) {
  const n = networkFor(network);
  const d = size === 'md' ? 22 : 16;
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
