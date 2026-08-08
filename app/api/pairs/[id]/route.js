import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { getUserId } from '../../../../lib/getUser';

export async function DELETE(req, { params }) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { error } = await supabase
    .from('pairs')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId); // на всякий случай — удалить можно только свою пару

  if (error) return NextResponse.json({ error: 'Не удалось удалить пару' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
