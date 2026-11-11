import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getUserId } from '../../../lib/getUser';
import { legOf, legCandles, crossRatio } from '../../../lib/cross';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const range = ['all', '1y', '1m', '1w'].includes(sp.get('range')) ? sp.get('range') : '1y';
  const { data: p, error } = await supabase.from('pairs').select('*').eq('id', sp.get('pairId')).eq('user_id', userId).eq('category', 'cross').single();
  if (error || !p) return NextResponse.json({ error: 'Пара не найдена' }, { status: 404 });
  try {
    const [s1, s2] = await Promise.all([legCandles(legOf(p.asset1, p.exchange1), range), legCandles(legOf(p.asset2, p.exchange2), range)]);
    return NextResponse.json({ candles: crossRatio(s1, s2) });
  } catch {
    return NextResponse.json({ error: 'Не удалось получить историю цен' }, { status: 500 });
  }
}
