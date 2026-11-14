import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getUserId } from '../../../lib/getUser';
import { getKlinesTF, buildRatioCandles } from '../../../lib/exchanges';

export async function GET(req) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pairId = searchParams.get('pairId');
  const tfIn = searchParams.get('range');
  const range = ['4h', '1d', '1w', '1mo'].includes(tfIn) ? tfIn : '4h'; // таймфрейм свечи

  const { data: pair, error } = await supabase
    .from('pairs')
    .select('*')
    .eq('id', pairId)
    .eq('user_id', userId)
    .eq('category', 'crypto')
    .single();

  if (error || !pair) return NextResponse.json({ error: 'Пара не найдена' }, { status: 404 });

  try {
    const [series1, series2] = await Promise.all([
      getKlinesTF(pair.exchange1, pair.asset1, range),
      getKlinesTF(pair.exchange2, pair.asset2, range),
    ]);
    const candles = buildRatioCandles(series1, series2);
    return NextResponse.json({ candles });
  } catch (e) {
    return NextResponse.json({ error: 'Не удалось получить историю цен' }, { status: 500 });
  }
}
