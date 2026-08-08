import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '../../../lib/supabaseClient';
import { createSessionValue } from '../../../lib/session';

export async function POST(req) {
  const { password } = await req.json();

  if (!password || password.length < 4) {
    return NextResponse.json({ error: 'Пароль должен быть не короче 4 символов' }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from('users')
    .insert({ password_hash: hash })
    .select('id, login')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Не удалось создать пользователя' }, { status: 500 });
  }

  const res = NextResponse.json({ login: data.login });
  res.cookies.set('session', createSessionValue(data.id), {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
