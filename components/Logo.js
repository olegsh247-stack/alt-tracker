// Знак «Δ» (дельта — изменение): строгий треугольник с морским градиентом
export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Alt Tracker" style={{ flex: 'none', display: 'block' }}>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#0d9488" />
          <stop offset="1" stopColor="#5eead4" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="26" fill="#0b1a1d" stroke="#17302f" strokeWidth="2" />
      <path fillRule="evenodd" fill="url(#logo-g)" d="M60 18 L104 98 H16 Z M60 52 L77 84 H43 Z" />
    </svg>
  );
}
