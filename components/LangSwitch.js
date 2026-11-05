'use client';
import { useEffect, useRef, useState } from 'react';
import { LANGS, useLang } from './LangProvider';

// Кнопка-флажок: выбор языка (English / Español / Русский)
export default function LangSwitch() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);
  const cur = LANGS.find(l => l.code === lang) || LANGS[0];
  return (
    <div className="lang-switch" ref={ref}>
      <button type="button" className="hd-btn hd-icon lang-btn" onClick={() => setOpen(v => !v)} aria-label="Language" title="Language">{cur.flag}</button>
      {open && (
        <div className="lang-menu">
          {LANGS.map(l => (
            <button key={l.code} type="button" className={l.code === lang ? 'on' : ''} onClick={() => { setLang(l.code); setOpen(false); }}>
              <span>{l.flag}</span>{l.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
