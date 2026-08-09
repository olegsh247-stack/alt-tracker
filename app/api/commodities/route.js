import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getUserId } from '../../../lib/getUser';
import { COMMODITIES } from '../../../lib/commodities';

const VALID_KEYS = COMMODITIES.map(c => c.key);

export async function GET() {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { data, error } = await supabase
    .from('pairs')
    .select('*')
    .eq('user_id', userId)
    .eq('category', 'commodity')
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 });
  return NextResponse.json({ pairs: data });
}

export async function POST(req) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { asset1, asset2 } = await req.json();

  if (!VALID_KEYS.includes(asset1) || !VALID_KEYS.includes(asset2)) {
    return NextResponse.json({ error: 'Выберите оба актива из списка' }, { status: 400 });
  }
  if (asset1 === asset2) {
    return NextResponse.json({ error: 'Активы должны отличаться' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('pairs')
    .select('sort_order')
    .eq('user_id', userId)
    .eq('category', 'commodity')
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order || 0) + 1 : 0;

  const { data, error } = await supabase
    .from('pairs')
    .insert({
      user_id: userId,
      category: 'commodity',
      asset1, exchange1: 'YAHOO',
      asset2, exchange2: 'YAHOO',
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Не удалось сохранить пару' }, { status: 500 });
  return NextResponse.json({ pair: data });
}
