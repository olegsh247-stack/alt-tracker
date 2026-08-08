'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const router = useRouter();

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
      <h1 style={{ fontSize: 20 }}>Вход</h1>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input placeholder="Логин (00000001)" value={login} onChange={e => setLogin(e.target.value)} style={input} />
        <input type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} style={input} />
        {err && <p style={{ color: '#f66' }}>{err}</p>}
        <button style={btn}>Войти</button>
        <a href="/register" style={{ color: '#8ab4f8', textAlign: 'center' }}>Зарегистрироваться</a>
      </form>
    </div>
  );
}

const box = { maxWidth: 360, margin: '80px auto', padding: 24 };
const input = { padding: 12, borderRadius: 8, border: '1px solid #333', background: '#161a1e', color: '#fff' };
const btn = { padding: 12, borderRadius: 8, border: 'none', background: '#2b6cf6', color: '#fff', fontWeight: 600 };
