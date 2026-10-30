import { NextResponse } from 'next/server';
import { getNews } from '../../../lib/news';

export const dynamic = 'force-dynamic';

// Новости общие для всех (не привязаны к пользователю): кэшируем на час и в памяти, и на CDN.
export async function GET() {
  try {
    const data = await getNews();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' } });
  } catch {
    return NextResponse.json({ error: 'Новости временно недоступны' }, { status: 502 });
  }
}
