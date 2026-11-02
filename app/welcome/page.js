'use client';
import { useEffect, useState } from 'react';
import Logo from '../../components/Logo';
import ThemeToggle from '../../components/ThemeToggle';
import { fmtUsd, fmtPct, fmtFee } from '../../lib/format';

const num = (n, d) => (n == null || !Number.isFinite(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d ?? (n >= 1000 ? 2 : n >= 1 ? 4 : 6) }));
const Diff = ({ v }) => <span style={{ fontWeight: 600, color: v == null ? 'var(--text-dim)' : v >= 0 ? 'var(--up)' : 'var(--down)' }}>{v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')}%`}</span>;
const Cols = ({ cls, items }) => <div className={`lp-cols ${cls}`}>{items.map((t, i) => <span key={i} className={i > 1 || (cls === 'c4' && i > 0 && i < 4 && t) ? 'r' : ''}>{t}</span>)}</div>;
const Chg = ({ v }) => <span style={{ fontWeight: 600, color: v == null ? 'var(--text-dim)' : v >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtPct(v)}</span>;

export default function Welcome() {
  const [d, setD] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch('/api/preview').then(r => r.json()).then(setD).catch(() => setFailed(true));
  }, []);

  const Card = ({ title, tag, text, data, children }) => (
    <section className="lp-card">
      <div className="lp-card-head"><h2>{title}</h2><span className="lp-tag">{tag}</span></div>
      <p className="lp-text">{text}</p>
      <div className="lp-table">
        {!d && !failed && <div className="lp-empty">Загрузка…</div>}
        {(failed || (d && !data)) && <div className="lp-empty">Данные временно недоступны</div>}
        {data && children}
      </div>
    </section>
  );

  return (
    <div className="lp">
      <header className="lp-top">
        <a href="/welcome" className="lp-brand"><Logo size={32} /><b>Alt Tracker</b></a>
        <div className="lp-top-r">
          <ThemeToggle />
          <a href="/login" className="hd-btn">Войти</a>
          <a href="/register" className="hd-btn lp-cta-sm">Регистрация</a>
        </div>
      </header>

      <section className="lp-hero">
        <h1>Рынок в одном окне</h1>
        <p>Крипта, пулы ликвидности, сырьё и валюты — списки, графики и новости по теме. Собираешь свой набор, остальное сайт делает сам.</p>
        <div className="lp-hero-cta">
          <a href="/register" className="lp-btn primary">Начать бесплатно</a>
          <a href="/api/auth/google/start?mode=login" className="lp-btn">Войти через Google</a>
        </div>
        <div className="lp-note">Живые данные ниже — как выглядит каждый раздел</div>
      </section>

      <div className="lp-grid">
        <Card title="Assets" tag="монеты" text="Топ-500 монет: рейтинг, предложение, изменение за сутки, график и новости." data={d?.assets}>
          {d?.assets?.map(r => (
            <div key={r.symbol} className="lp-row c4"><b>{r.symbol}</b><span className="dim">#{r.rank ?? '—'}</span><span className="r">{num(r.price)}</span><span className="r"><Chg v={r.change} /></span></div>
          ))}
        </Card>

        <Card title="Spot" tag="разница между биржами" text="Одна монета на двух биржах: цены рядом и расхождение между ними." data={d?.spot}>
          {d?.spot && <Cols cls="c4" items={['', 'Binance', 'OKX', 'Разница']} />}
          {d?.spot?.map(r => (
            <div key={r.coin} className="lp-row c4"><b>{r.coin}</b><span className="r">{num(r.p1)}</span><span className="r">{num(r.p2)}</span><span className="r"><Diff v={r.diff} /></span></div>
          ))}
        </Card>

        <Card title="Pool" tag="DEX-пулы" text="Пулы Uniswap, Raydium и других: APR, TVL, комиссия, график пула и адреса контрактов." data={d?.pools}>
          {d?.pools && <Cols cls="c4 pl" items={['Пара', 'Сеть · DEX', 'APR', 'TVL']} />}
          {d?.pools?.map((r, i) => (
            <div key={i} className="lp-row c4 pl"><b>{r.base}/{r.quote}</b><span className="dim">{r.network}{r.dex ? ` · ${r.dex}` : ''}</span><span className="r">{r.apr != null ? `${num(r.apr, 1)}%` : '—'}</span><span className="r">{fmtUsd(r.tvl)}</span></div>
          ))}
        </Card>

        <Card title="Commodities" tag="сырьё" text="Золото, нефть, газ, зерно и другое: пары активов с графиками." data={d?.commodities}>
          {d?.commodities?.map(r => (
            <div key={r.name} className="lp-row c3"><b>{r.name}</b><span className="r">{num(r.price)}</span><span className="r"><Chg v={r.change} /></span></div>
          ))}
        </Card>

        <Card title="Forex" tag="валюты" text="Курсы к выбранной валюте, калькулятор, новости центробанков и календарь событий." data={d?.forex}>
          {d?.forex?.map(r => (
            <div key={r.code} className="lp-row c3"><b>{r.code}</b><span className="r">{num(r.price)} <i>USD</i></span><span className="r"><Chg v={r.change} /></span></div>
          ))}
        </Card>

        <section className="lp-card lp-cta-card">
          <h2>Всё это — твоё</h2>
          <p className="lp-text">Выбираешь монеты, пары, пулы и валюты, которые нужны. Вход по логину или через Google, восстановление доступа — по почте Google.</p>
          <div className="lp-hero-cta">
            <a href="/register" className="lp-btn primary">Создать аккаунт</a>
            <a href="/login" className="lp-btn">У меня уже есть аккаунт</a>
          </div>
        </section>
      </div>

      <footer className="lp-foot">Данные: биржи, CoinGecko / CoinPaprika, GeckoTerminal / DexScreener, Yahoo Finance. Не является инвестиционной рекомендацией.</footer>
    </div>
  );
}
