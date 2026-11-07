'use client';
import { useT, useLang } from './LangProvider';
import { useMemo, useState } from 'react';
import TickerPicker from './TickerPicker';
import Flag from './Flag';
import { CROSS_COMMODITIES } from '../lib/crossMeta';
import { CURRENCIES, currencyName } from '../lib/currencies';

const KINDS = [['crypto', 'Крипто'], ['com', 'Товары'], ['fx', 'Валюты']];

function SidePicker({ title, value, onChange }) {
  const t = useT();
  const { lang } = useLang();
  const [kind, setKind] = useState('crypto');
  const [q, setQ] = useState('');
  const fx = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? CURRENCIES.filter(c => c.code.toLowerCase().startsWith(s) || c.name.toLowerCase().includes(s) || c.en.toLowerCase().includes(s)) : CURRENCIES;
    return list.slice(0, 40);
  }, [q]);

  return (
    <div className="cp-side">
      <div className="cp-title">
        <span>{title}</span>
        {value && <span className="cp-picked">✓ {value.label}</span>}
      </div>
      <div className="cp-kinds">
        {KINDS.map(([k, l]) => <button key={k} type="button" className={`cp-kind${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>{t(l)}</button>)}
      </div>
      {kind === 'crypto' && (
        <TickerPicker placeholder={t('Тикер монеты, например BTC')} onPick={(a, ex) => onChange({ asset: a, exchange: ex, label: `${a} · ${ex}` })} />
      )}
      {kind === 'com' && (
        <div className="cp-grid">
          {CROSS_COMMODITIES.map(c => {
            const on = value && value.exchange === 'COM' && value.asset === c.key;
            const name = lang === 'ru' ? c.label : c.enLabel;
            return <button key={c.key} type="button" className={`cp-chip${on ? ' on' : ''}`} onClick={() => onChange({ asset: c.key, exchange: 'COM', label: name })}><span>{c.emoji}</span>{name}</button>;
          })}
        </div>
      )}
      {kind === 'fx' && (
        <>
          <input className="modal-search" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('Код или название: KZT, тенге…')} autoComplete="off" spellCheck={false} />
          <div className="cp-fxlist">
            {fx.map(c => {
              const on = value && value.exchange === 'FX' && value.asset === c.code;
              return (
                <button key={c.code} type="button" className={`cp-fxrow${on ? ' on' : ''}`} onClick={() => onChange({ asset: c.code, exchange: 'FX', label: c.code })}>
                  <Flag cc={c.cc} width={22} /><b>{c.code}</b><span>{currencyName(c, lang)}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function CrossPicker({ onClose, onAdded }) {
  const t = useT();
  const [a, setA] = useState(null);
  const [b, setB] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr('');
    if (!a || !b) { setErr(t('Выберите оба актива')); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/cross', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset1: a.asset, exchange1: a.exchange, asset2: b.asset, exchange2: b.exchange }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(t(d.error || 'Не удалось сохранить пару')); setBusy(false); return; }
      onAdded && onAdded(d.pair);
      onClose();
    } catch { setErr(t('Не удалось сохранить пару')); setBusy(false); }
  }

  return (
    <div className="modal-overlay cross-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label={t('Добавить пару')}>
        <div className="modal-head">
          <h2>{t('Добавить пару')}</h2>
          <button className="modal-close" onClick={onClose} aria-label={t('Закрыть')}>✕</button>
        </div>
        <div className="cp-body">
          <SidePicker title={t('Актив 1')} value={a} onChange={setA} />
          <SidePicker title={t('Актив 2')} value={b} onChange={setB} />
        </div>
        {err && <p style={{ color: 'var(--danger)', margin: '8px 0 0' }}>{err}</p>}
        <div className="cp-foot">
          <button type="button" className="hd-btn" onClick={onClose}>{t('Отмена')}</button>
          <button type="button" className="hd-btn add solid" onClick={submit} disabled={busy}>{busy ? '…' : t('Добавить')}</button>
        </div>
      </div>
    </div>
  );
}
