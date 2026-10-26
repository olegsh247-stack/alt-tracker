export function fmtUsd(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}
export function fmtPct(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}%`;
}
export function fmtFee(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${String(+v.toFixed(3)).replace('.', ',')}%`;
}
export function fmtAge(iso) {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return '<1д';
  if (days < 60) return `${days}д`;
  if (days < 730) return `${Math.floor(days / 30)}мес`;
  return `${(days / 365).toFixed(1).replace('.', ',')}г`;
}
