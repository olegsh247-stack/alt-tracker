'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [password, setPassword] = useState('');
  const [login, setLogin] = useState(null);
  const [err, setErr] = useState('');
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setErr('');
    const r = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const d = await r.json();
    if (!r.ok) { setErr(d.error); return; }
    setLogin(d.login);
    setTimeout(() => router.push('/'), 1500);
  }

  return (
    <div style={box}>
      <h1 style={{ fontSize: 20 }}>Регистрация</h1>
      {login ? (
        <p>Ваш логин: <b>{login}</b><br />Запомните его — переходим на главную...</p>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="password" placeholder="Придумайте пароль" value={password}
            onChange={e => setPassword(e.target.value)} style={input}
          />
          {err && <p style={{ color: '#f66' }}>{err}</p>}
          <button style={btn}>Зарегистрироваться</button>
          <a href="/login" style={{ color: '#8ab4f8', textAlign: 'center' }}>У меня уже есть логин</a>
        </form>
      )}
    </div>
  );
}

const box = { maxWidth: 360, margin: '80px auto', padding: 24 };
const input = { padding: 12, borderRadius: 8, border: '1px solid #333', background: '#161a1e', color: '#fff' };
const btn = { padding: 12, borderRadius: 8, border: 'none', background: '#2b6cf6', color: '#fff', fontWeight: 600 };
