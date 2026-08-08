import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { getUserId } from '../../../../lib/getUser';

export async function PATCH(req, { params }) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const body = await req.json();
  const update = {};
  if ('sort_order' in body) update.sort_order = body.sort_order;
  if ('alert_above' in body) update.alert_above = body.alert_above === '' ? null : body.alert_above;
  if ('alert_below' in body) update.alert_below = body.alert_below === '' ? null : body.alert_below;
  if ('alert_above' in body || 'alert_below' in body) update.last_alert_direction = null;

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
