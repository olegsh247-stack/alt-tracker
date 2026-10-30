'use client';
import { useEffect, useState } from 'react';

const FILTERS = [
  { key: 'key', label: 'Важное' },
  { key: 'security', label: 'Безопасность' },
  { key: 'tech', label: 'Протокол' },
  { key: 'tokenomics', label: 'Токеномика' },
  { key: 'gov', label: 'Голосование' },
  { key: 'reg', label: 'Регуляторика' },
  { key: 'flows', label: 'Потоки' },
  { key: 'research', label: 'Аналитика' },
  { key: 'all', label: 'Все' },
];

function ago(ts) {
  const m = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (m < 60) return `${Math.max(1, m)}м`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}ч`;
  return `${Math.floor(h / 24)}д`;
}

export default function NewsFeed() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('key');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('/api/news');
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (alive) { setData(j); setError(false); }
      } catch { if (alive) setError(true); }
    };
    load();
    const t = setInterval(load, 15 * 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const items = (data?.items || []).filter(it => {
    if (filter === 'all') return true;
    if (filter === 'key') return it.cat !== 'other' && !it.noise;
    return it.cat === filter;
  });

  return (
    <div className="news">
      <div className="news-filters">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`news-chip${filter === f.key ? ' active' : ''}`}>{f.label}</button>
        ))}
      </div>
      <div className="news-list">
        {!data && !error && <div className="news-empty">Загрузка новостей…</div>}
        {error && !data && <div className="news-empty">Новости временно недоступны. Обновятся автоматически.</div>}
        {data && items.length === 0 && <div className="news-empty">В этом разделе пока ничего нет.</div>}
        {items.map(it => (
          <a key={it.id} href={it.link} target="_blank" rel="noopener noreferrer" className="news-item">
            <div className="news-meta">
              <span>{it.source}</span>
              {it.label && <span className="news-tag">{it.label}</span>}
              <span className="news-time">{ago(it.ts)}</span>
            </div>
            <div className="news-title">{it.title}</div>
          </a>
        ))}
        {data?.failed?.length > 0 && <div className="news-foot">Не ответили: {data.failed.join(', ')}</div>}
      </div>
    </div>
  );
}
