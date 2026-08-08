import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '../../../lib/supabaseClient';
import { createSessionValue } from '../../../lib/session';

export async function POST(req) {
  const { login, password } = await req.json();

  const { data: user, error } = await supabase
    .from('users')
    .select('id, password_hash')
    .eq('login', login)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('session', createSessionValue(user.id), {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
