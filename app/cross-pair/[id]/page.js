'use client';
import { useT, useLang } from '../../../components/LangProvider';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CrossChart from '../../../components/CrossChart';
import { legInfo } from '../../../components/CrossTab';

export default function CrossPairPage() {
  const t = useT();
  const { lang } = useLang();
  const { id } = useParams();
  const router = useRouter();
  const [pair, setPair] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`/api/cross/${id}`).then(r => r.json()).then(d => { if (d.pair) setPair(d.pair); else setErr(d.error || 'Пара не найдена'); }).catch(() => setErr('Пара не найдена'));
  }, [id]);

  const a = pair && legInfo(pair.asset1, pair.exchange1, lang);
  const b = pair && legInfo(pair.asset2, pair.exchange2, lang);
  return (
    <div className="page-wrap" style={{ maxWidth: 860, margin: '0 auto', padding: 16 }}>
      <button onClick={() => router.push('/?tab=cross')} style={{ background: 'none', border: 'none', color: 'var(--accent-text)', fontSize: 16, cursor: 'pointer', padding: 0 }}>{t('← Назад')}</button>
      {err && <p style={{ color: 'var(--danger)' }}>{t(err)}</p>}
      {pair && <div style={{ height: 'min(560px, 70vh)', marginTop: 16 }}><CrossChart pairId={pair.id} title={`${a.text}/${b.text}`} sub={`${a.src} / ${b.src}`} /></div>}
    </div>
  );
}
