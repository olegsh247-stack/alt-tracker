'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Flag from '../../components/Flag';
import { CURRENCIES, DEFAULT_FOREX } from '../../lib/currencies';

export default function AddCurrencyPage() {
  const router = useRouter();
  const [tracked, setTracked] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('forexCodes');
      setTracked(raw ? JSON.parse(raw) : DEFAULT_FOREX);
    } catch { setTracked(DEFAULT_FOREX); }
  }, []);

  function toggle(code) {
    const next = tracked.includes(code) ? tracked.filter(c => c !== code) : [...tracked, code];
    setTracked(next);
    try { localStorage.setItem('forexCodes', JSON.stringify(next)); } catch {}
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = CURRENCIES.filter(c => !tracked.includes(c.code));
    if (!q) return items;
    const score = (c) => {
      const code = c.code.toLowerCase(), ru = c.name.toLowerCase(), en = c.en.toLowerCase();
      if (code === q) return 0;
      if (code.startsWith(q)) return 1;
      if (ru.startsWith(q) || en.startsWith(q)) return 2;
      if ([...ru.split(' '), ...en.split(' ')].some(w => w.startsWith(q))) return 3;
      return 9;
    };
    return items.map(c => [score(c), c]).filter(([s]) => s < 9).sort((a, b) => a[0] - b[0]).map(([, c]) => c);
  }, [tracked, query]);

  const mine = tracked.map(code => CURRENCIES.find(c => c.code === code)).filter(Boolean);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={header}>
        <button onClick={() => router.push('/?tab=forex')} style={backBtn}>← Forex</button>
        <h1 style={{ margin: 0, fontSize: 26 }}>Валюты</h1>
      </div>

      <section style={section}>
        <div style={sectionTitle}><h2 style={h2}>Мои валюты</h2><span style={count}>{mine.length}</span></div>
        {mine.length === 0 ? <div style={empty}>Пока ничего не добавлено. Найдите валюту ниже.</div> : mine.map(c => <Row key={c.code} c={c} added onToggle={() => toggle(c.code)} />)}
      </section>

      <section style={section}>
        <div style={sectionTitle}><h2 style={h2}>Добавить валюту</h2><span style={count}>{results.length}</span></div>
        <input
          type="search" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Тикер или название: E, EUR, рубль…" autoComplete="off" autoCapitalize="none" spellCheck={false} style={input}
        />
        <div style={{ height: 6 }} />
        {results.map(c => <Row key={c.code} c={c} onToggle={() => toggle(c.code)} />)}
        {results.length === 0 && <div style={empty}>Ничего не найдено.</div>}
      </section>
    </div>
  );
}

function Row({ c, added, onToggle }) {
  return (
    <div style={row}>
      <Flag cc={c.cc} width={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700 }}>{c.code}</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
      </div>
      <button onClick={onToggle} style={added ? addedBtn : addBtn}>{added ? '✓ Добавлено' : '+ Добавить'}</button>
    </div>
  );
}

const header = { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 };
const backBtn = { border: '1px solid var(--input-border)', background: 'none', color: 'var(--text)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' };
const section = { marginTop: 24 };
const sectionTitle = { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 };
const h2 = { margin: 0, fontSize: 18 };
const count = { color: 'var(--text-dim)', fontSize: 14 };
const empty = { padding: 18, border: '1px dashed var(--card-border)', borderRadius: 10, color: 'var(--text-dim)' };
const input = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', fontSize: 16, borderRadius: 8, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)' };
const row = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: '1px solid var(--card-border)' };
const addBtn = { border: '1px solid var(--up)', background: 'none', color: 'var(--up)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' };
const addedBtn = { border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-dim)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', whiteSpace: 'nowrap' };
