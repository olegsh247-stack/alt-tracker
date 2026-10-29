// 3 значащие цифры: $2,31M, $98,0M, $210M, $35,5K, $420K
const sig3 = (x) => (x >= 100 ? String(Math.round(x)) : x >= 10 ? x.toFixed(1) : x.toFixed(2)).replace('.', ',');
export function fmtUsd(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e9) return `$${sig3(v / 1e9)}B`;
  if (a >= 1e6) return `$${sig3(v / 1e6)}M`;
  if (a >= 1e3) return `$${sig3(v / 1e3)}K`;
  return `$${v.toFixed(0)}`;
}
export function fmtPct(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v >= 0 ? '+' : '';
  const a = Math.abs(v);
  if (a >= 1e6) return `${sign}${Math.round(v / 1e6)}M%`;
  if (a >= 1e4) return `${sign}${Math.round(v / 1e3)}K%`;
  if (a >= 1e3) return `${sign}${Math.round(v)}%`;
  return `${sign}${v.toFixed(1).replace('.', ',')}%`;
}
export function fmtFee(v, approx = false) {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${approx ? '~' : ''}${String(+v.toFixed(3)).replace('.', ',')}%`;
}
export function fmtApr(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v >= 1000 ? Math.round(v) : v.toFixed(1).replace('.', ',')}%`;
}
export function fmtAge(iso) {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return '<1д';
  if (days < 60) return `${days}д`;
  if (days < 730) return `${Math.floor(days / 30)}м`;
  return `${(days / 365).toFixed(1).replace('.', ',')}г`;
}
