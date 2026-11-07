import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { getUserId } from '../../../../lib/getUser';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const { data, error } = await supabase.from('pairs').select('*').eq('id', params.id).eq('user_id', userId).eq('category', 'cross').single();
  if (error || !data) return NextResponse.json({ error: 'Пара не найдена' }, { status: 404 });
  return NextResponse.json({ pair: data });
}

export async function PATCH(req, { params }) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.swap) return NextResponse.json({ error: 'Нечего менять' }, { status: 400 });
  const { data: p, error: e1 } = await supabase.from('pairs').select('asset1, exchange1, asset2, exchange2').eq('id', params.id).eq('user_id', userId).eq('category', 'cross').single();
  if (e1 || !p) return NextResponse.json({ error: 'Пара не найдена' }, { status: 404 });
  const { error } = await supabase.from('pairs').update({ asset1: p.asset2, exchange1: p.exchange2, asset2: p.asset1, exchange2: p.exchange1 }).eq('id', params.id).eq('user_id', userId);
  if (error) return NextResponse.json({ error: 'Не удалось поменять местами' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req, { params }) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const { error } = await supabase.from('pairs').delete().eq('id', params.id).eq('user_id', userId).eq('category', 'cross');
  if (error) return NextResponse.json({ error: 'Не удалось удалить' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
