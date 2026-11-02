import { NextResponse } from 'next/server';
import { getPreview } from '../../../lib/preview';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Публичное превью для главной (без входа). Только рыночные данные, ничего личного.
export async function GET() {
  try {
    return NextResponse.json(await getPreview(), { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } });
  } catch {
    return NextResponse.json({ assets: null, spot: null, pools: null, commodities: null, forex: null }, { status: 502 });
  }
}
