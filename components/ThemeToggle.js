'use client';
import { useT } from './LangProvider';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const t = useT();
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }

  return (
    <button onClick={toggle} title={t('Сменить тему')} aria-label={t('Сменить тему')} className="hd-btn hd-icon">
      {theme === 'dark' ? '☀\uFE0E' : '☾'}
    </button>
  );
}
