import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getUserId } from '../../../lib/getUser';
import { normalizeSide } from '../../../lib/cross';

export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const { data, error } = await supabase.from('pairs').select('*').eq('user_id', userId).eq('category', 'cross').order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 });
  return NextResponse.json({ pairs: data || [] });
}

export async function POST(req) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const s1 = normalizeSide(b.asset1, b.exchange1);
  const s2 = normalizeSide(b.asset2, b.exchange2);
  if (!s1 || !s2) return NextResponse.json({ error: 'Выберите оба актива' }, { status: 400 });
  if (s1.asset === s2.asset && s1.exchange === s2.exchange) return NextResponse.json({ error: 'Активы должны отличаться' }, { status: 400 });

  const { data: existing } = await supabase.from('pairs').select('sort_order').eq('user_id', userId).eq('category', 'cross').order('sort_order', { ascending: false }).limit(1);
  const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order || 0) + 1 : 0;
  const { data, error } = await supabase.from('pairs').insert({
    user_id: userId, category: 'cross',
    asset1: s1.asset, exchange1: s1.exchange, asset2: s2.asset, exchange2: s2.exchange,
    sort_order: nextOrder,
  }).select().single();
  if (error) return NextResponse.json({ error: 'Не удалось сохранить пару' }, { status: 500 });
  return NextResponse.json({ pair: data });
}
