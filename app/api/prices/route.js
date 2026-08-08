import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getUserId } from '../../../lib/getUser';
import { getPrice } from '../../../lib/exchanges';

export async function GET() {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { data: pairs, error } = await supabase.from('pairs').select('*').eq('user_id', userId);
  if (error) return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 });

  const results = await Promise.all(
    pairs.map(async (p) => {
      try {
        const [price1, price2] = await Promise.all([
          getPrice(p.exchange1, p.asset1),
          getPrice(p.exchange2, p.asset2),
        ]);
        return { id: p.id, price1, price2, ratio: price2 ? price1 / price2 : null, error: null };
      } catch (e) {
        return { id: p.id, price1: null, price2: null, ratio: null, error: 'Нет данных' };
      }
    })
  );

  return NextResponse.json({ prices: results });
}
