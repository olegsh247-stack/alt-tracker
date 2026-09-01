'use client';
import { useEffect, useRef, useState } from 'react';

function fmtPrice(p) {
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toPrecision(3);
}

// placeholder: подсказка в поле; onPick(asset, exchange): вызывается при выборе строки
export default function TickerPicker({ placeholder, onPick }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function onChange(e) {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    clearTimeout(debounceRef.current);
    if (!v.trim()) { setResults([]); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/ticker-search?q=${encodeURIComponent(v.trim())}`);
        const d = await r.json();
        setResults(d.results || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
  }

  function pick(row) {
    setQuery(row.asset);
    onPick(row.asset, row.exchange);
    setOpen(false);
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        placeholder={placeholder}
        value={query}
        onChange={onChange}
        onFocus={() => query && setOpen(true)}
        autoComplete="off"
        style={input}
      />
      {open && query.trim() && (
        <div style={dropdown}>
          {loading && <div style={rowMsg}>Ищу…</div>}
          {!loading && results.length === 0 && <div style={rowMsg}>Ничего не найдено</div>}
          {!loading && results.map((r, i) => {
            const up = r.changePct >= 0;
            return (
              <div key={`${r.asset}-${r.exchange}-${i}`} onClick={() => pick(r)} style={row}>
                <span style={{ fontWeight: 600 }}>{r.asset}</span>
                <span style={exchangeBadge}>{r.exchange}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span>{fmtPrice(r.price)}</span>
                  <span style={{ color: up ? '#26a69a' : '#ef5350', fontSize: 12 }}>
                    ({up ? '+' : ''}{r.changePct.toFixed(1)}%)
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const input = { width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box' };
const dropdown = {
  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 260, overflowY: 'auto',
  background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 8, zIndex: 20,
  boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
};
const row = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer',
  borderBottom: '1px solid var(--card-border)', fontSize: 14,
};
const rowMsg = { padding: '10px 12px', fontSize: 13, opacity: 0.6 };
const exchangeBadge = {
  fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
  border: '1px solid var(--card-border)', color: 'var(--text-dim)',
};
