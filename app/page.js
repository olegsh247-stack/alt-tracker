'use client';
import { useEffect, useState } from 'react';
import ThemeToggle from '../components/ThemeToggle';

function icon(asset) {
  return `https://assets.coincap.io/assets/icons/${asset.toLowerCase()}@2x.png`;
}

export default function HomePage() {
  const [pairs, setPairs] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

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
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  async function removePair(e, id) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Удалить эту пару?')) return;
    setDeletingId(id);
    const r = await fetch(`/api/pairs/${id}`, { method: 'DELETE' });
    if (r.ok) setPairs(prev => prev.filter(p => p.id !== id));
    setDeletingId(null);
  }

  return (
    <div className="page-wrap" style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Мои пары</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <ThemeToggle />
          <a href="/add" style={plusBtn}>+</a>
          <button onClick={logout} style={logoutBtn}>Выйти</button>
        </div>
      </div>

      {loading && <p>Загрузка...</p>}
      {!loading && pairs.length === 0 && <p style={{ opacity: 0.7 }}>Пар пока нет — нажмите "+", чтобы добавить первую.</p>}

      {pairs.map(p => {
        const price = prices[p.id];
        return (
          <a key={p.id} href={`/pair/${p.id}`} className="pair-row" style={row}>
            <div className="cell-icons" style={{ display: 'flex', gap: 4 }}>
              <img src={icon(p.asset1)} width={24} height={24} onError={e => e.target.style.visibility = 'hidden'} />
              <img src={icon(p.asset2)} width={24} height={24} onError={e => e.target.style.visibility = 'hidden'} />
            </div>
            <div className="cell-name" style={{ flex: 1, minWidth: 90 }}>{p.asset1}/{p.asset2}</div>
            <div className="cell-price" style={cell}>{price?.price1 ? price.price1.toFixed(6) : '—'}</div>
            <div className="cell-price second" style={cell}>{price?.price2 ? price.price2.toFixed(6) : '—'}</div>
            <div className="cell-exchange" style={{ ...cell, opacity: 0.6, fontSize: 12 }}>{p.exchange1}/{p.exchange2}</div>
            <div className="cell-ratio" style={{ ...cell, fontWeight: 600 }}>{price?.ratio ? price.ratio.toFixed(6) : '—'}</div>
            <div className="cell-actions">
              <button
                onClick={(e) => removePair(e, p.id)}
                disabled={deletingId === p.id}
                title="Удалить пару"
                style={minusBtn}
              >
                {deletingId === p.id ? '…' : '–'}
              </button>
            </div>
          </a>
        );
      })}
    </div>
  );
}

const row = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px',
  borderBottom: '1px solid var(--card-border)', textDecoration: 'none', color: 'var(--text)',
};
const cell = { minWidth: 80, textAlign: 'right' };
const plusBtn = {
  width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--accent)', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 20,
};
const logoutBtn = { background: 'none', border: '1px solid var(--input-border)', color: 'var(--text-dim)', borderRadius: 8, padding: '0 12px' };
const minusBtn = {
  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--danger-bg)', color: 'var(--danger)', border: 'none', borderRadius: 8,
  fontSize: 18, lineHeight: 1, cursor: 'pointer',
};
