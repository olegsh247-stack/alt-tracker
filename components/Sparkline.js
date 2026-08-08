export default function Sparkline({ points, width = 70, height = 24 }) {
  if (!points || points.length < 2) {
    return <svg width={width} height={height} />;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const up = points[points.length - 1] >= points[0];

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={width} height={height}>
      <polyline points={coords} fill="none" stroke={up ? '#26a69a' : '#ef5350'} strokeWidth="1.5" />
    </svg>
  );
}
