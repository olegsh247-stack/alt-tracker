import { NextResponse } from 'next/server';
import { getUserId } from '../../../lib/getUser';
import { searchTickers } from '../../../lib/tickerSearch';

export async function GET(req) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  if (!q) return NextResponse.json({ results: [] });

  try {
    const results = await searchTickers(q);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: 'Ошибка поиска' }, { status: 500 });
  }
}
