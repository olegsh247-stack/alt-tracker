'use client';
import { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { DICT } from '../lib/i18n';

export const LANGS = [
  { code: 'en', flag: '🇬🇧', name: 'Eng' },
  { code: 'ru', flag: '🇷🇺', name: 'Ru' },
];

const Ctx = createContext({ lang: 'en', setLang: () => {}, t: (s) => s });

// Ключ перевода — исходная русская фраза. Для русского возвращаем её как есть.
export function LangProvider({ initial = 'en', children }) {
  const [lang, setLangState] = useState(initial);
  const setLang = useCallback((l) => {
    setLangState(l);
    try { document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`; document.documentElement.lang = l; } catch {}
  }, []);
  const t = useCallback((s, vars) => {
    let out = s;
    if (lang !== 'ru') {
      const e = DICT[s];
      out = e ? e[0] : s;
    }
    if (vars) for (const k of Object.keys(vars)) out = out.split(`{${k}}`).join(String(vars[k]));
    return out;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx).t;
export const useLang = () => useContext(Ctx);
