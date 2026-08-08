'use client';
import { useEffect, useState } from 'react';
import ThemeToggle from '../components/ThemeToggle';
import Sparkline from '../components/Sparkline';

function icon(asset) {
  return `https://assets.coincap.io/assets/icons/${asset.toLowerCase()}@2x.png`;
}

export default function HomePage() {
  const [pairs, setPairs] = useState([]);
  const [prices, setPrices] = useState({});
  const [sparks, setSparks] = useState({});
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [tgConnected, setTgConnected] = useState(null);
  const [tgBusy, setTgBusy] = useState(false);
  const [tgMsg, setTgMsg] = useState('');

  async function load() {
    const [pRes, priceRes, sparkRes, tgRes] = await Promise.all([
      fetch('/api/pairs').then(r => r.json()),
      fetch('/api/prices').then(r => r.json()),
      fetch('/api/sparkline').then(r => r.json()),
      fetch('/api/telegram').then(r => r.json()),
    ]);
    setPairs(pRes.pairs || []);
    const map = {};
    (priceRes.prices || []).forEach(p => { map[p.id] = p; });
    setPrices(map);
    const smap = {};
    (sparkRes.sparklines || []).forEach(s => { smap[s.id] = s; });
    setSparks(smap);
    setTgConnected(!!tgRes.connected);
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

  async function move(e, index, dir) {
    e.preventDefault();
    e.stopPropagation();
    const j = index + dir;
    if (j < 0 || j >= pairs.length) return;
    const a = pairs[index], b = pairs[j];
    const newPairs = [...pairs];
    [newPairs[index], newPairs[j]] = [newPairs[j], newPairs[index]];
    setPairs(newPairs);
    await Promise.all([
      fetch(`/api/pairs/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: b.sort_order }) }),
      fetch(`/api/pairs/${b.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: a.sort_order }) }),
    ]);
  }

  async function connectTelegram(e) {
    e.preventDefault();
    setTgBusy(true);
    setTgMsg('');
    const r = await fetch('/api/telegram', { method: 'POST' });
    const d = await r.json();
    if (!r.ok) { setTgMsg(d.error); } else { setTgConnected(true); setTgMsg('Подключено!'); }
    setTgBusy(false);
  }

  return (
    <div className="page-wrap" style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Мои пары</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <ThemeToggle />
          <a href="/add" style={plusBtn}>+</a>
          <button onClick={logout} style={logoutBtn}>Выйти</button>
        </div>
      </div>

      {tgConnected === false && (
        <div style={tgBanner}>
          <span>Telegram не подключён — уведомления по порогам приходить не будут.</span>
          <button onClick={connectTelegram} disabled={tgBusy} style={tgBtn}>
            {tgBusy ? '...' : 'Подключить'}
          </button>
          {tgMsg && <span style={{ fontSize: 12, opacity: 0.8 }}>{tgMsg}</span>}
        </div>
      )}

      {loading && <p>Загрузка...</p>}
      {!loading && pairs.length === 0 && <p style={{ opacity: 0.7 }}>Пар пока нет — нажмите "+", чтобы добавить первую.</p>}

      {pairs.map((p, i) => {
        const price = prices[p.id];
        const spark = sparks[p.id];
        const pct = spark?.changePct;
        const pctColor = pct == null ? 'var(--text-dim)' : pct >= 0 ? '#26a69a' : '#ef5350';
        return (
          <a key={p.id} href={`/pair/${p.id}`} className="pair-row" style={row}>
            <div className="cell-order" style={{ display: 'flex', flexDirection: 'column' }}>
              <button onClick={(e) => move(e, i, -1)} style={arrowBtn} disabled={i === 0}>▲</button>
              <button onClick={(e) => move(e, i, 1)} style={arrowBtn} disabled={i === pairs.length - 1}>▼</button>
            </div>
            <div className="cell-icons" style={{ display: 'flex', gap: 4 }}>
              <img src={icon(p.asset1)} width={24} height={24} onError={e => e.target.style.visibility = 'hidden'} />
              <img src={icon(p.asset2)} width={24} height={24} onError={e => e.target.style.visibility = 'hidden'} />
            </div>
            <div className="cell-name" style={{ flex: 1, minWidth: 90 }}>{p.asset1}/{p.asset2}</div>
            <div className="cell-price" style={cell}>{price?.price1 ? price.price1.toFixed(6) : '—'}</div>
            <div className="cell-price second" style={cell}>{price?.price2 ? price.price2.toFixed(6) : '—'}</div>
            <div className="cell-exchange" style={{ ...cell, opacity: 0.6, fontSize: 12 }}>{p.exchange1}/{p.exchange2}</div>
            <Sparkline points={spark?.closes} />
            <div className="cell-ratio" style={{ ...cell, fontWeight: 600 }}>
              {price?.ratio ? price.ratio.toFixed(6) : '—'}
              <div style={{ fontSize: 11, color: pctColor }}>
                {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% (24ч)` : ''}
              </div>
            </div>
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
  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 8px',
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
const arrowBtn = {
  background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer',
  fontSize: 10, padding: 0, lineHeight: 1.4,
};
const tgBanner = {
  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
  background: 'var(--input-bg)', border: '1px solid var(--input-border)',
  borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13,
};
const tgBtn = {
  padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--accent)',
  color: '#fff', fontSize: 13, cursor: 'pointer',
};
