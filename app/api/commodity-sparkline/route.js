import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getUserId } from '../../../lib/getUser';
import { getCommodityKlines } from '../../../lib/commodities';
import { buildRatioCandles } from '../../../lib/exchanges';

export async function GET() {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { data: pairs, error } = await supabase
    .from('pairs')
    .select('*')
    .eq('user_id', userId)
    .eq('category', 'commodity');

  if (error) return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 });

  const results = await Promise.all(
    (pairs || []).map(async (p) => {
      try {
        const [s1, s2] = await Promise.all([
          getCommodityKlines(p.asset1, '1m'),
          getCommodityKlines(p.asset2, '1m'),
        ]);
        const ratioCandles = buildRatioCandles(s1.slice(-10), s2.slice(-10));
        const closes = ratioCandles.map(c => c.close);
        const changePct = closes.length >= 2 ? ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100 : null;
        return { id: p.id, closes, changePct };
      } catch (e) {
        return { id: p.id, closes: [], changePct: null };
      }
    })
  );

  return NextResponse.json({ sparklines: results });
}
