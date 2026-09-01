import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getUserId } from '../../../lib/getUser';

export async function GET() {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { data, error } = await supabase
    .from('pairs')
    .select('*')
    .eq('user_id', userId)
    .eq('category', 'crypto')
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 });
  return NextResponse.json({ pairs: data });
}

export async function POST(req) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { asset1, exchange1, asset2, exchange2 } = await req.json();
  const validExchanges = ['BINANCE', 'BYBIT', 'OKX', 'MEXC'];

  if (!asset1 || !asset2 || !validExchanges.includes(exchange1) || !validExchanges.includes(exchange2)) {
    return NextResponse.json({ error: 'Заполните оба актива и биржи' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('pairs')
    .select('sort_order')
    .eq('user_id', userId)
    .eq('category', 'crypto')
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order || 0) + 1 : 0;

  const { data, error } = await supabase
    .from('pairs')
    .insert({
      user_id: userId,
      category: 'crypto',
      asset1: asset1.toUpperCase(),
      exchange1,
      asset2: asset2.toUpperCase(),
      exchange2,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Не удалось сохранить пару' }, { status: 500 });
  return NextResponse.json({ pair: data });
}
