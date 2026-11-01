import { NextResponse } from 'next/server';
import { getUserId } from '../../../lib/getUser';
import { NETWORK_KEYS } from '../../../lib/networks';
import { getPoolTokens } from '../../../lib/pools';

export async function GET(req) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const network = sp.get('network');
  const address = String(sp.get('address') || '');
  if (!NETWORK_KEYS.includes(network) || !/^[A-Za-z0-9]{20,100}$/.test(address)) return NextResponse.json({ error: 'Некорректный пул' }, { status: 400 });
  try {
    const t = await getPoolTokens(network, address);
    return NextResponse.json({ tokens: t }, { headers: { 'Cache-Control': 'private, max-age=3600' } });
  } catch {
    return NextResponse.json({ tokens: null }, { status: 502 });
  }
}
