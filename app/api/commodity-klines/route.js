import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getUserId } from '../../../lib/getUser';
import { getCommodityKlines } from '../../../lib/commodities';
import { buildRatioCandles } from '../../../lib/exchanges';

export async function GET(req) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pairId = searchParams.get('pairId');
  const range = searchParams.get('range') || 'all';

  const { data: pair, error } = await supabase
    .from('pairs')
    .select('*')
    .eq('id', pairId)
    .eq('user_id', userId)
    .eq('category', 'commodity')
    .single();

  if (error || !pair) return NextResponse.json({ error: 'Пара не найдена' }, { status: 404 });

  try {
    const [s1, s2] = await Promise.all([
      getCommodityKlines(pair.asset1, range),
      getCommodityKlines(pair.asset2, range),
    ]);
    const candles = buildRatioCandles(s1, s2);
    return NextResponse.json({ candles });
  } catch (e) {
    return NextResponse.json({ error: 'Не удалось получить историю цен' }, { status: 500 });
  }
}
