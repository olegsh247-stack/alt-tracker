import { NextResponse } from 'next/server';
import { getUserId } from '../../../lib/getUser';
import { NETWORK_KEYS } from '../../../lib/networks';
import { getDefaultPools } from '../../../lib/pools';

// Пары по умолчанию для выбранных сетей: ?networks=bsc,eth
export async function GET(req) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const raw = new URL(req.url).searchParams.get('networks') || '';
  const nets = [...new Set(raw.split(',').map(x => x.trim()).filter(x => NETWORK_KEYS.includes(x)))];
  if (nets.length === 0) return NextResponse.json({ error: 'Неизвестная сеть' }, { status: 400 });

  const settled = await Promise.allSettled(nets.map(n => getDefaultPools(n)));
  const results = {};
  const failed = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') results[nets[i]] = r.value;
    else failed.push(nets[i]);
  });
  return NextResponse.json({ results, failed });
}
