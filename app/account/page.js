'use client';
import { useEffect, useState } from 'react';

const MSG = {
  google_linked: 'Google привязан. Теперь можно входить через него и восстанавливать доступ.',
  google_off: 'Вход через Google ещё не настроен на сервере.',
  google_cancel: 'Привязка отменена.',
  google_state: 'Сессия устарела, попробуйте ещё раз.',
  google_fail: 'Не удалось привязать Google, попробуйте ещё раз.',
  google_taken: 'Этот Google-аккаунт уже привязан к другому аккаунту.',
  google_db: 'Не удалось сохранить привязку. Проверьте, что выполнен SQL (migration_4).',
};

export default function AccountPage() {
  const [info, setInfo] = useState(null);
  const [note, setNote] = useState('');
  const [bad, setBad] = useState(false);
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch('/api/account');
    if (r.status === 401) { window.location.href = '/login'; return; }
    if (r.ok) setInfo(await r.json());
  }
  useEffect(() => {
    load();
    const sp = new URLSearchParams(window.location.search);
    const k = sp.get('ok') || sp.get('err');
    if (k && MSG[k]) { setNote(MSG[k]); setBad(!!sp.get('err')); }
  }, []);

  async function changePwd(e) {
    e.preventDefault();
    setBusy(true); setNote('');
    const r = await fetch('/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pwd }) });
    const d = await r.json();
    setBusy(false);
    setBad(!r.ok);
    setNote(r.ok ? 'Пароль изменён.' : d.error || 'Ошибка');
    if (r.ok) setPwd('');
  }
  async function unlink() {
    if (!confirm('Отвязать Google? Войти через него и восстановить доступ будет нельзя.')) return;
    const r = await fetch('/api/account', { method: 'DELETE' });
    setBad(!r.ok); setNote(r.ok ? 'Google отвязан.' : 'Не удалось отвязать.');
    load();
  }

  return (
    <div style={box}>
      <a href="/" style={{ color: 'var(--accent-text)', textDecoration: 'none' }}>← Назад</a>
      <h1 style={{ fontSize: 24, margin: '12px 0' }}>Аккаунт</h1>
      {note && <p style={{ color: bad ? 'var(--danger)' : 'var(--up)', fontSize: 15 }}>{note}</p>}
      {!info ? <p style={{ color: 'var(--text-dim)' }}>Загрузка…</p> : (
        <>
          <div style={card}>
            <div style={label}>Ваш логин</div>
            <div style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>{info.login}</div>
          </div>

          <div style={card}>
            <div style={label}>Google — вход и восстановление доступа</div>
            {info.googleLinked ? (
              <>
                <p style={{ margin: '6px 0 10px' }}>Привязан{info.googleEmail ? `: ${info.googleEmail}` : ''}</p>
                <button onClick={unlink} style={btnGhost}>Отвязать</button>
              </>
            ) : (
              <>
                <p style={{ margin: '6px 0 10px', color: 'var(--text-dim)', fontSize: 15 }}>
                  Привяжите Google, чтобы входить одной кнопкой и вернуть доступ, если забудете пароль или номер.
                </p>
                <a href="/api/auth/google/start?mode=link" style={btn}>Привязать Google</a>
                {!info.googleConfigured && <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>Сервер пока не настроен для Google — привязка заработает после настройки.</p>}
              </>
            )}
          </div>

          <form onSubmit={changePwd} style={card}>
            <div style={label}>Сменить пароль</div>
            <input type="password" placeholder="Новый пароль (от 4 символов)" value={pwd} onChange={e => setPwd(e.target.value)} style={input} />
            <button disabled={busy || pwd.length < 4} style={{ ...btn, opacity: busy || pwd.length < 4 ? 0.5 : 1 }}>Сохранить пароль</button>
          </form>
        </>
      )}
    </div>
  );
}

const box = { maxWidth: 440, margin: '40px auto', padding: 20 };
const card = { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: 16, marginBottom: 14, border: '1px solid var(--card-border)', borderRadius: 10 };
const label = { fontSize: 14, color: 'var(--text-dim)' };
const input = { width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)' };
const btn = { padding: '10px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 600, textDecoration: 'none', cursor: 'pointer' };
const btnGhost = { padding: '10px 16px', borderRadius: 8, border: '1px solid var(--input-border)', background: 'none', color: 'var(--text)', cursor: 'pointer' };
