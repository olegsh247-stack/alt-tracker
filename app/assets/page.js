'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://crypto-api.olegsh247.workers.dev';

function icon(symbol) {
  return `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`;
}

export default function AssetsPage() {
  const router = useRouter();
  const [assets, setAssets] = useState([]);
  const [tracked, setTracked] = useState([]);
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('cryptoTrackedAssets') || '[]');
    setTracked(Array.isArray(saved) ? saved : []);

    fetch(`${API}/api/assets`)
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Не удалось загрузить список активов');
        return data;
      })
      .then(data => setAssets(data.assets || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!assets.length) return;
    let cancelled = false;

    Promise.all(
      assets.map(async asset => {
        try {
          const r = await fetch(`${API}/api/assets/${asset.asset_id}`);
          if (!r.ok) return [asset.asset_id, null];
          return [asset.asset_id, await r.json()];
        } catch {
          return [asset.asset_id, null];
        }
      })
    ).then(rows => {
      if (!cancelled) setDetails(Object.fromEntries(rows));
    });

    return () => { cancelled = true; };
  }, [assets]);

  function persist(next) {
    setTracked(next);
    localStorage.setItem('cryptoTrackedAssets', JSON.stringify(next));
  }

  function toggle(assetId) {
    const next = tracked.includes(assetId)
      ? tracked.filter(id => id !== assetId)
      : [...tracked, assetId];
    persist(next);
  }

  const trackedAssets = useMemo(
    () => tracked.map(id => assets.find(a => a.asset_id === id)).filter(Boolean),
    [tracked, assets]
  );

  const availableAssets = useMemo(
    () => assets.filter(a => !tracked.includes(a.asset_id)),
    [assets, tracked]
  );

  function priceFor(assetId) {
    const metrics = details[assetId]?.metrics || [];
    const m = metrics.find(x => x.metric_id === 'market.spot_price');
    return m?.value;
  }

  function formatPrice(value) {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    const n = Number(value);
    return n >= 1000
      ? n.toLocaleString('en-US', { maximumFractionDigits: 2 })
      : n >= 1
        ? n.toLocaleString('en-US', { maximumFractionDigits: 4 })
        : n.toLocaleString('en-US', { maximumFractionDigits: 8 });
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={header}>
        <button onClick={() => router.push('/?tab=crypto')} style={backBtn}>← Crypto</button>
        <h1 style={{ margin: 0, fontSize: 22 }}>Активы</h1>
        <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>{assets.length}/50</span>
      </div>

      <p style={{ color: 'var(--text-dim)', marginTop: 8 }}>
        Выбирайте монеты из утверждённого списка. Сейчас доступны только активы Crypto Universe.
      </p>

      {loading && <p>Загрузка списка…</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {!loading && !error && (
        <>
          <section style={section}>
            <div style={sectionTitle}>
              <h2 style={h2}>Мои активы</h2>
              <span style={count}>{trackedAssets.length}</span>
            </div>

            {trackedAssets.length === 0 ? (
              <div style={empty}>Пока ничего не добавлено. Ниже выберите нужные активы.</div>
            ) : (
              trackedAssets.map(asset => (
                <AssetRow
                  key={asset.asset_id}
                  asset={asset}
                  price={priceFor(asset.asset_id)}
                  added
                  onToggle={() => toggle(asset.asset_id)}
                />
              ))
            )}
          </section>

          <section style={section}>
            <div style={sectionTitle}>
              <h2 style={h2}>Доступные активы</h2>
              <span style={count}>{availableAssets.length}</span>
            </div>

            {availableAssets.map(asset => (
              <AssetRow
                key={asset.asset_id}
                asset={asset}
                price={priceFor(asset.asset_id)}
                onToggle={() => toggle(asset.asset_id)}
              />
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function AssetRow({ asset, price, added, onToggle }) {
  return (
    <div style={row}>
      <img
        src={icon(asset.symbol)}
        width={34}
        height={34}
        alt=""
        onError={e => { e.currentTarget.style.display = 'none'; }}
        style={{ borderRadius: '50%' }}
      />
      <div style={{ flex: 1, minWidth: 150 }}>
        <div style={{ fontWeight: 700 }}>{asset.symbol}</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>{asset.name}</div>
      </div>
      <div style={priceStyle}>{formatPrice(price)}{price != null ? ' USD' : ''}</div>
      <button onClick={onToggle} style={added ? addedBtn : addBtn}>
        {added ? '✓ Добавлено' : '+ Добавить'}
      </button>
    </div>
  );
}

function formatPrice(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  return n >= 1000
    ? n.toLocaleString('en-US', { maximumFractionDigits: 2 })
    : n >= 1
      ? n.toLocaleString('en-US', { maximumFractionDigits: 4 })
      : n.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

const header = { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 };
const backBtn = { border: '1px solid var(--input-border)', background: 'none', color: 'var(--text)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' };
const section = { marginTop: 24 };
const sectionTitle = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 };
const h2 = { margin: 0, fontSize: 16 };
const count = { color: 'var(--text-dim)', fontSize: 12 };
const empty = { padding: 18, border: '1px dashed var(--card-border)', borderRadius: 10, color: 'var(--text-dim)' };
const row = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', borderBottom: '1px solid var(--card-border)' };
const priceStyle = { minWidth: 100, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-dim)', fontSize: 13 };
const addBtn = { border: '1px solid var(--accent)', background: 'none', color: 'var(--accent)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 600 };
const addedBtn = { border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-dim)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' };
