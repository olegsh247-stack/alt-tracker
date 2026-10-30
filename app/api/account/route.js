import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '../../../lib/supabaseClient';
import { getUserId } from '../../../lib/getUser';
import { googleConfigured } from '../../../lib/google';

export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  let { data, error } = await supabase.from('users').select('login, google_sub, google_email').eq('id', userId).single();
  let dbReady = true;
  if (error) {
    // нет полей под Google (не выполнен SQL migration_4) — отдаём хотя бы логин
    dbReady = false;
    ({ data, error } = await supabase.from('users').select('login').eq('id', userId).single());
  }
  if (error || !data) return NextResponse.json({ error: 'Не найден' }, { status: 404 });
  return NextResponse.json({
    login: data.login,
    googleLinked: !!data.google_sub,
    googleEmail: data.google_email || null,
    googleConfigured: googleConfigured(),
    dbReady,
    googleMissing: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'].filter(k => !process.env[k]),
  });
}

// Смена пароля (пользователь уже вошёл — по паролю или через Google)
export async function POST(req) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const { password } = await req.json();
  if (!password || password.length < 4) return NextResponse.json({ error: 'Пароль должен быть не короче 4 символов' }, { status: 400 });
  const hash = await bcrypt.hash(password, 10);
  const { error } = await supabase.from('users').update({ password_hash: hash }).eq('id', userId);
  if (error) return NextResponse.json({ error: 'Не удалось сменить пароль' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Отвязать Google
export async function DELETE() {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const { error } = await supabase.from('users').update({ google_sub: null, google_email: null }).eq('id', userId);
  if (error) return NextResponse.json({ error: 'Не удалось отвязать' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
