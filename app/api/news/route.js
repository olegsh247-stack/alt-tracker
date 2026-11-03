import { NextResponse } from 'next/server';
import { getNews } from '../../../lib/news';
import { getFxNews } from '../../../lib/fxnews';
import { getComNews } from '../../../lib/comnews';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Новости общие для всех (не привязаны к пользователю): кэшируем на час и в памяти, и на CDN.
export async function GET(req) {
  try {
    const kind = new URL(req.url).searchParams.get('kind');
    const data = kind === 'fx' ? await getFxNews() : kind === 'com' ? await getComNews() : await getNews();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' } });
  } catch {
    return NextResponse.json({ error: 'Новости временно недоступны' }, { status: 502 });
  }
}
