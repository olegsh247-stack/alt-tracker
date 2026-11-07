import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getUserId } from '../../../lib/getUser';
import { legOf, legQuote } from '../../../lib/cross';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const { data: pairs, error } = await supabase.from('pairs').select('*').eq('user_id', userId).eq('category', 'cross');
  if (error) return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 });

  const prices = await Promise.all((pairs || []).map(async (p) => {
    try {
      const [q1, q2] = await Promise.all([legQuote(legOf(p.asset1, p.exchange1)), legQuote(legOf(p.asset2, p.exchange2))]);
      const pct = q1.change != null && q2.change != null ? ((1 + q1.change / 100) / (1 + q2.change / 100) - 1) * 100 : null;
      return { id: p.id, price1: q1.price, price2: q2.price, ratio: q2.price ? q1.price / q2.price : null, changePct: pct, error: null };
    } catch {
      return { id: p.id, price1: null, price2: null, ratio: null, changePct: null, error: 'Нет данных' };
    }
  }));
  return NextResponse.json({ prices });
}
