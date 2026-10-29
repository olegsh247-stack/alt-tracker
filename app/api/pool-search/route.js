import { NextResponse } from 'next/server';
import { getUserId } from '../../../lib/getUser';
import { NETWORK_KEYS } from '../../../lib/networks';
import { searchPair } from '../../../lib/pools';

export async function GET(req) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const network = searchParams.get('network');
  const q = (searchParams.get('q') || '').trim();
  const q2 = (searchParams.get('q2') || '').trim();
  if (!NETWORK_KEYS.includes(network)) return NextResponse.json({ error: 'Неизвестная сеть' }, { status: 400 });
  if (!q) return NextResponse.json({ results: [] });

  try {
    const results = await searchPair(network, q, q2);
    return NextResponse.json({ results });
  } catch (e) {
    const busy = /429|лимит/i.test(String(e?.message));
    return NextResponse.json({ error: busy ? 'Источник данных перегружен — повторите через несколько секунд' : 'Источник данных временно недоступен' }, { status: busy ? 429 : 502 });
  }
}
