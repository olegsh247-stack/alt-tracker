'use client';
import { useEffect, useState } from 'react';

function icon(asset) {
  return `https://assets.coincap.io/assets/icons/${asset.toLowerCase()}@2x.png`;
}

export default function HomePage() {
  const [pairs, setPairs] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);

  async function load() {
    const [pRes, priceRes] = await Promise.all([
      fetch('/api/pairs').then(r => r.json()),
      fetch('/api/prices').then(r => r.json()),
    ]);
    setPairs(pRes.pairs || []);
    const map = {};
    (priceRes.prices || []).forEach(p => { map[p.id] = p; });
    setPrices(map);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // обновление цен каждые 15 сек
    return () => clearInterval(t);
  }, []);

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20 }}>Мои пары</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/add" style={plusBtn}>+</a>
          <button onClick={logout} style={logoutBtn}>Выйти</button>
        </div>
      </div>

      {loading && <p>Загрузка...</p>}
      {!loading && pairs.length === 0 && <p style={{ opacity: 0.7 }}>Пар пока нет — нажмите "+", чтобы добавить первую.</p>}

      {pairs.map(p => {
        const price = prices[p.id];
        return (
          <a key={p.id} href={`/pair/${p.id}`} style={row}>
            <div style={{ display: 'flex', gap: 4 }}>
              <img src={icon(p.asset1)} width={24} height={24} onError={e => e.target.style.visibility = 'hidden'} />
              <img src={icon(p.asset2)} width={24} height={24} onError={e => e.target.style.visibility = 'hidden'} />
            </div>
            <div style={{ flex: 1, minWidth: 90 }}>{p.asset1}/{p.asset2}</div>
            <div style={cell}>{price?.price1 ? price.price1.toFixed(6) : '—'}</div>
            <div style={cell}>{price?.price2 ? price.price2.toFixed(6) : '—'}</div>
            <div style={{ ...cell, opacity: 0.6, fontSize: 12 }}>{p.exchange1}/{p.exchange2}</div>
            <div style={{ ...cell, fontWeight: 600 }}>{price?.ratio ? price.ratio.toFixed(6) : '—'}</div>
          </a>
        );
      })}
    </div>
  );
}

const row = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px',
  borderBottom: '1px solid #22262b', textDecoration: 'none', color: '#e6e6e6',
};
const cell = { minWidth: 80, textAlign: 'right' };
const plusBtn = {
  width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#2b6cf6', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 20,
};
const logoutBtn = { background: 'none', border: '1px solid #333', color: '#aaa', borderRadius: 8, padding: '0 12px' };
