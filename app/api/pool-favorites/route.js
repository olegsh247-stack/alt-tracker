import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getUserId } from '../../../lib/getUser';
import { NETWORK_KEYS } from '../../../lib/networks';
import { getPoolsStats } from '../../../lib/pools';

export async function GET() {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { data: rows, error } = await supabase
    .from('pairs')
    .select('*')
    .eq('user_id', userId)
    .eq('category', 'pool')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });
  if (error) return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 });
  const favs = (rows || []).map(r => ({ id: r.id, network: r.exchange1, address: r.asset1, pool_name: r.asset2, dex: r.exchange2 }));

  // статистика по сетям параллельно; сбой одной сети не ломает остальные
  const byNet = {};
  (favs || []).forEach(f => { (byNet[f.network] ||= []).push(f.address); });
  const stats = {};
  let statsError = false;
  await Promise.all(Object.entries(byNet).map(async ([net, addrs]) => {
    try { stats[net] = await getPoolsStats(net, addrs); } catch { statsError = true; stats[net] = new Map(); }
  }));

  const pools = (favs || []).map(f => {
    const s = stats[f.network]?.get(f.address);
    const [bs, qs] = (f.pool_name || '').split(' / ');
    return {
      id: f.id,
      network: f.network,
      address: f.address,
      base: s?.base || bs || '?',
      quote: s?.quote || qs || '?',
      dex: s?.dex || f.dex || null,
      feePct: s?.feePct ?? null,
      feeApprox: !!s?.feeApprox,
      apr: s?.apr ?? null,
      fees24: s?.fees24 ?? null,
      tvl: s?.tvl ?? null,
      vol24: s?.vol24 ?? null,
      change24: s?.change24 ?? null,
      createdAt: s?.createdAt ?? null,
    };
  });
  return NextResponse.json({ pools, statsError });
}

export async function POST(req) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { network, address } = await req.json();
  if (!NETWORK_KEYS.includes(network) || typeof address !== 'string' || address.length < 10) {
    return NextResponse.json({ error: 'Некорректный пул' }, { status: 400 });
  }

  const { data: dup } = await supabase
    .from('pairs').select('id')
    .eq('user_id', userId).eq('category', 'pool').eq('exchange1', network).eq('asset1', address).limit(1);
  if (dup && dup.length > 0) return NextResponse.json({ error: 'Этот пул уже в избранном' }, { status: 409 });

  // название и площадку берём с сервера, а не от клиента
  let poolName = null, dex = null;
  try {
    const s = (await getPoolsStats(network, [address])).get(address);
    if (s) { poolName = `${s.base} / ${s.quote}`; dex = s.dex; }
  } catch {}

  const { data: existing } = await supabase
    .from('pairs').select('sort_order').eq('user_id', userId).eq('category', 'pool')
    .order('sort_order', { ascending: false }).limit(1);
  const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order || 0) + 1 : 0;

  const { error } = await supabase.from('pairs').insert({
    user_id: userId, category: 'pool',
    asset1: address, exchange1: network,
    asset2: poolName || '', exchange2: dex || '',
    sort_order: nextOrder,
  });
  if (error) return NextResponse.json({ error: 'Не удалось сохранить пул' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
