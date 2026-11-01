// Флаг страны картинкой (эмодзи-флаги не рисуются на Windows). Набор flag-icons через jsDelivr.
export default function Flag({ cc, width = 24 }) {
  if (!cc) return <span style={{ display: 'inline-block', width, height: Math.round(width * 0.75) }} />;
  return (
    <img
      src={`https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/${cc}.svg`}
      alt=""
      width={width}
      height={Math.round(width * 0.75)}
      loading="lazy"
      style={{ display: 'inline-block', borderRadius: 3, boxShadow: '0 0 0 1px var(--card-border)', objectFit: 'cover' }}
    />
  );
}
