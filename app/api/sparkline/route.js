import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getUserId } from '../../../lib/getUser';
import { getSparkline } from '../../../lib/exchanges';

export async function GET() {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { data: pairs, error } = await supabase.from('pairs').select('*').eq('user_id', userId).eq('category', 'crypto');
  if (error) return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 });

  const results = await Promise.all(
    (pairs || []).map(async (p) => {
      try {
        const closes = await getSparkline(p);
        const changePct = closes.length >= 2 ? ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100 : null;
        return { id: p.id, closes, changePct };
      } catch (e) {
        return { id: p.id, closes: [], changePct: null };
      }
    })
  );

  return NextResponse.json({ sparklines: results });
}
