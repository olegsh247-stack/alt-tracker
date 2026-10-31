import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getUserId } from '../../../lib/getUser';

export async function GET() {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  let { data, error } = await supabase.from('users').select('login, google_sub').eq('id', userId).single();
  if (error) ({ data, error } = await supabase.from('users').select('login').eq('id', userId).single());
  if (error || !data) return NextResponse.json({ error: 'Не найден' }, { status: 404 });

  return NextResponse.json({ login: data.login, googleLinked: !!data.google_sub });
}
