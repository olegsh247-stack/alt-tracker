import { NextResponse } from 'next/server';
import { getRates } from '../../../lib/forex';
import { CURRENCY_CODES } from '../../../lib/currencies';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const base = String(sp.get('base') || 'USD').toUpperCase();
  const codes = [...new Set(String(sp.get('codes') || '').toUpperCase().split(',').filter(c => CURRENCY_CODES.has(c)))].slice(0, 60);
  if (!CURRENCY_CODES.has(base)) return NextResponse.json({ error: 'Неизвестная валюта' }, { status: 400 });
  if (codes.length === 0) return NextResponse.json({ rates: {} });
  try {
    const rates = await getRates(base, codes);
    return NextResponse.json({ rates }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } });
  } catch {
    return NextResponse.json({ rates: {}, error: true }, { status: 502 });
  }
}
