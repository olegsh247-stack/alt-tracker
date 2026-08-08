import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getUserId } from '../../../lib/getUser';
import { getKlines, buildRatioCandles } from '../../../lib/exchanges';

export async function GET(req) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pairId = searchParams.get('pairId');
  const range = searchParams.get('range') || 'all'; // all | 1y | 1m

  const { data: pair, error } = await supabase
    .from('pairs')
    .select('*')
    .eq('id', pairId)
    .eq('user_id', userId)
    .single();

  if (error || !pair) return NextResponse.json({ error: 'Пара не найдена' }, { status: 404 });

  try {
    const [series1, series2] = await Promise.all([
      getKlines(pair.exchange1, pair.asset1, range),
      getKlines(pair.exchange2, pair.asset2, range),
    ]);
    const candles = buildRatioCandles(series1, series2);
    return NextResponse.json({ candles });
  } catch (e) {
    return NextResponse.json({ error: 'Не удалось получить историю цен' }, { status: 500 });
  }
}
