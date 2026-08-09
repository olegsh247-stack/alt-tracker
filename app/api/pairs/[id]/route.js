import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { getUserId } from '../../../../lib/getUser';

export async function PATCH(req, { params }) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const body = await req.json();

  if (body.swap) {
    const { data: pair, error: fetchErr } = await supabase
      .from('pairs')
      .select('asset1, exchange1, asset2, exchange2')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single();

    if (fetchErr || !pair) return NextResponse.json({ error: 'Пара не найдена' }, { status: 404 });

    const { error } = await supabase
      .from('pairs')
      .update({
        asset1: pair.asset2, exchange1: pair.exchange2,
        asset2: pair.asset1, exchange2: pair.exchange1,
      })
      .eq('id', params.id)
      .eq('user_id', userId);

    if (error) return NextResponse.json({ error: 'Не удалось поменять местами' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const update = {};
  if ('sort_order' in body) update.sort_order = body.sort_order;

  const { error } = await supabase
    .from('pairs')
    .update(update)
    .eq('id', params.id)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: 'Не удалось обновить пару' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { error } = await supabase
    .from('pairs')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: 'Не удалось удалить пару' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
