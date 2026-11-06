import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getUserId } from '../../../lib/getUser';

export const dynamic = 'force-dynamic';

// Настройки аккаунта, которые должны быть одинаковы на всех устройствах (списки Assets и Forex, основные валюты).
// Хранятся в существующей таблице pairs: category = 'setting', asset1 = ключ, asset2 = значение (строка), без новых таблиц.
const KEYS = new Set(['cryptoTrackedAssets', 'cryptoTrackedMeta', 'forexCodes', 'forexBase', 'assetBase']);
const MAX_LEN = 20000;

export async function GET() {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const { data, error } = await supabase.from('pairs').select('asset1, asset2').eq('user_id', userId).eq('category', 'setting');
  if (error) return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 });
  const settings = {};
  for (const r of data || []) if (KEYS.has(r.asset1)) settings[r.asset1] = r.asset2;
  return NextResponse.json({ settings });
}

export async function PUT(req) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 }); }
  const { key, value } = body || {};
  if (!KEYS.has(key) || typeof value !== 'string' || value.length > MAX_LEN) {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });
  }
  const { data: found } = await supabase.from('pairs').select('id')
    .eq('user_id', userId).eq('category', 'setting').eq('asset1', key).limit(1);
  if (found && found.length > 0) {
    const { error } = await supabase.from('pairs').update({ asset2: value }).eq('id', found[0].id).eq('user_id', userId);
    if (error) return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 });
  } else {
    const { error } = await supabase.from('pairs').insert({ user_id: userId, category: 'setting', asset1: key, exchange1: 'sync', asset2: value, exchange2: '', sort_order: 0 });
    if (error) return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
