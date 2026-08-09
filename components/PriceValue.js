// Показывает цену как обычно (4 знака), а для очень маленьких значений —
// в формате 0,0₅12 (нижний индекс = сколько нулей подряд после запятой)
export default function PriceValue({ value, style }) {
  if (value == null || Number.isNaN(value)) return <span style={style}>—</span>;
  if (value === 0) return <span style={style}>0</span>;

  const normal = value.toFixed(4);
  if (parseFloat(normal) !== 0) {
    return <span style={style}>{normal.replace('.', ',')}</span>;
  }

  const str = value.toFixed(18);
  const dec = (str.split('.')[1] || '');
  let zeroCount = 0;
  while (zeroCount < dec.length && dec[zeroCount] === '0') zeroCount++;
  let significant = dec.slice(zeroCount, zeroCount + 4).replace(/0+$/, '');
  if (!significant) significant = '0';

  return (
    <span style={style}>
      0,0<sub style={{ fontSize: '0.7em' }}>{zeroCount}</sub>{significant}
    </span>
  );
}
