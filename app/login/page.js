'use client';
import { useEffect, useState } from 'react';
import Logo from '../../components/Logo';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const router = useRouter();
  const ERRS = {
    google_off: 'Вход через Google ещё не настроен',
    google_cancel: 'Вход через Google отменён',
    google_state: 'Сессия входа устарела, попробуйте ещё раз',
    google_fail: 'Не удалось войти через Google, попробуйте ещё раз',
    google_unlinked: 'Этот Google-аккаунт не привязан. Войдите по логину и паролю и привяжите его в разделе «Аккаунт» (⚙)',
  };
  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get('err');
    if (e && ERRS[e]) setErr(ERRS[e]);
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    });
    const d = await r.json();
    if (!r.ok) { setErr(d.error); return; }
    router.push('/');
  }

  return (
    <div style={box}>
      <div style={{ marginBottom: 14 }}><Logo size={56} /></div>
      <h1 style={{ fontSize: 24 }}>Вход</h1>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input placeholder="Логин (00000001)" value={login} onChange={e => setLogin(e.target.value)} style={input} />
        <input type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} style={input} />
        {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
        <button style={btn}>Войти</button>
        <a href="/api/auth/google/start?mode=login" style={googleBtn}>Войти через Google</a>
        <a href="/register" style={{ color: 'var(--accent-text)', textAlign: 'center' }}>Зарегистрироваться</a>
      </form>
    </div>
  );
}

const box = { maxWidth: 360, margin: '80px auto', padding: 24 };
const input = { padding: 12, borderRadius: 8, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)' };
const btn = { padding: 12, borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 600 };
const googleBtn = { padding: 12, borderRadius: 8, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontWeight: 600, textAlign: 'center', textDecoration: 'none' };
