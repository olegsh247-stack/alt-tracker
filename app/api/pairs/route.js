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
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 });
  return NextResponse.json({ pairs: data });
}

export async function POST(req) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { asset1, exchange1, asset2, exchange2 } = await req.json();
  const validExchanges = ['BINANCE', 'BYBIT', 'OKX'];

  if (!asset1 || !asset2 || !validExchanges.includes(exchange1) || !validExchanges.includes(exchange2)) {
    return NextResponse.json({ error: 'Заполните оба актива и биржи' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('pairs')
    .insert({
      user_id: userId,
      asset1: asset1.toUpperCase(),
      exchange1,
      asset2: asset2.toUpperCase(),
      exchange2,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Не удалось сохранить пару' }, { status: 500 });
  return NextResponse.json({ pair: data });
}
